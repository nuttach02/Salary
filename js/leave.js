    // ── LEAVE REQUEST ──────────────────────────────────────────────────────────
    function openLeaveModal() {
      const now = new Date();
      const day = now.getDay();
      const daysToMon = (1 - day + 7) % 7 || 7;
      const mon = new Date(now); mon.setDate(now.getDate() + daysToMon);
      const fri = new Date(mon); fri.setDate(mon.getDate() + 4);
      const fmtD = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      document.getElementById('leave-start').value = fmtD(mon);
      document.getElementById('leave-end').value = fmtD(fri);
      document.getElementById('leave-note').value = '';
      const ltb = document.getElementById('leave-type-bulk');
      if (ltb) ltb.value = 'sick';
      document.getElementById('leavebg').classList.add('open');
    }

    function closeLeave() { document.getElementById('leavebg').classList.remove('open'); }
    function leaveBgClick(e) { if (e.target === document.getElementById('leavebg')) closeLeave(); }

    // The range can span months the view isn't on, so every date is written to the
    // doc(s) it lives in (importTargetKeys), then the current month is reloaded.
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
        for (const key of Object.keys(writes)) await writeDayPatch(key, writes[key], null);
        await loadMonth();
        if (monthReady() && writes[monthKey(Y, M)]) await persistMonth();
        showToast(`Leave applied for ${count} day${count !== 1 ? 's' : ''} ✓`);
      } catch (e) {
        showToast('บันทึกไม่สำเร็จ: ' + ((e && e.message) || e), 5000);
      }
    }

