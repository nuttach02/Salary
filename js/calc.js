    // ── DATE HELPERS ───────────────────────────────────────────────────────────
    const dim = (y, m) => new Date(y, m, 0).getDate();
    const fd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const jsDate = ds => { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d); };
    const today = () => fd(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());

    function otDates(y, m) {
      const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
      const res = [];
      for (let d = 25; d <= dim(py, pm); d++) res.push(fd(py, pm, d));
      for (let d = 1; d <= 24; d++) res.push(fd(y, m, d));
      return res;
    }

    function attDates(y, m) {
      const res = [];
      for (let d = 1; d <= dim(y, m); d++) res.push(fd(y, m, d));
      return res;
    }

    function allDates(y, m) { return [...new Set([...otDates(y, m), ...attDates(y, m)])]; }

    // ── CALCULATIONS ───────────────────────────────────────────────────────────
    function calc() {
      const od = otDates(Y, M), ad = attDates(Y, M);
      const pfx = `${Y}-${String(M).padStart(2, '0')}-`;

      let otPay = 0;
      const otR = { "1": 0, "1.5": 0, "2": 0, "3": 0 };
      for (const ds of od) {
        const d = gd(ds);
        for (const r of ["1", "1.5", "2", "3"]) {
          const h = Number(d.ot[r]) || 0;
          otR[r] += h; otPay += h * HOURLY * Number(r);
        }
      }
      const otHrs = Object.values(otR).reduce((a, b) => a + b, 0);

      let tDays = 0, absentDays = 0, totalWorkDays = 0, totalLateMin = 0;
      let leaveHrs = 0, leaveDays = 0, absentHrs = 0, absentHrsDays = 0;
      let sickHrs = 0, sickDays = 0, personalHrs = 0, personalDays = 0;
      let lateAbsentHrs = 0, lateAbsentDays = 0;
      for (const ds of ad) {
        if (!ds.startsWith(pfx)) continue;
        const dow = jsDate(ds).getDay();
        const d = gd(ds);
        totalLateMin += Number(d.lateMin) || 0;
        // Estimated absent hours from a late arrival (display/tracking only — money is the
        // normal per-minute late deduction below). Rule + guards live in lateAbsentHrsOf().
        const la = lateAbsentHrsOf(d);
        if (la > 0) { lateAbsentHrs += la; lateAbsentDays++; }
        const lh = leaveHrsOf(d);
        if (lh > 0) {
          leaveHrs += lh; leaveDays++;
          if (leaveTypeOf(d) === 'sick') { sickHrs += lh; sickDays++; }
          else { personalHrs += lh; personalDays++; }
        }
        const ah = absentHrsOf(d);
        if (ah > 0) { absentHrs += ah; absentHrsDays++; }
        // Weekdays (Mon–Fri): count as workable; absent if not worked, not holiday, and not on leave
        if (dow >= 1 && dow <= 5 && !d.isHoliday) {
          if (!d.leave) totalWorkDays++;
          if (!d.worked && !d.leave) absentDays++;
        }
        // Saturdays: only deduct if explicitly marked as absent (satAbsent flag)
        if (dow === 6 && !d.isHoliday && d.satAbsent) {
          totalWorkDays++;
          absentDays++;
        }
        // Sundays: only deduct if explicitly marked as absent (sunAbsent flag)
        if (dow === 0 && d.sunAbsent) {
          totalWorkDays++;
          absentDays++;
        }
      }

      // Travel: OT period (25th prev – 24th curr), Mon–Sat worked non-holiday
      for (const ds of od) {
        const dow = jsDate(ds).getDay();
        const d = gd(ds);
        if (dow !== 0 && d.worked && !d.isHoliday) tDays++;
      }

      const dailyRate = BASE / 30;
      const absDeduction = absentDays * dailyRate;
      const tPay = tDays * TRAVEL;
      const otherIncomePay = OTHER_INCOMES.reduce((s, oi) => s + (Number(oi.amount) || 0), 0);
      const gross = BASE - absDeduction + tPay + otPay + otherIncomePay;
      const lateDeduction = totalLateMin * (BASE / 30 / 9 / 60);
      const otherDeductionsPay = OTHER_DEDUCTIONS.reduce((s, od) => s + (Number(od.amount) || 0), 0);
      const net = gross - SSF - lateDeduction - otherDeductionsPay;
      return { BASE, absDeduction, absentDays, tPay, tDays, otPay, otR, otHrs, leaveHrs, leaveDays, sickHrs, sickDays, personalHrs, personalDays, absentHrs, absentHrsDays, lateAbsentHrs, lateAbsentDays, SSF, totalLateMin, lateDeduction, otherIncomePay, otherDeductionsPay, gross, net };
    }

    // ── FORMAT ─────────────────────────────────────────────────────────────────
    const fmt = n => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

