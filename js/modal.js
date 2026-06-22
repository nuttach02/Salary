    // ── MODAL ──────────────────────────────────────────────────────────────────
    function openModal(ds) {
      editDate = ds;
      const d = gd(ds);
      _editWorkedOrig = d.worked;
      _editHadLeave = leaveHrsOf(d) > 0;
      const dow = jsDate(ds).getDay();
      const isSun = dow === 0, isSat = dow === 6, isWkd = !isSun && !isSat;
      const inOT = otDates(Y, M).includes(ds);
      const pfx = `${Y}-${String(M).padStart(2, '0')}-`;
      const isPrev = !ds.startsWith(pfx);

      const dayNum = parseInt(ds.split('-')[2]);
      const mo = MONTHS[parseInt(ds.split('-')[1]) - 1];
      document.getElementById('mtitle').textContent = `${DOW[dow]}, ${mo} ${dayNum}`;

      const typeLabel = isSun ? 'Sunday – Rest Day' : isSat ? 'Saturday – Attendance Day' : d.isHoliday ? 'Public Holiday' : 'Regular Workday';
      const typeCls = isSun ? 'sunday' : isSat ? 'saturday' : d.isHoliday ? 'holiday' : 'weekday';

      let html = `<div class="mtype ${typeCls}">${typeLabel}</div>`;

      if (!isSun) {
        html += `<div class="trow">
      <div><div class="tl">🏖️ Public Holiday</div><div class="td">Mark as official holiday – enables 1×/2×/3× OT rates</div></div>
      <label class="sw"><input type="checkbox" id="chk-hol" ${d.isHoliday ? 'checked' : ''}><span class="sw-sl"></span></label>
    </div>`;
      }

      if (isWkd || isSat) {
        html += `<div class="trow" id="wrow"${d.isHoliday ? ' style="display:none"' : ''}>
      <div><div class="tl">✅ Worked today</div><div class="td">${isWkd ? `Mon–Fri regular hours → +฿${TRAVEL} travel allowance` : `Mark as worked this Saturday → +฿${TRAVEL} travel allowance`}</div></div>
      <label class="sw"><input type="checkbox" id="chk-wrk" ${d.worked ? 'checked' : ''}><span class="sw-sl"></span></label>
    </div>`;
      }

      if (isWkd) {
        const lh = leaveHrsOf(d);
        const isLeave = lh > 0;
        html += `<div class="trow" id="lrow"${d.isHoliday ? ' style="display:none"' : ''}>
      <div><div class="tl">🏖️ On Leave</div><div class="td">Record paid leave by the hour — full day = 9h, half day = 4h</div></div>
      <label class="sw"><input type="checkbox" id="chk-leave" ${isLeave ? 'checked' : ''}><span class="sw-sl"></span></label>
    </div>
    <div class="leave-detail" id="leave-detail"${(isLeave && !d.isHoliday) ? '' : ' style="display:none"'}>
      <div class="sat-presets">
        <span class="preset-label">⚡ Quick:</span>
        <button class="preset-btn" onclick="leavePreset('half');return false"><span>Half day</span><small>4h</small></button>
        <button class="preset-btn" onclick="leavePreset('full');return false"><span>Full day</span><small>9h</small></button>
        <button class="preset-btn preset-clear" onclick="leavePreset('clear');return false">✕ Clear</button>
      </div>
      <div class="leave-times">
        <label class="leave-fld">Start<input type="time" class="otinp" id="leave-start-t" value="${d.leaveStart || ''}"></label>
        <label class="leave-fld">End<input type="time" class="otinp" id="leave-end-t" value="${d.leaveEnd || ''}"></label>
        <label class="leave-fld">Hours<input type="number" class="otinp" id="leave-hours" value="${lh || ''}" min="0" max="9" step="0.5" placeholder="0" oninput="updLeave()"></label>
      </div>
      <div class="ottotal" id="leave-tot"></div>
    </div>`;
      }

      if (isWkd) {
        const ah = absentHrsOf(d);
        const isAbsent = ah > 0;
        html += `<div class="trow" id="abrow"${d.isHoliday ? ' style="display:none"' : ''}>
      <div><div class="tl">❌ ขาดงาน (Absent)</div><div class="td">บันทึกชั่วโมงขาด — เต็มวัน 9 ชม. / ครึ่งวัน 4 ชม. (หักเงินอิงนาทีสาย ไม่หักจากชั่วโมงนี้)</div></div>
      <label class="sw"><input type="checkbox" id="chk-absent" ${isAbsent ? 'checked' : ''}><span class="sw-sl"></span></label>
    </div>
    <div class="leave-detail" id="absent-detail"${(isAbsent && !d.isHoliday) ? '' : ' style="display:none"'}>
      <div class="sat-presets">
        <span class="preset-label">⚡ Quick:</span>
        <button class="preset-btn" onclick="absentPreset('half');return false"><span>ครึ่งวัน</span><small>4h</small></button>
        <button class="preset-btn" onclick="absentPreset('full');return false"><span>เต็มวัน</span><small>9h</small></button>
        <button class="preset-btn preset-clear" onclick="absentPreset('clear');return false">✕ Clear</button>
      </div>
      <div class="leave-times">
        <label class="leave-fld">ชั่วโมงขาด<input type="number" class="otinp" id="absent-hours" value="${ah || ''}" min="0" max="9" step="0.5" placeholder="0" oninput="updAbsent()"></label>
      </div>
      <div class="ottotal" id="absent-tot"></div>
    </div>`;
      }

      if (isSat) {
        html += `<div class="trow" id="sarow"${d.isHoliday ? ' style="display:none"' : ''}>
      <div><div class="tl">❌ Absent (deduct salary)</div><div class="td">Mark this Saturday as an absence — daily rate will be deducted</div></div>
      <label class="sw"><input type="checkbox" id="chk-sat-absent" ${d.satAbsent ? 'checked' : ''}><span class="sw-sl"></span></label>
    </div>`;
      }

      if (isWkd || isSat) {
        html += `<div class="trow" id="laterow"${d.isHoliday ? ' style="display:none"' : ''}>
      <div><div class="tl">⏰ มาสาย (นาที)</div><div class="td">หักเงินตามนาที — ฿${fmt(BASE / 30 / 9 / 60)}/นาที</div></div>
      <input type="number" class="otinp" id="late-min" value="${d.lateMin || ''}" min="0" step="1" placeholder="0" style="max-width:70px">
    </div>`;
      }

      if (inOT && !isSun) {
        const rinfo = { "1.5": "1.5× Weekday OT", "1": "1× Holiday pay", "2": "2× Holiday OT", "3": "3× Holiday OT" };
        html += `<div class="otsect"><h4>⏱ OT Hours</h4>`;
        if (isWkd && !d.isHoliday) {
          html += `<div class="sat-presets" style="margin-bottom:6px">
    <span class="preset-label">🕐 คำนวณจากเวลาออก-เข้างาน (วันปกติ 1.5×)</span>
  </div>
  <div class="leave-times">
    <label class="leave-fld">เข้า<input type="time" class="otinp" id="wt-in" value="${d.workIn || ''}"></label>
    <label class="leave-fld">ออก<input type="time" class="otinp" id="wt-out" data-otkind="wkd" value="${d.workOut || ''}" oninput="otFromTime(true)"></label>
    <button class="preset-btn" onclick="otFromTime(true);return false" style="align-self:flex-end">↧ ใส่ OT</button>
  </div>
  <div class="ottotal" id="wt-calc"></div>
  <div class="sat-presets">
    <span class="preset-label">⚡ Quick:</span>
    <button class="preset-btn" onclick="satPreset(0,1,0,0);return false"><span>→19:30</span><small>1×1.5</small></button>
    <button class="preset-btn" onclick="satPreset(0,1.5,0,0);return false"><span>→20:00</span><small>1.5×1.5</small></button>
    <button class="preset-btn" onclick="satPreset(0,2,0,0);return false"><span>→20:30</span><small>2×1.5</small></button>
    <button class="preset-btn" onclick="satPreset(0,2.5,0,0);return false"><span>→21:00</span><small>2.5×1.5</small></button>
    <button class="preset-btn" onclick="satPreset(0,3,0,0);return false"><span>→21:30</span><small>3×1.5</small></button>
    <button class="preset-btn" onclick="satPreset(0,3.5,0,0);return false"><span>→22:00</span><small>3.5×1.5</small></button>
    <button class="preset-btn" onclick="satPreset(0,4,0,0);return false"><span>→22:30</span><small>4×1.5</small></button>
    <button class="preset-btn preset-clear" onclick="satPreset(0,0,0,0);return false">✕ Clear</button>
  </div>`;
        } else if (isSat && !d.isHoliday) {
          html += `<div class="sat-presets" style="margin-bottom:6px">
    <span class="preset-label">🕐 คำนวณจากเวลาออก-เข้างาน (วันเสาร์ 1× + 3×)</span>
  </div>
  <div class="leave-times">
    <label class="leave-fld">เข้า<input type="time" class="otinp" id="wt-in" value="${d.workIn || ''}"></label>
    <label class="leave-fld">ออก<input type="time" class="otinp" id="wt-out" data-otkind="sat" value="${d.workOut || ''}" oninput="otFromTime(true)"></label>
    <button class="preset-btn" onclick="otFromTime(true);return false" style="align-self:flex-end">↧ ใส่ OT</button>
  </div>
  <div class="ottotal" id="wt-calc"></div>
  <div class="sat-presets">
    <span class="preset-label">⚡ Quick:</span>
    <button class="preset-btn" onclick="satPreset(9,0,0,0);return false"><span>→18:30</span><small>9h×1</small></button>
    <button class="preset-btn" onclick="satPreset(9,0,0,1);return false"><span>→19:30</span><small>9×1+1×3</small></button>
    <button class="preset-btn" onclick="satPreset(9,0,0,1.5);return false"><span>→20:00</span><small>9×1+1.5×3</small></button>
    <button class="preset-btn" onclick="satPreset(9,0,0,2);return false"><span>→20:30</span><small>9×1+2×3</small></button>
    <button class="preset-btn" onclick="satPreset(9,0,0,2.5);return false"><span>→21:00</span><small>9×1+2.5×3</small></button>
    <button class="preset-btn" onclick="satPreset(9,0,0,3);return false"><span>→21:30</span><small>9×1+3×3</small></button>
    <button class="preset-btn" onclick="satPreset(9,0,0,3.5);return false"><span>→22:00</span><small>9×1+3.5×3</small></button>
    <button class="preset-btn" onclick="satPreset(9,0,0,4);return false"><span>→22:30</span><small>9×1+4×3</small></button>
    <button class="preset-btn preset-clear" onclick="satPreset(0,0,0,0);return false">✕ Clear</button>
  </div>`;
        }
        const order = d.isHoliday ? ["1", "1.5", "2", "3"] : ["1.5", "1", "2", "3"];
        for (const r of order) {
          const h = Number(d.ot[r]) || 0, pay = h * HOURLY * Number(r);
          html += `<div class="otrow">
        <span class="otlabel">${rinfo[r]}</span>
        <input type="number" class="otinp" id="ot-${r}" value="${h || ''}" min="0" max="24" step="0.5" placeholder="0" oninput="updOT()">
        <span class="otunit">h</span>
        <span class="otprev" id="op-${r}">${h > 0 ? '฿' + fmt(pay) : ''}</span>
      </div>`;
        }
        html += `<div class="ottotal" id="ot-tot"></div></div>`;
        if (isPrev) html += `<div class="info-box">ℹ️ This day is from the previous calendar month but falls within ${MONTHS[M - 1]} ${Y}'s OT period.</div>`;
      } else if (isSun) {
        html += `<div class="trow">
      <div><div class="tl">❌ Absent (deduct salary)</div><div class="td">Mark this Sunday as an absence — daily rate will be deducted</div></div>
      <label class="sw"><input type="checkbox" id="chk-sun-absent" ${d.sunAbsent ? 'checked' : ''}><span class="sw-sl"></span></label>
    </div>
    <div class="info-box">Sundays have no travel allowance and no OT.</div>`;
      } else if (!inOT) {
        html += `<div class="info-box">This day is outside the OT period (25th prev – 24th curr). OT for this day belongs to next month's calculation.</div>`;
      }

      html += `<div class="note-sect">
    <label class="note-label" for="day-note">📝 Note</label>
    <textarea id="day-note" class="note-inp" placeholder="Add a note for this day…" rows="3">${d.note || ''}</textarea>
  </div>
  <div class="mactions">
    <button class="btn btn-c" onclick="closeModal()">Cancel</button>
    <button class="btn btn-p" onclick="saveDay()">Save</button>
  </div>`;

      document.getElementById('mcontent').innerHTML = html;

      const chkHol = document.getElementById('chk-hol');
      if (chkHol) chkHol.addEventListener('change', () => {
        const wr = document.getElementById('wrow');
        if (wr) wr.style.display = chkHol.checked ? 'none' : '';
        const sr = document.getElementById('sarow');
        if (sr) sr.style.display = chkHol.checked ? 'none' : '';
        const lr = document.getElementById('lrow');
        if (lr) lr.style.display = chkHol.checked ? 'none' : '';
        const ld = document.getElementById('leave-detail');
        const cle = document.getElementById('chk-leave');
        if (ld) ld.style.display = (chkHol.checked || !cle || !cle.checked) ? 'none' : '';
        const ar = document.getElementById('abrow');
        if (ar) ar.style.display = chkHol.checked ? 'none' : '';
        const ad = document.getElementById('absent-detail');
        const cab = document.getElementById('chk-absent');
        if (ad) ad.style.display = (chkHol.checked || !cab || !cab.checked) ? 'none' : '';
        const ltr = document.getElementById('laterow');
        if (ltr) ltr.style.display = chkHol.checked ? 'none' : '';
        updOT();
      });

      const chkWrk = document.getElementById('chk-wrk');
      const chkLeave = document.getElementById('chk-leave');
      if (chkLeave) chkLeave.addEventListener('change', () => {
        // New leave defaults to a full day; unchecking clears it
        leavePreset(chkLeave.checked ? 'full' : 'clear');
      });
      if (chkWrk) chkWrk.addEventListener('change', () => {
        // "Worked" cancels a full-day leave (mutually exclusive); partial leave coexists
        const he = document.getElementById('leave-hours');
        const h = he ? (parseFloat(he.value) || 0) : 0;
        if (chkWrk.checked && h >= 9) leavePreset('clear');
      });
      const chkAbsent = document.getElementById('chk-absent');
      if (chkAbsent) chkAbsent.addEventListener('change', () => {
        // New absence defaults to a full day; unchecking clears it
        absentPreset(chkAbsent.checked ? 'full' : 'clear');
      });

      document.getElementById('mbg').classList.add('open');
      updOT();
      updLeave();
      updAbsent();
      otFromTime(false);
    }

    function satPreset(h1, h15, h2, h3) {
      const vals = { "1": h1, "1.5": h15, "2": h2, "3": h3 };
      for (const [r, v] of Object.entries(vals)) {
        const el = document.getElementById(`ot-${r}`);
        if (el) el.value = v > 0 ? v : '';
      }
      updOT();
    }

    function updOT() {
      let total = 0;
      for (const r of ["1", "1.5", "2", "3"]) {
        const el = document.getElementById(`ot-${r}`);
        if (!el) continue;
        const h = parseFloat(el.value) || 0, pay = h * HOURLY * Number(r);
        total += pay;
        const pe = document.getElementById(`op-${r}`);
        if (pe) pe.textContent = h > 0 ? '฿' + fmt(pay) : '';
      }
      const te = document.getElementById('ot-tot');
      if (te) te.textContent = total > 0 ? `OT subtotal: ฿${fmt(total)}` : '';
    }

    // OT hours past the 18:30 cutoff from a clock-out time. A normal day ends at 18:30;
    // OT accrues 0.5h per completed 30 min after that (floored). This matches the
    // presets exactly — weekday →19:30=1h/→20:00=1.5h/→20:30=2h at 1.5×, and the same
    // overflow drives the Saturday 3× bucket (→19:30=+1×3, →20:00=+1.5×3 …). Clock-in is
    // recorded but NOT used: arriving late is a separate lateMin deduction and must not
    // reduce OT. This is a provisional estimate for when HR hasn't approved OT yet —
    // an HR import later overwrites it with the real approved minutes.
    function otHoursFromClockOut(outStr) {
      if (!outStr || typeof outStr !== 'string') return 0;
      const m = outStr.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return 0;
      const out = (+m[1]) * 60 + (+m[2]);
      const base = 18 * 60 + 30; // normal day ends 18:30
      if (out <= base) return 0;
      return Math.floor((out - base) / 30) * 0.5;
    }

    // apply=true (on time-input): fill the OT fields from the clock-out estimate.
    // apply=false (on modal open): only refresh the readout — never overwrite an OT
    // value that may have come from an HR import.
    // kind (data-otkind on the clock-out input): 'sat' = working a rest-day Saturday
    // (9h base at 1× + overflow at 3×, mirrors satPreset(9,0,0,X)); else weekday 1.5×.
    function otFromTime(apply) {
      const outEl = document.getElementById('wt-out');
      const calcEl = document.getElementById('wt-calc');
      if (!outEl) return;
      const outV = outEl.value;
      if (!outV) { if (calcEl) calcEl.textContent = ''; return; }
      const h = otHoursFromClockOut(outV); // hours past 18:30
      const kind = outEl.dataset.otkind || 'wkd';
      if (kind === 'sat') {
        // Working a Saturday at all = full standard day (9h) at 1×, plus overflow at 3×.
        if (apply) {
          const f1 = document.getElementById('ot-1');
          const f3 = document.getElementById('ot-3');
          if (f1) f1.value = 9;
          if (f3) f3.value = h > 0 ? h : '';
          updOT();
        }
        if (calcEl) calcEl.textContent = h > 0
          ? `≈ 9 ชม. (1×) + OT ${h} ชม. (3×) — ถือว่าทำเต็มวันเสาร์ ประมาณการก่อน HR อนุมัติ`
          : `≈ 9 ชม. (1×) ทำงานวันเสาร์ — ประมาณการก่อน HR อนุมัติ`;
      } else {
        if (apply) {
          const f15 = document.getElementById('ot-1.5');
          if (f15) f15.value = h > 0 ? h : '';
          updOT();
        }
        if (calcEl) calcEl.textContent = h > 0
          ? `≈ OT ${h} ชม. (1.5×) — ประมาณการก่อน HR อนุมัติ จะถูกแทนที่เมื่อ import`
          : `ออกงานไม่เกิน 18:30 — ไม่มี OT`;
      }
    }

    // Quick-fill leave: 'full' (9h, day off), 'half' (4h, still worked), 'clear' (none)
    function leavePreset(kind) {
      const det = document.getElementById('leave-detail');
      const chkLeave = document.getElementById('chk-leave');
      const chkWrk = document.getElementById('chk-wrk');
      const hoursEl = document.getElementById('leave-hours');
      const startEl = document.getElementById('leave-start-t');
      const endEl = document.getElementById('leave-end-t');
      if (kind === 'clear') {
        if (hoursEl) hoursEl.value = '';
        if (startEl) startEl.value = '';
        if (endEl) endEl.value = '';
        if (chkLeave) chkLeave.checked = false;
        if (det) det.style.display = 'none';
        // If the day was a leave day, clearing reverts it to a normal worked weekday;
        // otherwise restore whatever worked/absent state it had when the modal opened.
        if (chkWrk) chkWrk.checked = _editHadLeave ? true : _editWorkedOrig;
        updLeave();
        return;
      }
      if (chkLeave) chkLeave.checked = true;
      if (det) det.style.display = '';
      clearAbsentUI(); // leave and absent are mutually exclusive
      if (kind === 'full') {
        if (hoursEl) hoursEl.value = 9;
        if (startEl) startEl.value = '08:00';
        if (endEl) endEl.value = '18:00';
        if (chkWrk) chkWrk.checked = false; // full day off
      } else if (kind === 'half') {
        if (hoursEl) hoursEl.value = 4;
        if (startEl) startEl.value = '08:00';
        if (endEl) endEl.value = '12:00';
        if (chkWrk) chkWrk.checked = true; // worked the other half
      }
      updLeave();
    }

    function updLeave() {
      const hoursEl = document.getElementById('leave-hours');
      if (!hoursEl) return;
      let h = parseFloat(hoursEl.value);
      if (isNaN(h)) h = 0;
      if (h > 9) { h = 9; hoursEl.value = 9; }
      if (h < 0) { h = 0; hoursEl.value = ''; }
      const chkWrk = document.getElementById('chk-wrk');
      if (chkWrk && h >= 9) chkWrk.checked = false; // a full day off can't be worked
      const tot = document.getElementById('leave-tot');
      if (tot) tot.textContent = h > 0
        ? `Leave: ${h}h — ${h >= 9 ? 'full day, not counted as worked' : 'partial, still counts as worked'}`
        : '';
    }

    // Clear the leave / absent sub-panels (used for mutual exclusivity). These only
    // touch their own controls — they never change the Worked toggle.
    function clearLeaveUI() {
      const c = document.getElementById('chk-leave'), d = document.getElementById('leave-detail'), h = document.getElementById('leave-hours');
      const s = document.getElementById('leave-start-t'), e = document.getElementById('leave-end-t');
      if (c) c.checked = false;
      if (d) d.style.display = 'none';
      if (h) h.value = '';
      if (s) s.value = '';
      if (e) e.value = '';
      updLeave();
    }
    function clearAbsentUI() {
      const c = document.getElementById('chk-absent'), d = document.getElementById('absent-detail'), h = document.getElementById('absent-hours');
      if (c) c.checked = false;
      if (d) d.style.display = 'none';
      if (h) h.value = '';
      updAbsent();
    }

    // Quick-fill absent hours: 'full' (9h), 'half' (4h), 'clear' (none). Absent hours
    // are a record only — they do not change the Worked flag or add a deduction here.
    function absentPreset(kind) {
      const det = document.getElementById('absent-detail');
      const chkAbsent = document.getElementById('chk-absent');
      const hoursEl = document.getElementById('absent-hours');
      if (kind === 'clear') {
        if (hoursEl) hoursEl.value = '';
        if (chkAbsent) chkAbsent.checked = false;
        if (det) det.style.display = 'none';
        updAbsent();
        return;
      }
      if (chkAbsent) chkAbsent.checked = true;
      if (det) det.style.display = '';
      clearLeaveUI(); // absent and leave are mutually exclusive
      if (hoursEl) hoursEl.value = (kind === 'half') ? 4 : 9;
      updAbsent();
    }

    function updAbsent() {
      const hoursEl = document.getElementById('absent-hours');
      if (!hoursEl) return;
      let h = parseFloat(hoursEl.value);
      if (isNaN(h)) h = 0;
      if (h > 9) { h = 9; hoursEl.value = 9; }
      if (h < 0) { h = 0; hoursEl.value = ''; }
      const tot = document.getElementById('absent-tot');
      if (tot) tot.textContent = h > 0 ? `ขาดงาน: ${h} ชม. (บันทึก — หักเงินอิงนาทีสาย)` : '';
    }

    function saveDay() {
      if (!editDate) return;
      const d = gd(editDate);
      const ch = document.getElementById('chk-hol'); if (ch) d.isHoliday = ch.checked;
      // Leave (weekday only): hours are the source of truth; a full day (9h) means not worked.
      const lhEl = document.getElementById('leave-hours');
      if (lhEl) {
        let lh = parseFloat(lhEl.value) || 0;
        if (lh < 0) lh = 0;
        if (lh > 9) lh = 9;
        if (d.isHoliday) lh = 0; // a holiday can't also be leave
        d.leaveHours = lh;
        d.leave = lh > 0;
        const se = document.getElementById('leave-start-t'); d.leaveStart = (lh > 0 && se) ? se.value : '';
        const ee = document.getElementById('leave-end-t'); d.leaveEnd = (lh > 0 && ee) ? ee.value : '';
      }
      // Absent hours (weekday only): a recorded figure, no deduction taken from it here.
      const ahEl = document.getElementById('absent-hours');
      if (ahEl) {
        let ah = parseFloat(ahEl.value) || 0;
        if (ah < 0) ah = 0;
        if (ah > 9) ah = 9;
        if (d.isHoliday) ah = 0;
        d.absentHours = ah;
      }
      const cw = document.getElementById('chk-wrk'); if (cw) d.worked = (Number(d.leaveHours) >= 9) ? false : cw.checked;
      const csa = document.getElementById('chk-sat-absent'); if (csa) d.satAbsent = csa.checked;
      const csu = document.getElementById('chk-sun-absent'); if (csu) d.sunAbsent = csu.checked;
      const lm = document.getElementById('late-min'); if (lm) d.lateMin = parseFloat(lm.value) || 0;
      for (const r of ["1", "1.5", "2", "3"]) {
        const el = document.getElementById(`ot-${r}`);
        if (el) d.ot[r] = parseFloat(el.value) || 0;
      }
      // Clock in/out are advisory (used only to estimate OT); persist when shown.
      const wi = document.getElementById('wt-in'); if (wi) d.workIn = wi.value || '';
      const wo = document.getElementById('wt-out'); if (wo) d.workOut = wo.value || '';
      const noteEl = document.getElementById('day-note');
      if (noteEl) d.note = noteEl.value.trim();
      mdata.days[editDate] = d;
      closeModal(); renderAll(); save();
    }

    function closeModal() { document.getElementById('mbg').classList.remove('open'); editDate = null; }
    function bgClick(e) { if (e.target === document.getElementById('mbg')) closeModal(); }

