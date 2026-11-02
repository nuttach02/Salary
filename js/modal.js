    // ── MODAL ──────────────────────────────────────────────────────────────────
    function openModal(ds) {
      if (!monthReady()) { showToast('กำลังโหลดเดือน… ลองใหม่อีกครั้ง'); return; }
      editDate = ds;
      const d = gd(ds);
      _editDayOrig = JSON.parse(JSON.stringify(d));
      _editWorkedOrig = d.worked;
      _editHadLeave = leaveHrsOf(d) > 0;
      _editHadAbsentFull = absentHrsOf(d) >= 9;
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

      const typeEl = document.getElementById('mtype');
      typeEl.textContent = typeLabel;
      typeEl.className = `mtype ${typeCls}`;
      document.getElementById('modal').classList.toggle('dm-narrow', !inOT);

      // Status chips: each wraps its checkbox, so saveDay and the listeners below read the
      // same ids as before. Rows keep their ids for the holiday toggle.
      const chip = (inputId, rowId, kind, label, on, hidden) => `<label class="dchip dchip-${kind}"${rowId ? ` id="${rowId}"` : ''}${hidden ? ' style="display:none"' : ''}>
      <input type="checkbox" id="${inputId}" ${on ? 'checked' : ''}><span class="tl">${label}</span>
    </label>`;
      // Hour quick-picks shared by the leave and absent panels
      const hrBtns = (fn, cur) => [[0.5, '½ ชม.'], [1, '1 ชม.'], [2, '2 ชม.'], [4, 'ครึ่งวัน'], [9, 'ทั้งวัน']]
        .map(([h, l]) => `<button class="preset-btn${cur === h ? ' active' : ''}" data-h="${h}" onclick="${fn}(${h});return false">${l}</button>`).join('');

      let tiles = chip('chk-wrk', 'wrow', 'ok', 'มาทำงาน', d.worked, d.isHoliday)
        + chip('chk-night', 'nrow', 'night', 'กะดึก', d.nightShift, false);
      if (!isSun) tiles += chip('chk-hol', '', 'hol', 'วันหยุด', d.isHoliday, false);

      let details = '';
      if (isWkd) {
        const lh = leaveHrsOf(d);
        const isLeave = lh > 0;
        const lt = leaveTypeOf(d);
        tiles += chip('chk-leave', 'lrow', 'leave', 'ลา', isLeave, d.isHoliday);
        details += `<div class="leave-detail" id="leave-detail"${(isLeave && !d.isHoliday) ? '' : ' style="display:none"'}>
      <div class="lt-row">
        <span class="preset-label">ประเภท:</span>
        <button class="lt-btn${lt === 'personal' ? ' active' : ''}" data-lt="personal" onclick="setLeaveType('personal');return false">🧳 ลากิจ Personal</button>
        <button class="lt-btn${lt === 'sick' ? ' active' : ''}" data-lt="sick" onclick="setLeaveType('sick');return false">🤒 ลาป่วย Sick</button>
      </div>
      <div class="dm-hrs" id="leave-hrs">${hrBtns('leavePreset', lh)}</div>
      <div class="leave-times">
        <label class="leave-fld">Start<input type="time" class="otinp" id="leave-start-t" value="${d.leaveStart || ''}"></label>
        <label class="leave-fld">End<input type="time" class="otinp" id="leave-end-t" value="${d.leaveEnd || ''}"></label>
        <label class="leave-fld">Hours<input type="number" class="otinp" id="leave-hours" value="${lh || ''}" min="0" max="9" step="0.5" placeholder="0" oninput="updLeave()"></label>
      </div>
      <div class="ottotal" id="leave-tot"></div>
    </div>`;

        const ah = absentHrsOf(d);
        const isAbsent = ah > 0;
        tiles += chip('chk-absent', 'abrow', 'bad', 'ขาดงาน', isAbsent, d.isHoliday);
        details += `<div class="leave-detail dm-abs-detail" id="absent-detail"${(isAbsent && !d.isHoliday) ? '' : ' style="display:none"'}>
      <div class="dm-hrs" id="absent-hrs">${hrBtns('absentPreset', ah)}</div>
      <div class="leave-times">
        <label class="leave-fld">ชั่วโมงขาด<input type="number" class="otinp" id="absent-hours" value="${ah || ''}" min="0" max="9" step="0.5" placeholder="0" oninput="updAbsent(true)"></label>
      </div>
      <div class="ottotal" id="absent-tot"></div>
    </div>`;
      }

      if (isSat) tiles += chip('chk-sat-absent', 'sarow', 'bad', 'ขาดงาน', d.satAbsent, d.isHoliday);
      if (isSun) tiles += chip('chk-sun-absent', '', 'bad', 'ขาดงาน', d.sunAbsent, false);

      if (isWkd || isSat) {
        const late = Number(d.lateMin) > 0;
        tiles += chip('chk-late', 'laterow', 'bad', 'มาสาย', late, d.isHoliday);
        details += `<label class="leave-detail dm-late" id="late-detail"${(late && !d.isHoliday) ? '' : ' style="display:none"'}>
      <span>มาสายกี่นาที <small>฿${fmt(BASE / 30 / 9 / 60)}/นาที</small></span>
      <input type="number" class="otinp" id="late-min" value="${d.lateMin || ''}" min="0" step="1" placeholder="0" inputmode="numeric" oninput="updAbsent()">
    </label>`;
      }

      let html = `<div class="dm-body">
    <section class="dm-status">
      <h4 class="dm-h">สถานะวันนี้</h4>
      <div class="dm-chips">${tiles}</div>
      <div class="dm-hint" id="dm-hint"></div>
      ${details}
    </section>`;

      if (inOT) {
        const rinfo = { "1.5": ["OT ปกติ", "1.5× Weekday OT"], "1": ["วันหยุด", "1× Holiday pay"], "2": ["OT หยุด", "2× Holiday OT"], "3": ["OT หยุด", "3× Holiday OT"] };
        const showClock = !d.isHoliday;
        const isRest = isSat || isSun;
        const hint = !showClock ? 'วันหยุด' : isRest ? `วัน${isSun ? 'อาทิตย์' : 'เสาร์'} 1× + 3×` : 'วันปกติ 1.5×';
        html += `<section class="dm-ot"><h4 class="dm-h">⏱ OT Hours <small>${hint}</small></h4>`;
        if (showClock) {
          html += `<div class="dm-times">
    <label class="leave-fld">เข้า<input type="time" class="otinp" id="wt-in" value="${d.workIn || ''}"></label>
    <label class="leave-fld">ออก<input type="time" class="otinp" id="wt-out" data-otkind="${isRest ? 'sat' : 'wkd'}"${isRest ? ` data-dayname="${isSun ? 'อาทิตย์' : 'เสาร์'}"` : ''} value="${d.workOut || ''}" oninput="otFromTime(true)"></label>
  </div>
  <div class="dm-calc" id="wt-calc"></div>
  <div class="dm-presets" id="ot-presets">${otPresetButtons(isRest, !!d.nightShift)}</div>`;
        }
        const order = d.isHoliday ? ["1", "1.5", "2", "3"] : ["1.5", "1", "2", "3"];
        html += `<div class="dm-rates">`;
        for (const r of order) {
          const h = Number(d.ot[r]) || 0, pay = h * HOURLY * Number(r);
          html += `<label class="dm-rate" title="${rinfo[r][1]}">
        <span class="dm-rate-lbl">${r}×<small>${rinfo[r][0]}</small></span>
        <input type="number" class="otinp" id="ot-${r}" value="${h || ''}" min="0" max="24" step="0.5" placeholder="0" inputmode="decimal" oninput="updOT()">
        <span class="otprev" id="op-${r}">${h > 0 ? '฿' + fmt(pay) : ''}</span>
      </label>`;
        }
        html += `</div>`;
        if (isPrev) html += `<div class="info-box">ℹ️ This day is from the previous calendar month but falls within ${MONTHS[M - 1]} ${Y}'s OT period.</div>`;
        html += `</section>`;
      } else {
        html += `<div class="info-box dm-outside">This day is outside the OT period (25th prev – 24th curr). OT for this day belongs to next month's calculation.</div>`;
      }

      html += `<div class="note-sect dm-note">
    <label class="note-label" for="day-note">📝 Note</label>
    <textarea id="day-note" class="note-inp" placeholder="Add a note for this day…" rows="2">${d.note || ''}</textarea>
  </div>
  </div>
  <div class="dm-foot">
    <div class="dm-total" id="ot-tot"></div>
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
        const ltd = document.getElementById('late-detail');
        const clt = document.getElementById('chk-late');
        if (ltd) ltd.style.display = (chkHol.checked || !clt || !clt.checked) ? 'none' : '';
        updOT();
      });

      const chkLate = document.getElementById('chk-late');
      if (chkLate) chkLate.addEventListener('change', () => {
        const ltd = document.getElementById('late-detail'), lm = document.getElementById('late-min');
        if (ltd) ltd.style.display = chkLate.checked ? '' : 'none';
        if (lm) { if (chkLate.checked) lm.focus(); else lm.value = ''; }
        updAbsent();
      });

      const chkNight = document.getElementById('chk-night');
      if (chkNight) chkNight.addEventListener('change', () => {
        // Same hours either way; only the clock times on the buttons and the readout move
        const presets = document.getElementById('ot-presets');
        if (presets) presets.innerHTML = otPresetButtons(isSat || isSun, chkNight.checked);
        updOT();
        otFromTime(false);
      });

      const chkWrk = document.getElementById('chk-wrk');
      const chkLeave = document.getElementById('chk-leave');
      if (chkLeave) chkLeave.addEventListener('change', () => {
        // New leave defaults to a full day; unchecking clears it
        leavePreset(chkLeave.checked ? 'full' : 'clear');
      });
      if (chkWrk) chkWrk.addEventListener('change', () => {
        // "Worked" cancels a full-day leave or absence (mutually exclusive); partial ones coexist
        const he = document.getElementById('leave-hours');
        const h = he ? (parseFloat(he.value) || 0) : 0;
        if (chkWrk.checked && h >= 9) leavePreset('clear');
        const ae = document.getElementById('absent-hours');
        if (chkWrk.checked && ae && (parseFloat(ae.value) || 0) >= 9) clearAbsentUI();
      });
      const chkAbsent = document.getElementById('chk-absent');
      if (chkAbsent) chkAbsent.addEventListener('change', () => {
        // New absence defaults to a full day; unchecking clears it
        absentPreset(chkAbsent.checked ? 'full' : 'clear');
      });
      // Listeners on the chips themselves run first; the hint then reads the settled state
      const statusSec = document.querySelector('.dm-status');
      if (statusSec) statusSec.addEventListener('change', updStatusHint);

      document.getElementById('mbg').classList.add('open');
      updOT();
      updLeave();
      updAbsent();
      otFromTime(false);
    }

    // One line under the chips saying what today's status does to pay
    function updStatusHint() {
      const el = document.getElementById('dm-hint');
      if (!el) return;
      const on = id => { const e = document.getElementById(id); return !!(e && e.checked); };
      const num = id => { const e = document.getElementById(id); return e ? (parseFloat(e.value) || 0) : 0; };
      const lh = on('chk-leave') ? num('leave-hours') : 0, ah = on('chk-absent') ? num('absent-hours') : 0;
      const restDay = !!(document.getElementById('chk-sat-absent') || document.getElementById('chk-sun-absent'));
      const day = `฿${fmt(BASE / 30)}`;
      el.textContent = on('chk-hol') ? 'วันหยุดนักขัตฤกษ์ — ได้เงินเดือนเต็ม ทำงานใช้เรท 1× / 2× / 3×'
        : (on('chk-sat-absent') || on('chk-sun-absent') || ah >= 9) ? `ขาดทั้งวัน — หัก 1 วัน ${day} ไม่มีค่าเดินทาง`
        : lh >= 9 ? 'ลาทั้งวัน — ไม่หักเงิน ไม่มีค่าเดินทาง'
        : on('chk-wrk') ? `มาทำงาน — ได้ค่าเดินทาง ฿${TRAVEL}${on('chk-night') ? ` + ค่ากะดึก ฿${NIGHT_ALLOWANCE}` : ''}${lh > 0 ? ` · ลา ${lh} ชม. ไม่หักเงิน` : ''}${ah > 0 ? ` · ขาด ${ah} ชม.` : ''}`
        : lh > 0 ? `ลา ${lh} ชม. — ไม่หักเงิน`
        : restDay ? 'วันหยุดประจำสัปดาห์ — กด "มาทำงาน" ถ้าเข้ามาทำ'
        : `ไม่ได้มาทำงาน — หัก 1 วัน ${day}`;
    }

    // Quick-fill buttons: OT hours labelled with the clock-out that earns them on this shift.
    function otPresetButtons(isRestDay, night) {
      const shiftEnd = (night ? 6 : 18) * 60 + 30;
      const clockAt = h => {
        const t = (shiftEnd + h * 60) % (24 * 60);
        return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
      };
      const btn = (h, ot, sub) => `<button class="preset-btn" data-ot="${ot}" onclick="satPreset(${ot});return false"><span>${clockAt(h)}</span><small>${sub}</small></button>`;
      const hours = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5];
      const buttons = isRestDay
        ? [btn(0, '9,0,0,0', '9 ชม.'), ...hours.map(h => btn(h, `9,0,0,${h}`, `9 + ${h}×3`))]
        : hours.map(h => btn(h, `0,${h},0,0`, `${h} ชม.`));
      return `<div class="dm-qhead">
      <span class="preset-label">⚡ Quick · เวลาออกงาน</span>
      <button class="dm-clear" onclick="satPreset(0,0,0,0);return false">✕ Clear</button>
    </div>
    <div class="dm-qgrid">${buttons.join('')}</div>`;
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
      if (te) te.textContent = total > 0 ? `OT +฿${fmt(total)}` : '';
      // Light up the preset these hours match, so a tap (or a typed value) shows its result
      const cur = ["1", "1.5", "2", "3"].map(r => {
        const el = document.getElementById(`ot-${r}`);
        return el ? (parseFloat(el.value) || 0) : 0;
      }).join(',');
      document.querySelectorAll('#ot-presets [data-ot]').forEach(b => b.classList.toggle('active', b.dataset.ot === cur));
    }

    // OT hours past the 18:30 cutoff from a clock-out time. A normal day ends at 18:30;
    // OT accrues 0.5h per completed 30 min after that (floored). This matches the
    // presets exactly — weekday →19:30=1h/→20:00=1.5h/→20:30=2h at 1.5×, and the same
    // overflow drives the Saturday 3× bucket (→19:30=+1×3, →20:00=+1.5×3 …). Clock-in is
    // recorded but NOT used: arriving late is a separate lateMin deduction and must not
    // reduce OT. This is a provisional estimate for when HR hasn't approved OT yet —
    // an HR import later overwrites it with the real approved minutes.
    // A night shift (20:00–06:00) runs the same way from a 06:30 cutoff the next morning.
    function otHoursFromClockOut(outStr, night = false) {
      const out = clockOutMinutes(outStr, night);
      if (out === null) return 0;
      const base = (night ? 30 : 18) * 60 + 30; // shift ends 18:30, or 06:30 next morning
      if (out <= base) return 0;
      return Math.floor((out - base) / 30) * 0.5;
    }

    // Clock-out as minutes from midnight on the day the shift started. A time before the
    // cutoff is the next day: before 06:00 on a day shift (00:00 = 24:00), before 18:00 on
    // a night shift (which starts at 20:00).
    function clockOutMinutes(outStr, night) {
      const m = String(outStr || '').match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return null;
      const t = (+m[1]) * 60 + (+m[2]);
      return t < (night ? 18 : 6) * 60 ? t + 24 * 60 : t;
    }

    // A Saturday or Sunday clock-out from 18:00 (06:00 next morning on a night shift) counts
    // as a full day (9h at 1×). Earlier clock-outs get no estimate — the OT stays whatever
    // was typed until HR approves. Shared with classifyImportRow so both entry paths agree.
    function isFullRestDayOut(outStr, night = false) {
      const out = clockOutMinutes(outStr, night);
      return out !== null && out >= (night ? 30 : 18) * 60;
    }

    // apply=true (on time-input): fill the OT fields from the clock-out estimate.
    // apply=false (on modal open): only refresh the readout — never overwrite an OT
    // value that may have come from an HR import.
    // kind (data-otkind on the clock-out input): 'sat' = working a rest-day Saturday or Sunday
    // (9h base at 1× + overflow at 3×, mirrors satPreset(9,0,0,X)); else weekday 1.5×.
    function otFromTime(apply) {
      const outEl = document.getElementById('wt-out');
      const calcEl = document.getElementById('wt-calc');
      if (!outEl) return;
      const outV = outEl.value;
      if (!outV) { if (calcEl) calcEl.textContent = ''; return; }
      const nightEl = document.getElementById('chk-night');
      const night = !!(nightEl && nightEl.checked);
      const h = otHoursFromClockOut(outV, night); // hours past the shift's cutoff
      const kind = outEl.dataset.otkind || 'wkd';
      if (kind === 'sat') {
        // Full rest day = 9h at 1× plus overflow at 3×; an earlier clock-out only clears
        // what this field itself filled in (e.g. while correcting a typo), never typed OT.
        const full = isFullRestDayOut(outV, night);
        const dayName = outEl.dataset.dayname || 'เสาร์';
        if (apply) {
          const f1 = document.getElementById('ot-1');
          const f3 = document.getElementById('ot-3');
          if (full) {
            if (f1) f1.value = 9;
            if (f3) f3.value = h > 0 ? h : '';
            outEl.dataset.autofilled = '1';
            updOT();
          } else if (outEl.dataset.autofilled) {
            if (f1) f1.value = '';
            if (f3) f3.value = '';
            delete outEl.dataset.autofilled;
            updOT();
          }
        }
        if (calcEl) calcEl.textContent = !full
          ? `ออกก่อน ${night ? '06:00' : '18:00'} — ไม่ประมาณ OT กรอกเองหรือรอ HR อนุมัติ`
          : h > 0
          ? `≈ 9 ชม. (1×) + OT ${h} ชม. (3×) — ถือว่าทำเต็มวัน${dayName} ประมาณการก่อน HR อนุมัติ`
          : `≈ 9 ชม. (1×) ทำงานวัน${dayName} — ประมาณการก่อน HR อนุมัติ`;
      } else {
        if (apply) {
          const f15 = document.getElementById('ot-1.5');
          if (f15) f15.value = h > 0 ? h : '';
          updOT();
        }
        if (calcEl) calcEl.textContent = h > 0
          ? `≈ OT ${h} ชม. (1.5×) — ประมาณการก่อน HR อนุมัติ จะถูกแทนที่เมื่อ import`
          : `ออกงานไม่เกิน ${night ? '06:30' : '18:30'} — ไม่มี OT`;
      }
    }

    // Quick-fill leave: hours (9 = day off, less = still worked), 'full'/'half' (9/4), 'clear' (none)
    function leavePreset(kind) {
      if (kind === 'full') kind = 9;
      if (kind === 'half') kind = 4;
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
      // Ensure a leave type is selected (default sick) when enabling leave.
      if (!document.querySelector('#leave-detail .lt-btn.active')) setLeaveType('sick');
      // From 08:00, skipping the 12:00–13:00 lunch hour; a full day runs to 18:00
      const h = Number(kind) || 0;
      const endMin = 8 * 60 + h * 60 + (h > 4 ? 60 : 0);
      if (hoursEl) hoursEl.value = h;
      if (startEl) startEl.value = '08:00';
      if (endEl) endEl.value = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      if (chkWrk) chkWrk.checked = h < 9; // a full day off isn't worked; a partial one is
      updLeave();
    }

    // Select the leave type (sick/personal) in the modal's leave panel — toggles the
    // active button; saveDay reads the active one. Purely UI state until save.
    function setLeaveType(t) {
      document.querySelectorAll('#leave-detail .lt-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.lt === t);
      });
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
      document.querySelectorAll('#leave-hrs [data-h]').forEach(b => b.classList.toggle('active', Number(b.dataset.h) === h));
      updStatusHint();
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

    // Quick-fill absent hours: hours (9 = whole day, not worked; less = still worked),
    // 'full'/'half' (9/4), 'clear' (none). calc() deducts a whole day through worked:false,
    // and a part day by the hours the late minutes don't already cover.
    function absentPreset(kind) {
      if (kind === 'full') kind = 9;
      if (kind === 'half') kind = 4;
      const det = document.getElementById('absent-detail');
      const chkAbsent = document.getElementById('chk-absent');
      const chkWrk = document.getElementById('chk-wrk');
      const hoursEl = document.getElementById('absent-hours');
      if (kind === 'clear') {
        if (hoursEl) hoursEl.value = '';
        if (chkAbsent) chkAbsent.checked = false;
        if (det) det.style.display = 'none';
        // A cleared whole-day absence becomes a normal worked day again
        if (chkWrk) chkWrk.checked = _editHadAbsentFull ? true : _editWorkedOrig;
        updAbsent();
        return;
      }
      if (chkAbsent) chkAbsent.checked = true;
      if (det) det.style.display = '';
      clearLeaveUI(); // absent and leave are mutually exclusive
      const h = Number(kind) || 0;
      if (hoursEl) hoursEl.value = h;
      if (chkWrk) chkWrk.checked = h < 9;
      updAbsent();
    }

    // typed=true when the hours field itself changed: only then does it move Worked, so opening
    // an older day never flips a flag the user set.
    function updAbsent(typed) {
      const hoursEl = document.getElementById('absent-hours');
      if (hoursEl) {
        let h = parseFloat(hoursEl.value);
        if (isNaN(h)) h = 0;
        if (h > 9) { h = 9; hoursEl.value = 9; }
        if (h < 0) { h = 0; hoursEl.value = ''; }
        const chkWrk = document.getElementById('chk-wrk');
        if (typed && chkWrk && h > 0) chkWrk.checked = h < 9; // a whole day absent isn't worked; a part day is
        const lateEl = document.getElementById('late-min');
        const late = lateEl ? (parseFloat(lateEl.value) || 0) : 0;
        const extra = Math.max(0, h * 60 - late) * (BASE / 30 / 9 / 60);
        const tot = document.getElementById('absent-tot');
        if (tot) tot.textContent = h >= 9 ? `ขาดทั้งวัน — หัก 1 วัน ฿${fmt(BASE / 30)}`
          : h > 0 ? `ขาด ${h} ชม. — หัก ฿${fmt(extra)}${late > 0 ? ` (หักเฉพาะส่วนที่เกินมาสาย ${late} นาที)` : ''}`
          : '';
        document.querySelectorAll('#absent-hrs [data-h]').forEach(b => b.classList.toggle('active', Number(b.dataset.h) === h));
      }
      updStatusHint();
    }

    function saveDay() {
      if (!editDate) return;
      const d = gd(editDate);
      const ch = document.getElementById('chk-hol'); if (ch) d.isHoliday = ch.checked;
      const cn = document.getElementById('chk-night'); if (cn) d.nightShift = cn.checked;
      // Leave (weekday only): hours are the source of truth; a full day (9h) means not worked.
      const lhEl = document.getElementById('leave-hours');
      if (lhEl) {
        let lh = parseFloat(lhEl.value) || 0;
        if (lh < 0) lh = 0;
        if (lh > 9) lh = 9;
        if (d.isHoliday) lh = 0; // a holiday can't also be leave
        d.leaveHours = lh;
        d.leave = lh > 0;
        if (lh > 0) {
          const ltb = document.querySelector('#leave-detail .lt-btn.active');
          d.leaveType = (ltb && ltb.dataset.lt === 'personal') ? 'personal' : 'sick';
        }
        const se = document.getElementById('leave-start-t'); d.leaveStart = (lh > 0 && se) ? se.value : '';
        const ee = document.getElementById('leave-end-t'); d.leaveEnd = (lh > 0 && ee) ? ee.value : '';
      }
      // Absent hours (weekday only): a whole day is worked:false below; calc() deducts a part day.
      const ahEl = document.getElementById('absent-hours');
      if (ahEl) {
        let ah = parseFloat(ahEl.value) || 0;
        if (ah < 0) ah = 0;
        if (ah > 9) ah = 9;
        if (d.isHoliday) ah = 0;
        d.absentHours = ah;
      }
      const cw = document.getElementById('chk-wrk'); if (cw) d.worked = (Number(d.leaveHours) >= 9 || Number(d.absentHours) >= 9) ? false : cw.checked;
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
      const otherWrites = mirrorDayEdit(editDate, _editDayOrig, d);
      closeModal(); renderAll(); save('Saved ✓', otherWrites);
    }

    // A day on the 25th+ lives in two month docs. Copy the fields this edit changed to the
    // other doc so its money follows; untouched fields stay, so a copy that already
    // diverged (e.g. OT held only in the next month) is never overwritten.
    function mirrorDayEdit(ds, before, after) {
      const patch = {};
      for (const k of Object.keys(after)) {
        if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) patch[k] = after[k];
      }
      if (!Object.keys(patch).length) return [];
      const curKey = monthKey(Y, M);
      return importTargetKeys(ds).filter(key => key !== curKey).map(key => writeDayPatch(key, { [ds]: patch }, curKey));
    }

    function closeModal() { document.getElementById('mbg').classList.remove('open'); editDate = null; }
    function bgClick(e) { if (e.target === document.getElementById('mbg')) closeModal(); }

