    // ── STORAGE (Firestore, per-user) ──────────────────────────────────────────
    const monthKey = (y, m) => `${y}_${String(m).padStart(2, '0')}`;

    function userMonths() {
      return db.collection('users').doc(currentUser.uid).collection('months');
    }

    async function loadMonth() {
      const snap = await userMonths().doc(monthKey(Y, M)).get();
      mdata = snap.exists ? snap.data() : { days: {} };
      if (!mdata.days) mdata.days = {};
      for (const ds of allDates(Y, M)) {
        if (!mdata.days[ds]) mdata.days[ds] = defDay(ds);
      }
      renderAll();
    }

    function save() {
      userMonths().doc(monthKey(Y, M)).set(mdata);
      showToast('Saved ✓');
      const net = document.querySelector('.snet');
      if (net) { net.classList.remove('pulse'); void net.offsetWidth; net.classList.add('pulse'); }
    }

