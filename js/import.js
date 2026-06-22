    // ── IMPORT (HR attendance HTML) ──────────────────────────────────────────────
    let pendingImport = null; // parsed rows awaiting confirmation
    let importDiff = null;    // per-day { ds, kind, patch, keys, curByKey, fpatch, changes[], changed }

    // Import category filter — which kinds of data to actually apply. Each category maps
    // to the patch keys it owns; unchecked categories are stripped from every day's patch
    // before the diff/preview and before writing (so they're never touched).
    const IMPORT_CATS = {
      late:    { label: 'สาย',     keys: ['lateMin'] },
      leave:   { label: 'ลา',      keys: ['leaveHours', 'worked'] },
      absent:  { label: 'ขาด',     keys: ['absentHours'] },
      ot:      { label: 'OT',      keys: ['ot'] },
      holiday: { label: 'วันหยุด', keys: ['isHoliday'] },
      time:    { label: 'เวลาเข้า-ออก', keys: ['workIn', 'workOut'] }
    };
    let importCats = { late: true, leave: true, absent: true, ot: true, holiday: true, time: true };

    // Strip patch keys whose category is unchecked. kind always rides along (diffPatch
    // ignores it). Returns a new patch; the original full patch is kept for re-filtering.
    function filterPatch(patch) {
      const out = { kind: patch.kind };
      for (const cat in IMPORT_CATS) {
        if (!importCats[cat]) continue;
        IMPORT_CATS[cat].keys.forEach(k => { if (k in patch) out[k] = patch[k]; });
      }
      return out;
    }

    // Recompute each day's filtered patch + diff against its cached current state for the
    // active category selection — no Firestore re-read (curByKey was cached upfront).
    // Run on first build and whenever a category checkbox is toggled.
    function refreshImportDiff() {
      if (!importDiff) return;
      importDiff.forEach(e => {
        e.fpatch = filterPatch(e.patch);
        let refCur = null;
        for (const key of e.keys) {
          if (diffPatch(e.curByKey[key], e.fpatch).length > 0) { refCur = e.curByKey[key]; break; }
        }
        e.changed = refCur !== null;
        e.changes = e.changed ? diffPatch(refCur, e.fpatch) : [];
      });
    }

    function toggleImportCat(cat) {
      importCats[cat] = !importCats[cat];
      refreshImportDiff();
      openImportPreview();
    }

    // 'YYYYMMDD' -> 'YYYY-MM-DD' (null if malformed)
    function hrDateToDs(wrkdat) {
      const s = String(wrkdat || '').trim();
      if (!/^\d{8}$/.test(s)) return null;
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }

    // HR clock time 'HHMM' (e.g. '0737', '2032') -> 'HH:MM'. '' for blank/malformed.
    function hrTimeToHm(s) {
      const t = String(s || '').trim();
      if (!/^\d{3,4}$/.test(t)) return '';
      const p = t.padStart(4, '0');
      const hh = +p.slice(0, 2), mm = +p.slice(2, 4);
      if (hh > 23 || mm > 59) return '';
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    }

    // Parse an OvertimeApplication.html export. Returns an array of day rows, or
    // null if the attendance table isn't found. Reads more fields than v1 uses so
    // future imports (OT/leave/swipe) are a small extension.
    function parseAttendanceHtml(htmlText) {
      const doc = new DOMParser().parseFromString(htmlText, 'text/html');
      const table = doc.getElementById('gvAttn');
      if (!table) return null;
      const rows = [];
      table.querySelectorAll('tr').forEach(tr => {
        const dateEl = tr.querySelector("[id$='gvlblWrkdat']");
        if (!dateEl) return; // skips the header row and any non-data rows
        const ds = hrDateToDs(dateEl.textContent);
        if (!ds) return;
        const latEl = tr.querySelector("[id$='gvlblLatmin']");
        const latmin = latEl ? (parseInt(latEl.textContent.trim(), 10) || 0) : 0;
        const txt = sel => { const e = tr.querySelector(sel); return e ? e.textContent.trim() : ''; };
        const num = sel => { const e = tr.querySelector(sel); return e ? (parseFloat(e.value) || 0) : 0; };
        rows.push({
          ds, latmin,
          absenthrs: parseFloat(txt("[id$='gvlblAbsenthrs']")) || 0, // hours of absence (decimal)
          leacod: txt("[id$='gvlblLeacod']"),                        // Take Leave: 'Y' / 'N'
          holcod: num("[id$='gvhdHolcod']"),                         // 1=workday(white) 2=weekend(pink) 3=public holiday(yellow)
          // OT minutes per rate bucket, from the hidden inputs (visible spans can be blank on
          // recent/pending days). Index 0→1×, 1→1.5×, 2→2×, 3→3×.
          otMin: [0, 1, 2, 3].map(i => num(`[id$='gvhdMin${i}']`)),
          emplid: txt("[id$='gvlblEmplid']"),
          swipeIn: txt("[id$='gvlblEntdat']"),
          swipeOut: txt("[id$='gvlblStwkhr']")
        });
      });
      return rows;
    }

    // Classify one HR day into the fields it should set (a "patch"). Only keys
    // present in the patch are applied; absent keys leave the day untouched.
    //  - Absent (Absenthrs>0): record absent hours; deduction follows late-minutes.
    //  - Take Leave = Y, no swipe-in: full-day leave (9h, not worked).
    //  - Take Leave = Y, with swipe-in: partial leave from a late arrival —
    //      hours = ceil((Latmin − 30)/30) × 0.5  (08:31→0.5h, 09:01→1h; ≤30→0), still worked.
    //  - Otherwise: a normal day; Latmin drives the existing late deduction.
    function classifyImportRow(r) {
      const L = Number(r.latmin) || 0;
      const A = Number(r.absenthrs) || 0;
      const leaveY = r.leacod === 'Y';
      const hasSwipe = !!(r.swipeIn && String(r.swipeIn).trim());
      // OT is independent of the late/leave/absent kind — always carry it. Minutes
      // per bucket → hours: Min0→1×, Min1→1.5×, Min2→2×, Min3→3×.
      const m = r.otMin || [0, 0, 0, 0];
      const h = n => Math.round(n / 60 * 100) / 100;
      const ot = { "1": h(m[0]), "1.5": h(m[1]), "2": h(m[2]), "3": h(m[3]) };
      // Public holiday (yellow rows, Holcod 3). Additive: only ever mark a holiday,
      // never auto-clear one — so manually-added holidays survive a re-import.
      const hol = Number(r.holcod) === 3 ? { isHoliday: true } : {};
      // Clock in/out times (Entdat/Stwkhr 'HHMM'→'HH:MM'). Only set when present, so a
      // blank HR time never wipes a manually-entered one. Advisory only — they feed the
      // modal's OT-from-clock-out estimator; no money math here reads them.
      const wt = {};
      { const wi = hrTimeToHm(r.swipeIn); if (wi) wt.workIn = wi; const wo = hrTimeToHm(r.swipeOut); if (wo) wt.workOut = wo; }
      // OT estimate for days HR hasn't approved yet. When every approved-minute bucket is
      // zero but the clock-out shows work past 18:30, estimate OT from the clock-out (same
      // 18:30 baseline / floor-to-0.5h as the modal): weekday → overflow at 1.5×; Saturday
      // rest-day → 9h at 1× + overflow at 3×. Approved days (any bucket > 0) keep HR's exact
      // value untouched, and half-day Saturdays (clock-out ≤ 18:30) fall through to 0 rather
      // than a wrong full-day base. Idempotent across re-imports; reconciles once HR approves
      // (the diff then shows estimate→approved). Rides the existing `ot` patch key, so the OT
      // category toggle and diff handle it like any other OT.
      let estOt = ot;
      if (m.every(x => !(Number(x) > 0)) && wt.workOut) {
        const [oh, om] = wt.workOut.split(':').map(Number);
        if (oh * 60 + om > 18 * 60 + 30) {
          const overflow = otHoursFromClockOut(wt.workOut); // hours past 18:30, floored to 0.5
          const dow = jsDate(r.ds).getDay();
          if (dow === 6 && Number(r.holcod) === 2) estOt = { "1": 9, "1.5": 0, "2": 0, "3": overflow };
          else if (dow >= 1 && dow <= 5 && Number(r.holcod) !== 3) estOt = { ...ot, "1.5": overflow };
        }
      }
      if (A > 0) {
        return { kind: 'absent', lateMin: L, leaveHours: 0, absentHours: A, ot, ...wt, ...hol };
      }
      if (leaveY) {
        if (!hasSwipe) {
          return { kind: 'leave', lateMin: 0, leaveHours: 9, absentHours: 0, worked: false, ot, ...wt, ...hol };
        }
        const lh = Math.max(0, Math.ceil((L - 30) / 30)) * 0.5;
        return { kind: 'leave', lateMin: 0, leaveHours: lh, absentHours: 0, worked: true, ot, ...wt, ...hol };
      }
      // Normal/late day: a swipe-in means they were at work → worked:true. This also
      // restores worked when a day flips from a full-day leave (worked:false) back to a
      // worked day, so it no longer falls through to "absent". Weekends (no swipe) keep
      // their default worked:false → no spurious travel/worked marking.
      return { kind: 'late', lateMin: L, leaveHours: 0, absentHours: 0, ...(hasSwipe ? { worked: true } : {}), ot: estOt, ...wt, ...hol };
    }

    const OT_RATES = ["1", "1.5", "2", "3"];
    const otTotal = o => OT_RATES.reduce((s, r) => s + (Number(o && o[r]) || 0), 0);

    // Compare a day's current state against a patch; returns the differing fields.
    function diffPatch(cur, patch) {
      const changes = [];
      if ('lateMin' in patch) { const o = Number(cur.lateMin) || 0; if (o !== patch.lateMin) changes.push({ label: 'สาย(น.)', old: o, new: patch.lateMin }); }
      if ('leaveHours' in patch) { const o = leaveHrsOf(cur); if (o !== patch.leaveHours) changes.push({ label: 'ลา(ชม.)', old: o, new: patch.leaveHours }); }
      if ('absentHours' in patch) { const o = absentHrsOf(cur); if (o !== patch.absentHours) changes.push({ label: 'ขาด(ชม.)', old: o, new: patch.absentHours }); }
      if ('worked' in patch) { const o = !!cur.worked; if (o !== !!patch.worked) changes.push({ label: 'ทำงาน', old: o ? '✓' : '✗', new: patch.worked ? '✓' : '✗' }); }
      if ('isHoliday' in patch) { const o = !!cur.isHoliday; if (o !== !!patch.isHoliday) changes.push({ label: 'วันหยุด', old: o ? '✓' : '✗', new: patch.isHoliday ? '✓' : '✗' }); }
      if ('ot' in patch) {
        const co = cur.ot || {};
        const diff = OT_RATES.some(r => (Number(co[r]) || 0) !== (Number(patch.ot[r]) || 0));
        if (diff) changes.push({ label: 'OT(ชม.)', old: otTotal(co), new: otTotal(patch.ot) });
      }
      // Clock in/out are string-valued; compare as strings (the numeric overwrite warning
      // in openImportPreview only triggers on numeric olds, so times never flag as ⚠️).
      if ('workIn' in patch) { const o = cur.workIn || ''; if (o !== patch.workIn) changes.push({ label: 'เข้า', old: o || '—', new: patch.workIn || '—' }); }
      if ('workOut' in patch) { const o = cur.workOut || ''; if (o !== patch.workOut) changes.push({ label: 'ออก', old: o || '—', new: patch.workOut || '—' }); }
      return changes;
    }

    // Apply a patch's present fields onto a day object.
    function applyPatchToDay(d, patch) {
      if ('lateMin' in patch) d.lateMin = patch.lateMin;
      if ('absentHours' in patch) d.absentHours = patch.absentHours;
      if ('leaveHours' in patch) {
        d.leaveHours = patch.leaveHours;
        d.leave = patch.leaveHours > 0;
        if (patch.leaveHours >= 9) { d.leaveStart = '08:00'; d.leaveEnd = '18:00'; }
        else if (patch.leaveHours === 0) { d.leaveStart = ''; d.leaveEnd = ''; }
      }
      if ('worked' in patch) d.worked = patch.worked;
      if ('isHoliday' in patch) d.isHoliday = patch.isHoliday;
      if ('ot' in patch) d.ot = { "1": patch.ot["1"], "1.5": patch.ot["1.5"], "2": patch.ot["2"], "3": patch.ot["3"] };
      if ('workIn' in patch) d.workIn = patch.workIn;
      if ('workOut' in patch) d.workOut = patch.workOut;
    }

    // Route each changed day's patch to the month doc(s) that render/aggregate it.
    // primary  = the day's own calendar month. secondary = next month, only for
    // day >= 25, so that month's OT calendar shows it. Each month's calc filters by
    // month-prefix / OT-range, so the duplicated copy never double-counts.
    function buildImportWrites(entries) {
      const primary = {}, secondary = {};
      const add = (obj, key, ds, patch) => { (obj[key] || (obj[key] = {}))[ds] = patch; };
      for (const e of entries) {
        if (!e.ds) continue;
        const patch = e.fpatch || e.patch; // category-filtered patch
        const [y, m, day] = e.ds.split('-').map(Number);
        add(primary, monthKey(y, m), e.ds, patch);
        if (day >= 25) {
          const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
          add(secondary, monthKey(ny, nm), e.ds, patch);
        }
      }
      return { primary, secondary };
    }

    function handleImportFile(event) {
      const input = event.target;
      const file = input.files && input.files[0];
      input.value = ''; // allow re-selecting the same file
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => ingestImportHtml(String(reader.result));
      reader.onerror = () => showToast('อ่านไฟล์ไม่สำเร็จ');
      reader.readAsText(file);
    }

    // Receive attendance HTML pushed from the company page — the bookmarklet/userscript runs
    // there (same-origin, so it can read #gvAttn) and sends it back via window.opener.postMessage.
    // Cross-origin postMessage is NOT blocked by CORS, so this is how "open company site → click
    // bookmark → data lands here" works with no copy-paste. We accept messages only from the
    // company origin (plus our own Live Server, to allow local testing) and feed the HTML into
    // the same import pipeline (ingestImportHtml). If the app isn't ready yet (not signed in /
    // month not loaded), stash it and flush after loadMonth().
    const IMPORT_MSG_ORIGINS = ['https://hr.rsquanta.com', 'http://127.0.0.1:5500'];
    let pendingExternalImport = null;
    let appReady = false;

    window.addEventListener('message', e => {
      if (!IMPORT_MSG_ORIGINS.includes(e.origin)) return;
      const d = e.data;
      if (!d || !d.salaryotImport || typeof d.html !== 'string') return;
      try { if (e.source) e.source.postMessage({ salaryotReady: true }, e.origin); } catch (_) {}
      if (appReady) ingestImportHtml(d.html);
      else pendingExternalImport = d.html;
    });

    // Parse attendance HTML — from an uploaded file OR pasted from the company page
    // (the bookmarklet copies #gvAttn there) — then classify, diff against current
    // data, and open the preview. Shared by both paths; all parsing stays in
    // parseAttendanceHtml so the bookmarklet can remain a dumb copy of #gvAttn.
    async function ingestImportHtml(htmlText) {
      let rows;
      try { rows = parseAttendanceHtml(String(htmlText)); }
      catch (e) { showToast('อ่านข้อมูลไม่สำเร็จ'); return; }
      if (rows === null) { showToast('ไม่พบตาราง attendance (#gvAttn) ในข้อมูล'); return; }
      if (!rows.length) { showToast('ไม่พบข้อมูลวัน'); return; }
      pendingImport = rows;
      showToast('กำลังเทียบกับข้อมูลเดิม…');
      try { await prepareImportDiff(); }
      catch (e) { showToast('อ่านข้อมูลเดิมไม่สำเร็จ: ' + ((e && e.message) || e)); return; }
      openImportPreview();
    }

    // Paste step inside the import modal: the user pastes the #gvAttn HTML the
    // bookmarklet copied from the company page; "ตรวจสอบ" feeds it to ingestImportHtml,
    // which re-renders this same #import-body into the normal diff preview.
    function openImportPaste() {
      document.getElementById('import-body').innerHTML = `
      <div class="otsect" style="margin-top:6px"><h4>วางข้อมูลจากเว็บบริษัท</h4>
        <div class="info-box" style="margin-bottom:8px">เปิดหน้า attendance บนเว็บบริษัท → คลิก bookmarklet เพื่อคัดลอก → วางในช่องนี้ (Ctrl+V) แล้วกด “ตรวจสอบ”</div>
        <textarea id="import-paste" class="note-inp" rows="6" placeholder="วางข้อมูลที่นี่ (Ctrl+V)…"></textarea>
      </div>
      <div class="mactions">
        <button class="btn btn-c" onclick="closeImport()">ยกเลิก</button>
        <button class="btn btn-p" onclick="submitImportPaste()">ตรวจสอบ</button>
      </div>`;
      document.getElementById('importbg').classList.add('open');
      setTimeout(() => { const el = document.getElementById('import-paste'); if (el) el.focus(); }, 30);
    }

    async function submitImportPaste() {
      const el = document.getElementById('import-paste');
      const text = el ? el.value : '';
      if (!text.trim()) { showToast('ยังไม่ได้วางข้อมูล'); return; }
      await ingestImportHtml(text);
    }

    // Copy the bookmarklet code (read straight from the install link's href, the
    // single source of truth) for users whose browser blocks drag-to-bookmark.
    function copyBookmarklet() {
      const link = document.getElementById('bm-link');
      if (!link) return;
      const href = link.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(href).then(
          () => showToast('คัดลอกโค้ดแล้ว — สร้าง bookmark ใหม่แล้ววาง URL นี้'),
          () => showToast('คัดลอกไม่สำเร็จ — ลากปุ่มไปที่แถบ bookmark แทน'));
      } else {
        showToast('ลากปุ่มไปที่แถบ bookmark แทน');
      }
    }

    // Classify each parsed day and compare against its current state (from its own
    // calendar month — the authoritative location) so the preview can show every
    // changed field before saving.
    // The month doc(s) a day is stored in: its own calendar month, plus — for
    // day >= 25 — the next month (whose OT calendar also shows/edits it). A day on
    // the 25th–31st has two independent copies, so the diff must consider both:
    // editing it while viewing the next month only changes that copy.
    function importTargetKeys(ds) {
      const [y, m, day] = ds.split('-').map(Number);
      const keys = [monthKey(y, m)];
      if (day >= 25) { const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1; keys.push(monthKey(ny, nm)); }
      return keys;
    }

    async function prepareImportDiff() {
      const rows = pendingImport;
      const curKey = monthKey(Y, M);
      importCats = { late: true, leave: true, absent: true, ot: true, holiday: true, time: true }; // fresh import → all on
      const allKeys = new Set();
      rows.forEach(r => importTargetKeys(r.ds).forEach(k => allKeys.add(k)));
      const monthData = {};
      for (const key of allKeys) {
        if (key === curKey) { monthData[key] = mdata; continue; }
        const snap = await userMonths().doc(key).get();
        monthData[key] = snap.exists ? snap.data() : { days: {} };
      }
      importDiff = rows.map(r => {
        const patch = classifyImportRow(r);
        // Cache the current state in every doc the day lives in (current view first, so
        // the old→new shown matches the calendar). refreshImportDiff() then derives the
        // changed/changes for whatever categories are selected — no Firestore re-read.
        const keys = importTargetKeys(r.ds).slice().sort((a, b) => (b === curKey) - (a === curKey));
        const curByKey = {};
        keys.forEach(key => { curByKey[key] = ((monthData[key] || {}).days || {})[r.ds] || defDay(r.ds); });
        return { ds: r.ds, kind: patch.kind, patch, keys, curByKey, fpatch: patch, changes: [], changed: false };
      });
      refreshImportDiff();
    }

    function openImportPreview() {
      const rows = pendingImport;
      const dates = rows.map(r => r.ds).sort();
      const emps = [...new Set(rows.map(r => r.emplid).filter(Boolean))];
      const months = [...new Set(rows.map(r => r.ds.slice(0, 7)))];

      const diff = importDiff || [];
      const changed = diff.filter(d => d.changed);
      // a day "overwrites" existing data if any changed field had a non-zero old number
      const hasOverwrite = e => e.changes.some(c => typeof c.old === 'number' && c.old > 0);
      const overwrite = changed.filter(hasOverwrite);
      // Count by the change labels actually present, so the tallies reflect the active filter.
      const lblCnt = lbl => changed.filter(e => e.changes.some(c => c.label === lbl)).length;

      const changedHtml = changed.length
        ? `<div style="max-height:240px;overflow-y:auto;border:1px solid var(--border);border-radius:8px;margin-top:6px">
            ${changed.map(e => {
            const warn = hasOverwrite(e);
            const desc = e.changes.map(c => `${c.label} ${c.old}→<strong style="color:${warn ? 'var(--red)' : 'var(--green)'}">${c.new}</strong>`).join(' · ');
            return `<div class="srow" style="padding:5px 10px;gap:8px${warn ? ';background:var(--red-lt)' : ''}">
              <span class="sl" style="white-space:nowrap">${e.ds}${warn ? ' ⚠️' : ''}</span>
              <span class="sv" style="text-align:right">${desc}</span>
            </div>`;
          }).join('')}
          </div>`
        : `<div class="info-box" style="margin-top:6px">ไม่มีอะไรเปลี่ยนแปลง — ข้อมูลตรงกับที่มีอยู่แล้ว</div>`;

      const catRow = Object.keys(IMPORT_CATS).map(cat =>
        `<label style="display:flex;align-items:center;gap:5px;cursor:pointer;user-select:none">
          <input type="checkbox" ${importCats[cat] ? 'checked' : ''} onclick="toggleImportCat('${cat}')"> ${IMPORT_CATS[cat].label}
        </label>`).join('');
      document.getElementById('import-body').innerHTML = `
      <div class="otsect" style="margin-top:6px"><h4>เลือกประเภทที่จะนำเข้า</h4>
        <div style="display:flex;flex-wrap:wrap;gap:6px 16px;font-size:.88rem;padding:2px 0">${catRow}</div>
      </div>
      <div class="otsect" style="margin-top:10px"><h4>ตรวจก่อนบันทึก</h4>
        <div class="srow"><span class="sl">พนักงาน</span><span class="sv">${emps.join(', ') || '—'}</span></div>
        <div class="srow"><span class="sl">ช่วงวันที่</span><span class="sv">${dates[0]} → ${dates[dates.length - 1]}</span></div>
        <div class="srow"><span class="sl">อ่านได้</span><span class="sv">${rows.length} วัน (${months.length} เดือน)</span></div>
        <div class="srow"><span class="sl">จะเปลี่ยนแปลง</span><span class="sv"><strong>${changed.length}</strong> วัน · เท่าเดิม ${rows.length - changed.length} วัน</span></div>
        <div class="srow"><span class="sl">แยกประเภท</span><span class="sv">สาย ${lblCnt('สาย(น.)')} · ลา ${lblCnt('ลา(ชม.)')} · ขาด ${lblCnt('ขาด(ชม.)')} · OT ${lblCnt('OT(ชม.)')} · วันหยุด ${lblCnt('วันหยุด')} · เวลา ${changed.filter(e => e.changes.some(c => c.label === 'เข้า' || c.label === 'ออก')).length}</span></div>
      </div>
      ${overwrite.length
          ? `<div class="info-box" style="margin-top:10px;background:var(--red-lt)">⚠️ มี ${overwrite.length} วันที่จะ “เขียนทับ” ค่าเดิมที่ไม่ใช่ 0 (แถวสีแดง) — ตรวจให้ดีก่อนยืนยัน</div>`
          : ''}
      ${changedHtml}
      <div class="info-box" style="margin-top:10px">กด “ยกเลิก” ได้ตลอด — ข้อมูลเดิมจะไม่ถูกแก้จนกว่าจะกดยืนยัน · บันทึก สาย/ลา/ขาด/OT ตามไฟล์ (ไม่แตะ travel) · วันที่ HR ยังไม่อนุมัติ OT จะ “ประมาณ” จากเวลาออกงาน (เกิน 18:30) แล้วแก้ให้ตรงเมื่อ import รอบหน้าหลัง HR อนุมัติ</div>
      <div class="mactions">
        <button class="btn btn-c" onclick="closeImport()">ยกเลิก</button>
        <button class="btn btn-p" id="import-apply-btn" onclick="applyImport()" ${changed.length === 0 ? 'disabled' : ''}>ยืนยันบันทึก ${changed.length} วัน</button>
      </div>`;
      document.getElementById('importbg').classList.add('open');
    }

    function closeImport() {
      document.getElementById('importbg').classList.remove('open');
      pendingImport = null;
      importDiff = null;
    }
    function importBgClick(e) { if (e.target === document.getElementById('importbg')) closeImport(); }

    async function writeDayPatch(key, dayMap, curKey, onlyIfExists) {
      if (key === curKey) {
        // current month: update in-memory; the caller persists it via save()
        for (const ds in dayMap) {
          if (!mdata.days[ds]) mdata.days[ds] = defDay(ds);
          applyPatchToDay(mdata.days[ds], dayMap[ds]);
        }
        return;
      }
      const ref = userMonths().doc(key);
      const snap = await ref.get();
      if (!snap.exists && onlyIfExists) return; // don't create a phantom "recorded" month
      const data = snap.exists ? snap.data() : { days: {} };
      if (!data.days) data.days = {};
      for (const ds in dayMap) {
        if (!data.days[ds]) data.days[ds] = defDay(ds);
        applyPatchToDay(data.days[ds], dayMap[ds]);
      }
      await ref.set(data);
    }

    async function applyImport() {
      if (!importDiff) { closeImport(); return; }
      // Only write the days that actually change — unchanged months are never touched.
      const changed = importDiff.filter(d => d.changed);
      if (!changed.length) { closeImport(); showToast('ไม่มีอะไรต้องบันทึก'); return; }

      const btn = document.getElementById('import-apply-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'กำลังบันทึก…'; }

      const { primary, secondary } = buildImportWrites(changed);
      const curKey = monthKey(Y, M);
      try {
        for (const key of Object.keys(primary)) await writeDayPatch(key, primary[key], curKey, false);
        for (const key of Object.keys(secondary)) {
          const dayMap = secondary[key];
          // For day>=25 this next month IS the day's OT period — if the patch carries real
          // OT, create the doc (don't drop OT pay); otherwise keep it a display-only mirror.
          const hasOt = Object.values(dayMap).some(p => p.ot && otTotal(p.ot) > 0);
          await writeDayPatch(key, dayMap, curKey, !hasOt);
        }
        if (primary[curKey] || secondary[curKey]) { renderAll(); save(); }
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = `ยืนยันบันทึก ${changed.length} วัน`; }
        showToast('บันทึกไม่สำเร็จ: ' + ((e && e.message) || e));
        return;
      }
      const n = changed.length;
      closeImport();
      showToast(`บันทึกแล้ว: ${n} วันที่เปลี่ยนแปลง ✓`);
    }

