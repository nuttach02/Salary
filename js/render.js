    // ── RENDER ─────────────────────────────────────────────────────────────────
    function renderAll() {
      const py = M === 1 ? Y - 1 : Y, pm = M === 1 ? 12 : M - 1;
      document.getElementById('mlabel').textContent = `${MONTHS[M - 1]} ${Y}`;
      document.getElementById('ot-sub').textContent =
        `${String(pm).padStart(2, '0')}/${py} 25 – ${String(M).padStart(2, '0')}/${Y} 24`;
      document.getElementById('att-sub').textContent =
        `${String(M).padStart(2, '0')}/${Y} 1–${dim(Y, M)}`;
      renderGrid('ot-grid', otDates(Y, M), true);
      renderGrid('att-grid', attDates(Y, M), false);
      renderSummary();
      animateGrids();
    }

    function bgClass(ds) {
      const d = gd(ds), dow = jsDate(ds).getDay();
      if (d.isHoliday) return 'bg-holiday';
      if (dow === 0) return d.sunAbsent ? 'bg-sun-absent' : 'bg-sun';
      if (dow === 6) {
        if (d.worked) return 'bg-sat-worked';
        if (d.satAbsent) return 'bg-sat-absent';
        return 'bg-sat';
      }
      if (dow >= 1 && dow <= 5 && leaveHrsOf(d) > 0) {
        // Full-day leave reads as a day off; a partial leave still worked stays a worked day (with a badge).
        if (leaveHrsOf(d) >= 9 || !d.worked) return 'bg-leave';
      }
      return d.worked ? 'bg-worked' : 'bg-absent';
    }

    function renderGrid(id, dates, showOT) {
      const el = document.getElementById(id);
      const pfx = `${Y}-${String(M).padStart(2, '0')}-`;
      const tod = today();

      let html = DOW.map((d, i) =>
        `<div class="cdow${i === 0 ? ' sun' : i === 6 ? ' sat' : ''}">${d}</div>`).join('');

      const firstDow = jsDate(dates[0]).getDay();
      for (let i = 0; i < firstDow; i++) html += `<div class="ccell empty"></div>`;

      let cellI = 0;
      for (const ds of dates) {
        cellI++;
        const d = gd(ds);
        const dow = jsDate(ds).getDay();
        const isPrev = !ds.startsWith(pfx);
        const isToday = ds === tod;
        const bg = bgClass(ds);
        const dayNum = parseInt(ds.split('-')[2]);

        const hasOT = Object.values(d.ot).some(h => Number(h) > 0);

        let otHtml = '';
        if (showOT) {
          const lines = [];
          for (const [r, h] of Object.entries(d.ot)) if (Number(h) > 0) lines.push(`${h}h×${r}`);
          if (lines.length) otHtml = `<div class="ot-lines">${lines.join(' ')}</div>`;
        }

        const hasTravelDot = !showOT && dow !== 0 && ds.startsWith(pfx) && d.worked && !d.isHoliday;
        const tdot = hasTravelDot ? `<div class="travel-dot" title="Travel +฿${TRAVEL}"></div>` : '';
        const otDot = hasOT
          ? `<div class="ot-dot" style="${hasTravelDot ? 'bottom:4px' : 'top:4px'}" title="OT recorded"></div>`
          : '';
        const hasNote = d.note && d.note.trim();
        const noteDot = hasNote ? `<div class="note-dot" title="${d.note.trim()}"></div>` : '';

        const holBadge = d.isHoliday ? `<div class="hol-badge">Holiday</div>` : '';
        const dLeaveHrs = leaveHrsOf(d);
        const dLeaveType = leaveTypeOf(d);
        const leaveBadge = (!d.isHoliday && dow >= 1 && dow <= 5 && dLeaveHrs > 0)
          ? `<div class="leave-badge${dLeaveType === 'sick' ? ' sick' : ''}" title="${dLeaveType === 'sick' ? 'ลาป่วย Sick' : 'ลากิจ Personal'} ${dLeaveHrs} ชม.">${dLeaveType === 'sick' ? 'ลาป่วย' : 'ลากิจ'} ${dLeaveHrs}h</div>` : '';
        const lateBadge = (Number(d.lateMin) > 0) ? `<div class="late-badge" title="มาสาย ${d.lateMin} นาที">⏰${d.lateMin}m</div>` : '';
        const dAbsentHrs = absentHrsOf(d);
        const absentBadge = (!d.isHoliday && dow >= 1 && dow <= 5 && dAbsentHrs > 0) ? `<div class="absent-badge" title="ขาดงาน ${dAbsentHrs} ชม.">ขาด ${dAbsentHrs}h</div>` : '';
        const dLateAbsentHrs = lateAbsentHrsOf(d);
        const lateAbsentBadge = (dLateAbsentHrs > 0) ? `<div class="absent-badge est" title="ประเมินขาดจากมาสาย ${d.lateMin} นาที = ${dLateAbsentHrs} ชม. (HR ยังไม่อนุมัติ)">~ขาด ${dLateAbsentHrs}h</div>` : '';
        const mNote = isPrev
          ? `<div class="dmonth">${MONTHS[parseInt(ds.split('-')[1]) - 1].slice(0, 3)}</div>` : '';

        const isSatAbsent = dow === 6 && d.satAbsent && !d.isHoliday;
        const isSunAbsent = dow === 0 && d.sunAbsent;
        html += `<div class="ccell ${bg}${isPrev ? ' prev' : ''}${isToday ? ' today' : ''}${hasOT ? ' has-ot' : ''}" onclick="cellClick('${ds}',event)" title="${ds}" style="animation-delay:${cellI * 13}ms">
      <div class="dnum${(!d.worked && !d.isHoliday && dow >= 1 && dow <= 5 || isSatAbsent || isSunAbsent) ? ' dim' : ''}">${dayNum}</div>
      ${mNote}${holBadge}${leaveBadge}${lateBadge}${absentBadge}${lateAbsentBadge}${otHtml}${otDot}${tdot}${noteDot}
    </div>`;
      }
      el.innerHTML = html;
    }

    function renderSummary() {
      const c = calc();
      const hrate = `฿${fmt(HOURLY)}/hr`;
      const labels = { "1": "1× Holiday", "1.5": "1.5× Weekday", "2": "2× Holiday", "3": "3× Holiday" };
      let otRows = '', anyOT = false;
      for (const r of ["1.5", "1", "2", "3"]) {
        if (c.otR[r] > 0) {
          anyOT = true;
          const pay = c.otR[r] * HOURLY * Number(r);
          otRows += `<div class="srow"><span class="sl">${labels[r]} (${c.otR[r]}h)</span>
        <span class="sv pos">+฿${fmt(pay)}</span></div>`;
        }
      }

      document.getElementById('sbody').innerHTML = `
    <div class="ssect">Income</div>
    <div class="srow"><span class="sl">Base Salary</span><span class="sv pos">+฿${fmt(c.BASE)}</span></div>
    <div class="srow"><span class="sl">Travel (${c.tDays}d × ฿${TRAVEL})</span><span class="sv pos">+฿${fmt(c.tPay)}</span></div>
    ${OTHER_INCOMES.filter(oi => oi.amount > 0).map(oi =>
          `<div class="srow"><span class="sl">${oi.name || 'Other Income'}</span><span class="sv pos">+฿${fmt(oi.amount)}</span></div>`
        ).join('')}

    <div class="ssect">OT Pay${c.otHrs > 0 ? ` — <span id="ot-hrs-badge">${c.otHrs}</span>h total` : ''}</div>
    ${anyOT
          ? otRows + `<div class="srow" style="font-style:italic"><span class="sl" style="font-size:.72rem">Rate: ${hrate}</span></div>`
          : `<div class="srow"><span class="sl">No OT recorded</span><span class="sv">฿0.00</span></div>`}

    <div class="ssect">Leave${c.leaveHrs > 0 ? ` — <span id="leave-hrs-badge">${c.leaveHrs}</span>h total` : ''}</div>
    ${c.leaveHrs > 0
          ? [
            c.personalHrs > 0 ? `<div class="srow"><span class="sl">🧳 ลากิจ Personal (${c.personalDays}d)</span><span class="sv">${c.personalHrs}h</span></div>` : '',
            c.sickHrs > 0 ? `<div class="srow"><span class="sl">🤒 ลาป่วย Sick (${c.sickDays}d)</span><span class="sv">${c.sickHrs}h</span></div>` : ''
          ].join('')
          : `<div class="srow"><span class="sl">No leave taken</span><span class="sv">0h</span></div>`}

    <div class="ssect">ขาดงาน Absent${(c.absentDays > 0 || (c.absentHrs + c.lateAbsentHrs) > 0)
          ? ` — ${[c.absentDays > 0 ? `${c.absentDays} วัน` : '', (c.absentHrs + c.lateAbsentHrs) > 0 ? `${c.absentHrs + c.lateAbsentHrs}h` : ''].filter(Boolean).join(' · ')}`
          : ''}</div>
    ${(c.absentDays > 0 || c.absentHrs > 0 || c.lateAbsentHrs > 0)
          ? [
            c.absentDays > 0 ? `<div class="srow"><span class="sl">Absent (${c.absentDays}d)</span><span class="sv neg">−฿${fmt(c.absDeduction)}</span></div>` : '',
            c.absentHrs > 0 ? `<div class="srow"><span class="sl" style="font-size:.72rem;color:var(--muted)">HR อนุมัติแล้ว · record (${c.absentHrsDays} วัน)</span><span class="sv">${c.absentHrs}h</span></div>` : '',
            c.lateAbsentHrs > 0 ? `<div class="srow"><span class="sl" style="font-size:.72rem;color:var(--muted)">จากมาสาย &gt;30น. · ประเมิน (${c.lateAbsentDays} วัน)</span><span class="sv">${c.lateAbsentHrs}h</span></div>` : ''
          ].join('')
          : `<div class="srow"><span class="sl">ไม่มีการขาดงาน</span><span class="sv">฿0.00</span></div>`}

    <div class="ssect">มาสาย Late${c.totalLateMin > 0 ? ` — ${c.totalLateMin} นาที` : ''}</div>
    ${c.totalLateMin > 0
          ? `<div class="srow"><span class="sl">มาสาย (${c.totalLateMin} นาที)</span><span class="sv neg">−฿${fmt(c.lateDeduction)}</span></div>`
          : `<div class="srow"><span class="sl">ไม่มีมาสาย</span><span class="sv">฿0.00</span></div>`}

    <div class="ssect">Deductions</div>
    <div class="srow"><span class="sl">SSF</span><span class="sv neg">−฿${fmt(c.SSF)}</span></div>
    ${OTHER_DEDUCTIONS.filter(od => od.amount > 0).map(od =>
          `<div class="srow"><span class="sl">${od.name || 'Other Deduction'}</span><span class="sv neg">−฿${fmt(od.amount)}</span></div>`
        ).join('')}

    <div class="sgross"><span>Gross</span><span>฿${fmt(c.gross)}</span></div>
    <div class="snet"><span class="nl">Net Salary</span><span class="nv">฿${fmt(c.net)}</span></div>`;

      // Animate net salary count-up when value changes
      const netEl = document.querySelector('.snet .nv');
      if (netEl && _prevNet !== null && _prevNet !== c.net)
        countUpEl(netEl, _prevNet, c.net, 700, n => '฿' + fmt(n));
      _prevNet = c.net;

      // Animate OT total hours when value changes
      const otBadge = document.getElementById('ot-hrs-badge');
      if (otBadge && _prevOtHrs !== null && _prevOtHrs !== c.otHrs) {
        otBadge.classList.remove('ot-flash');
        void otBadge.offsetWidth;
        otBadge.classList.add('ot-flash');
        countUpEl(otBadge, _prevOtHrs, c.otHrs, 500, n => (Math.round(n * 10) / 10).toString());
      }
      _prevOtHrs = c.otHrs;

      // Animate leave total hours when value changes
      const leaveBadge = document.getElementById('leave-hrs-badge');
      if (leaveBadge && _prevLeaveHrs !== null && _prevLeaveHrs !== c.leaveHrs) {
        leaveBadge.classList.remove('ot-flash');
        void leaveBadge.offsetWidth;
        leaveBadge.classList.add('ot-flash');
        countUpEl(leaveBadge, _prevLeaveHrs, c.leaveHrs, 500, n => (Math.round(n * 10) / 10).toString());
      }
      _prevLeaveHrs = c.leaveHrs;
    }

