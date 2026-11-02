    // ── STORAGE (Firestore, per-user) ──────────────────────────────────────────
    const monthKey = (y, m) => `${y}_${String(m).padStart(2, '0')}`;

    let _monthReq = 0, _monthDone = 0; // guards against out-of-order renders when the month changes mid-load
    let mdataKey = null; // the month mdata actually holds (Y/M move ahead of it during a load)

    function userMonths() {
      return db.collection('users').doc(currentUser.uid).collection('months');
    }

    // False while a load is in flight, or after one failed with nothing to fall back to.
    // Nothing may read or write mdata as "the current month" unless this is true.
    function monthReady() {
      return _monthDone === _monthReq && mdataKey === monthKey(Y, M);
    }

    async function loadMonth() {
      const myReq = ++_monthReq;
      const key = monthKey(Y, M);
      let snap;
      try {
        snap = await userMonths().doc(key).get();
      } catch (e) {
        if (myReq !== _monthReq) return; // a newer request superseded this one
        _monthDone = myReq;
        // Step back to the month still held in mdata, so the view and its data stay in sync.
        if (mdataKey) [Y, M] = mdataKey.split('_').map(Number);
        gridAnimDir = 0;
        showToast('โหลดเดือนไม่สำเร็จ: ' + ((e && e.message) || e), 5000);
        return;
      }
      if (myReq !== _monthReq) return; // a newer request superseded this one
      mdata = snap.exists ? snap.data() : { days: {} };
      if (!mdata.days) mdata.days = {};
      for (const ds of allDates(Y, M)) {
        if (!mdata.days[ds]) mdata.days[ds] = defDay(ds);
      }
      mdataKey = key;
      _monthDone = myReq;
      renderAll();
    }

    function persistMonth() {
      return userMonths().doc(monthKey(Y, M)).set(mdata);
    }

    // otherWrites: in-flight writes to the day's other month doc, reported with this save.
    async function save(okMsg = 'Saved ✓', otherWrites = []) {
      if (!monthReady()) { showToast('กำลังโหลดเดือน… ยังไม่ได้บันทึก'); return; }
      try {
        await Promise.all([persistMonth(), ...otherWrites]);
      } catch (e) {
        showToast('บันทึกไม่สำเร็จ: ' + ((e && e.message) || e), 5000);
        return;
      }
      showToast(okMsg);
      const net = document.querySelector('.snet');
      if (net) { net.classList.remove('pulse'); void net.offsetWidth; net.classList.add('pulse'); }
    }

