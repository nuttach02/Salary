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
      document.getElementById('leavebg').classList.add('open');
    }

    function closeLeave() { document.getElementById('leavebg').classList.remove('open'); }
    function leaveBgClick(e) { if (e.target === document.getElementById('leavebg')) closeLeave(); }

    function applyLeave() {
      const startStr = document.getElementById('leave-start').value;
      const endStr = document.getElementById('leave-end').value;
      const note = document.getElementById('leave-note').value.trim();
      if (!startStr || !endStr) { showToast('Please select start and end dates'); return; }
      const start = new Date(startStr + 'T00:00:00');
      const end = new Date(endStr + 'T00:00:00');
      if (start > end) { showToast('Start must be before end date'); return; }
      const cur = new Date(start);
      let count = 0;
      while (cur <= end) {
        const dow = cur.getDay();
        if (dow >= 1 && dow <= 5) {
          const ds = fd(cur.getFullYear(), cur.getMonth() + 1, cur.getDate());
          const d = gd(ds);
          if (!d.isHoliday) {
            d.leave = true;
            d.leaveHours = 9;
            d.leaveStart = '08:00';
            d.leaveEnd = '18:00';
            d.worked = false;
            if (note) d.note = note;
            mdata.days[ds] = d;
            count++;
          }
        }
        cur.setDate(cur.getDate() + 1);
      }
      closeLeave();
      renderAll();
      save();
      showToast(`Leave applied for ${count} day${count !== 1 ? 's' : ''} ✓`);
    }

