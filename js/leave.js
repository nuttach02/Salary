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

