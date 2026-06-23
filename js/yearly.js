    // ── YEARLY SUMMARY ──────────────────────────────────────────────────────────
    let yearViewYear = null;
    let _yrReq = 0; // guards against out-of-order renders when the year changes mid-load

    function openYearView() {
      yearViewYear = Y;
      document.getElementById('app').style.display = 'none';
      document.getElementById('year-screen').style.display = '';
      window.scrollTo(0, 0);
      renderYearView();
    }

    function closeYearView() {
      document.getElementById('year-screen').style.display = 'none';
      document.getElementById('app').style.display = '';
    }

    function changeYearView(delta) {
      yearViewYear += delta;
      renderYearView();
    }

    // Fetch all 12 months of `year`, then run calc() per recorded month by
    // temporarily swapping the view globals. All awaits happen BEFORE the swap;
    // the swap loop is fully synchronous; globals are always restored afterwards.
    // Months with no Firestore doc are returned as { populated:false } so they
    // don't contribute default/phantom travel pay or net to the yearly totals.
    async function computeYear(year) {
      const snaps = await Promise.all(
        Array.from({ length: 12 }, (_, i) => userMonths().doc(monthKey(year, i + 1)).get())
      );
      const saved = { Y, M, mdata };
      const results = [];
      try {
        for (let i = 0; i < 12; i++) {
          const snap = snaps[i];
          if (!snap.exists) { results.push({ month: i + 1, populated: false, c: null }); continue; }
          const data = snap.data();
          if (!data.days) data.days = {};
          Y = year; M = i + 1; mdata = data;
          results.push({ month: i + 1, populated: true, c: calc() });
        }
      } finally {
        Y = saved.Y; M = saved.M; mdata = saved.mdata;
      }
      return results;
    }

    // Sum recorded months into yearly totals (pure — unit-testable).
    function sumYear(results) {
      const t = { otHrs: 0, otPay: 0, leaveHrs: 0, leaveDays: 0, sickHrs: 0, sickDays: 0, personalHrs: 0, personalDays: 0, absentDays: 0, absDeduction: 0, absentHrs: 0, absentHrsDays: 0, lateAbsentHrs: 0, lateAbsentDays: 0, totalLateMin: 0, lateDeduction: 0, tDays: 0, tPay: 0, net: 0, gross: 0, months: 0 };
      for (const r of results) {
        if (!r.populated || !r.c) continue;
        const c = r.c;
        t.otHrs += c.otHrs; t.otPay += c.otPay;
        t.leaveHrs += c.leaveHrs; t.leaveDays += c.leaveDays;
        t.sickHrs += c.sickHrs; t.sickDays += c.sickDays;
        t.personalHrs += c.personalHrs; t.personalDays += c.personalDays;
        t.absentDays += c.absentDays; t.absDeduction += c.absDeduction;
        t.absentHrs += c.absentHrs; t.absentHrsDays += c.absentHrsDays;
        t.lateAbsentHrs += c.lateAbsentHrs; t.lateAbsentDays += c.lateAbsentDays;
        t.totalLateMin += c.totalLateMin; t.lateDeduction += c.lateDeduction;
        t.tDays += c.tDays; t.tPay += c.tPay;
        t.net += c.net; t.gross += c.gross;
        t.months++;
      }
      return t;
    }

    async function renderYearView() {
      const myReq = ++_yrReq;
      const el = document.getElementById('yr-content');
      document.getElementById('yr-label').textContent = yearViewYear;
      document.getElementById('yr-sub').textContent = `${yearViewYear} · 12 salary periods`;
      el.innerHTML = `<div class="yr-loading">Loading ${yearViewYear}…</div>`;

      let results;
      try {
        results = await computeYear(yearViewYear);
      } catch (e) {
        if (myReq !== _yrReq) return;
        el.innerHTML = `<div class="yr-loading">Couldn't load ${yearViewYear}.<br>${(e && e.message) || e}</div>`;
        return;
      }
      if (myReq !== _yrReq) return; // a newer request superseded this one

      const t = sumYear(results);
      const fmtHrs = n => (Math.round(n * 10) / 10).toString();
      const plural = (n, w) => `${n} ${w}${n !== 1 ? 's' : ''}`;

      const cards = `<div class="yr-cards">
      <div class="yr-card accent"><div class="yc-label">⏱ Total OT Hours</div><div class="yc-val">${fmtHrs(t.otHrs)}<span style="font-size:1rem"> h</span></div><div class="yc-sub">฿${fmt(t.otPay)} OT pay</div></div>
      <div class="yr-card leave"><div class="yc-label">🏖️ Total Leave Hours</div><div class="yc-val">${fmtHrs(t.leaveHrs)}<span style="font-size:1rem"> h</span></div><div class="yc-sub">🧳 ${fmtHrs(t.personalHrs)}h ลากิจ · 🤒 ${fmtHrs(t.sickHrs)}h ลาป่วย</div></div>
      <div class="yr-card"><div class="yc-label">❌ Absent Days</div><div class="yc-val">${fmtHrs(t.absentDays)}</div><div class="yc-sub">−฿${fmt(t.absDeduction)}${t.absentHrs > 0 ? ` · ${fmtHrs(t.absentHrs)}h record` : ''}${t.lateAbsentHrs > 0 ? ` · ${fmtHrs(t.lateAbsentHrs)}h สาย→ขาด` : ''}</div></div>
      <div class="yr-card"><div class="yc-label">⏰ Late Minutes</div><div class="yc-val">${t.totalLateMin}</div><div class="yc-sub">−฿${fmt(t.lateDeduction)}</div></div>
      <div class="yr-card"><div class="yc-label">🚐 Travel Days</div><div class="yc-val">${t.tDays}</div><div class="yc-sub">฿${fmt(t.tPay)}</div></div>
      <div class="yr-card"><div class="yc-label">💰 Annual Net</div><div class="yc-val" style="font-size:1.3rem">฿${fmt(t.net)}</div><div class="yc-sub">${plural(t.months, 'month')} recorded</div></div>
    </div>`;

      const rows = results.map(r => {
        if (!r.populated) {
          return `<tr class="empty-month"><td>${MONTHS[r.month - 1]}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>`;
        }
        const c = r.c;
        return `<tr>
        <td>${MONTHS[r.month - 1]}</td>
        <td>${c.otHrs ? fmtHrs(c.otHrs) : '—'}</td>
        <td>${c.leaveHrs ? fmtHrs(c.leaveHrs) : '—'}</td>
        <td>${c.absentDays ? fmtHrs(c.absentDays) : '—'}</td>
        <td>${c.totalLateMin || '—'}</td>
        <td>${c.tDays || '—'}</td>
        <td>฿${fmt(c.net)}</td>
      </tr>`;
      }).join('');

      const table = `<div class="yr-tablecard">
      <div class="yr-tabletitle">📅 Month-by-Month — ${yearViewYear}</div>
      <div class="yr-scroll">
        <table class="yr-table">
          <thead><tr>
            <th>Month</th><th>OT (h)</th><th>Leave (h)</th><th>Absent (d)</th><th>Late (min)</th><th>Travel (d)</th><th>Net (฿)</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr>
            <td>Total</td>
            <td>${fmtHrs(t.otHrs)}</td>
            <td>${fmtHrs(t.leaveHrs)}</td>
            <td>${fmtHrs(t.absentDays)}</td>
            <td>${t.totalLateMin}</td>
            <td>${t.tDays}</td>
            <td>฿${fmt(t.net)}</td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;

      const caveat = `<div class="yr-caveat">ℹ️ Each row is a salary month — its OT period runs the 25th of the previous month through the 24th. Months you haven't recorded yet are shown as “—” and excluded from totals. Hour counts are exact; money columns are recomputed at your <em>current</em> salary settings, not the settings in effect at the time.</div>`;

      el.innerHTML = cards + table + caveat;
    }

    function defDay(ds) {
      const dow = jsDate(ds).getDay();
      return { worked: dow >= 1 && dow <= 5, isHoliday: false, satAbsent: false, sunAbsent: false, leave: false, leaveHours: 0, leaveType: 'sick', leaveStart: '', leaveEnd: '', absentHours: 0, workIn: '', workOut: '', ot: { "1": 0, "1.5": 0, "2": 0, "3": 0 }, lateMin: 0, note: '' };
    }

    function gd(ds) {
      if (!mdata.days[ds]) mdata.days[ds] = defDay(ds);
      return mdata.days[ds];
    }

    // Leave hours for a day. Legacy days stored before hour-tracking have
    // leave === true but no leaveHours — treat those as a full day (9h).
    function leaveHrsOf(d) {
      const h = Number(d.leaveHours) || 0;
      if (h > 0) return h;
      return d.leave ? 9 : 0;
    }

    // Leave type for a day. Legacy days and import-without-detected-type days have
    // no leaveType — default 'sick' (ลาป่วย), the chosen app-wide default; only an
    // explicit 'personal' tag reads as personal.
    function leaveTypeOf(d) {
      return d.leaveType === 'personal' ? 'personal' : 'sick';
    }

    // Absent (ขาดงาน) hours for a day — a recorded figure, like leave hours.
    // The money deduction is NOT taken from this; it follows late-minutes /
    // the full-day absence rule, per the chosen import behaviour.
    function absentHrsOf(d) {
      return Number(d.absentHours) || 0;
    }

