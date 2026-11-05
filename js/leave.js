    // ── LEAVE REQUEST / NIGHT SHIFT RANGE ──────────────────────────────────────
    // Next Monday and Friday as 'YYYY-MM-DD', the default range for both modals.
    function nextWorkWeek() {
      const now = new Date();
      const day = now.getDay();
      const daysToMon = (1 - day + 7) % 7 || 7;
      const mon = new Date(now); mon.setDate(now.getDate() + daysToMon);
      const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
      const fmtD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return [fmtD(mon), fmtD(fri)];
    }

    // A range can span months the view isn't on, so every date is written to the doc(s)
    // it lives in (importTargetKeys), then the current month is reloaded.
    // writes: { monthKey: { ds: patch } }
    async function writeDayRange(writes) {
      for (const key of Object.keys(writes)) await writeDayPatch(key, writes[key], null);
      await loadMonth();
      if (monthReady() && writes[monthKey(Y, M)]) await persistMonth();
    }

    function openLeaveModal() {
      const [mon, fri] = nextWorkWeek();
      document.getElementById('leave-start').value = mon;
      document.getElementById('leave-end').value = fri;
      document.getElementById('leave-note').value = '';
      const ltb = document.getElementById('leave-type-bulk');
      if (ltb) ltb.value = 'sick';
      document.getElementById('leavebg').classList.add('open');
    }

    function closeLeave() { document.getElementById('leavebg').classList.remove('open'); }
    function leaveBgClick(e) { if (e.target === document.getElementById('leavebg')) closeLeave(); }

    async function applyLeave() {
      const startStr = document.getElementById('leave-start').value;
      const endStr = document.getElementById('leave-end').value;
      const note = document.getElementById('leave-note').value.trim();
      const ltSel = document.getElementById('leave-type-bulk');
      const leaveType = (ltSel && ltSel.value === 'personal') ? 'personal' : 'sick';
      if (!startStr || !endStr) { showToast('Please select start and end dates'); return; }
      const start = new Date(startStr + 'T00:00:00');
      const end = new Date(endStr + 'T00:00:00');
      if (start > end) { showToast('Start must be before end date'); return; }
      if (!monthReady()) { showToast('กำลังโหลดเดือน… ลองใหม่อีกครั้ง'); return; }
      const dates = [];
      const cur = new Date(start);
      while (cur <= end) {
        const dow = cur.getDay();
        if (dow >= 1 && dow <= 5) dates.push(fd(cur.getFullYear(), cur.getMonth() + 1, cur.getDate()));
        cur.setDate(cur.getDate() + 1);
      }
      closeLeave();
      try {
        const docs = {};
        for (const key of new Set(dates.flatMap(ds => importTargetKeys(ds)))) {
          const snap = await userMonths().doc(key).get();
          docs[key] = snap.exists ? snap.data() : { days: {} };
        }
        const writes = {};
        let count = 0;
        for (const ds of dates) {
          const keys = importTargetKeys(ds);
          if (keys.some(key => ((docs[key].days || {})[ds] || {}).isHoliday)) continue;
          const patch = { leaveHours: 9, leaveType, worked: false, ...(note ? { note } : {}) };
          keys.forEach(key => { (writes[key] || (writes[key] = {}))[ds] = patch; });
          count++;
        }
        await writeDayRange(writes);
        showToast(`Leave applied for ${count} day${count !== 1 ? 's' : ''} ✓`);
      } catch (e) {
        showToast('บันทึกไม่สำเร็จ: ' + ((e && e.message) || e), 5000);
      }
    }

    function openShiftModal() {
      const [mon, fri] = nextWorkWeek();
      document.getElementById('shift-start').value = mon;
      document.getElementById('shift-end').value = fri;
      document.getElementById('shift-kind').value = 'night';
      document.getElementById('shiftbg').classList.add('open');
    }

    function closeShift() { document.getElementById('shiftbg').classList.remove('open'); }
    function shiftBgClick(e) { if (e.target === document.getElementById('shiftbg')) closeShift(); }

    // Unlike leave, every day in the range is set, weekends and holidays included.
    async function applyShift() {
      const startStr = document.getElementById('shift-start').value;
      const endStr = document.getElementById('shift-end').value;
      const night = document.getElementById('shift-kind').value === 'night';
      if (!startStr || !endStr) { showToast('Please select start and end dates'); return; }
      const start = new Date(startStr + 'T00:00:00');
      const end = new Date(endStr + 'T00:00:00');
      if (start > end) { showToast('Start must be before end date'); return; }
      if (!monthReady()) { showToast('กำลังโหลดเดือน… ลองใหม่อีกครั้ง'); return; }
      const writes = {};
      let count = 0;
      for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
        const ds = fd(cur.getFullYear(), cur.getMonth() + 1, cur.getDate());
        importTargetKeys(ds).forEach(key => { (writes[key] || (writes[key] = {}))[ds] = { nightShift: night }; });
        count++;
      }
      closeShift();
      try {
        await writeDayRange(writes);
        showToast(`${night ? '🌙 กะกลางคืน' : '☀️ กะกลางวัน'} ${count} วัน ✓`);
      } catch (e) {
        showToast('บันทึกไม่สำเร็จ: ' + ((e && e.message) || e), 5000);
      }
    }

    // ── RESET OT (displayed month only) ────────────────────────────────────────
    // Clears the OT hours of every day in the viewed month's OT period (25th of the
    // previous month → 24th), nothing else: worked/leave/late/holiday stay as they are,
    // and days 25th–end of this month keep their OT (it belongs to next month's period).
    // Days 25th+ of the previous month also have a copy in that month's doc, which is
    // cleared too so both copies stay in step. (OT_RATES / otTotal live in import.js.)
    const ZERO_OT = () => ({ "1": 0, "1.5": 0, "2": 0, "3": 0 });

    function resetOtDays() {
      return otDates(Y, M).filter(ds => otTotal((mdata.days[ds] || {}).ot) > 0);
    }

    function openResetOt() {
      if (!monthReady()) { showToast('กำลังโหลดเดือน… ลองใหม่อีกครั้ง'); return; }
      const od = otDates(Y, M);
      const days = resetOtDays();
      const byRate = {};
      OT_RATES.forEach(r => { byRate[r] = days.reduce((s, ds) => s + (Number(mdata.days[ds].ot[r]) || 0), 0); });
      const total = OT_RATES.reduce((s, r) => s + byRate[r], 0);
      const h = n => +n.toFixed(2);
      const monthName = new Date(Y, M - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
      document.getElementById('resetot-body').innerHTML = `
      <div class="otsect" style="margin-top:6px"><h4>${monthName}</h4>
        <div class="srow"><span class="sl">รอบ OT</span><span class="sv">${od[0]} → ${od[od.length - 1]}</span></div>
        <div class="srow"><span class="sl">วันที่มี OT</span><span class="sv"><strong>${days.length}</strong> วัน</span></div>
        <div class="srow"><span class="sl">ชั่วโมง OT</span><span class="sv">${OT_RATES.filter(r => byRate[r] > 0).map(r => `${r}× ${h(byRate[r])}h`).join(' · ') || '—'}</span></div>
        <div class="srow"><span class="sl">รวม</span><span class="sv"><strong>${h(total)}</strong> ชม.</span></div>
      </div>
      ${days.length
          ? `<div class="info-box" style="margin-top:10px;background:var(--red-lt)">⚠️ OT ทุกวันในรอบนี้จะถูกตั้งเป็น 0 — ย้อนกลับไม่ได้ (import จากบริษัทใหม่ได้) · วันทำงาน/ลา/สาย/วันหยุด ไม่ถูกแตะ</div>`
          : `<div class="info-box" style="margin-top:10px">ไม่มี OT ในรอบนี้ — ไม่มีอะไรต้องล้าง</div>`}
      <div class="mactions">
        <button class="btn btn-c" onclick="closeResetOt()">ยกเลิก</button>
        <button class="btn btn-d" id="resetot-apply-btn" onclick="applyResetOt()" ${days.length ? '' : 'disabled'}>ล้าง OT ${days.length} วัน</button>
      </div>`;
      document.getElementById('resetotbg').classList.add('open');
    }

    function closeResetOt() { document.getElementById('resetotbg').classList.remove('open'); }
    function resetOtBgClick(e) { if (e.target === document.getElementById('resetotbg')) closeResetOt(); }

    async function applyResetOt() {
      if (!monthReady()) { showToast('กำลังโหลดเดือน… ลองใหม่อีกครั้ง'); return; }
      const key = monthKey(Y, M);
      const btn = document.getElementById('resetot-apply-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังล้าง…'; }
      const prevDs = otDates(Y, M).filter(ds => !ds.startsWith(key.replace('_', '-')));
      const prevKey = monthKey(...prevDs[0].split('-').slice(0, 2).map(Number));
      let prevRef = null, prevData = null;
      try {
        prevRef = userMonths().doc(prevKey);
        const snap = await prevRef.get();
        if (snap.exists) prevData = snap.data();
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = 'ลองอีกครั้ง'; }
        showToast('โหลดเดือนก่อนหน้าไม่สำเร็จ: ' + ((e && e.message) || e), 5000);
        return;
      }
      if (!monthReady() || monthKey(Y, M) !== key) { closeResetOt(); showToast('เดือนเปลี่ยนแล้ว — ยังไม่ได้ล้าง OT'); return; }

      const days = resetOtDays();
      days.forEach(ds => { mdata.days[ds].ot = ZERO_OT(); });
      const others = [];
      if (prevData && prevData.days) {
        const hit = prevDs.filter(ds => otTotal((prevData.days[ds] || {}).ot) > 0);
        hit.forEach(ds => { prevData.days[ds].ot = ZERO_OT(); });
        if (hit.length) others.push(prevRef.set(prevData));
      }
      closeResetOt();
      renderAll();
      await save(`ล้าง OT ${days.length} วันแล้ว ✓`, others);
    }
