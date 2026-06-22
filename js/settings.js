    // ── SETTINGS MODAL ────────────────────────────────────────────────────────
    function applySettings(s) {
      BASE = s.base ?? 23000;
      TRAVEL = s.travel ?? 35;
      SSF = s.ssf ?? 875;
      OTHER_INCOMES = s.otherIncomes ?? [];
      OTHER_DEDUCTIONS = s.otherDeductions ?? [];
      HOURLY = BASE / 30 / 9;
      document.getElementById('hdr-note').textContent =
        `Base ฿${BASE.toLocaleString()} · SSF ฿${SSF.toLocaleString()} · Travel ฿${TRAVEL}/day`;
    }

    async function loadSettings() {
      const snap = await db.collection('users').doc(currentUser.uid).get();
      if (snap.exists && snap.data().settings) applySettings(snap.data().settings);
    }

    function openSettings() {
      document.getElementById('set-base').value = BASE;
      document.getElementById('set-travel').value = TRAVEL;
      document.getElementById('set-ssf').value = SSF;
      renderOtherIncomeRows();
      renderOtherDeductionRows();
      previewHourly();
      document.getElementById('setbg').classList.add('open');
    }

    function renderOtherIncomeRows() {
      const list = document.getElementById('oi-list');
      if (!list) return;
      if (OTHER_INCOMES.length === 0) {
        list.innerHTML = `<div style="font-size:.76rem;color:var(--gray);padding:4px 0">No extra income added.</div>`;
        return;
      }
      list.innerHTML = OTHER_INCOMES.map((oi, i) => `<div class="otrow" style="gap:6px">
        <input type="text" class="otinp" id="oi-name-${i}" value="${oi.name.replace(/"/g,'&quot;')}" placeholder="Name" style="flex:1;max-width:none;text-align:left;font-size:.82rem">
        <input type="number" class="otinp" id="oi-amt-${i}" value="${oi.amount || ''}" min="0" step="100" placeholder="0" style="max-width:80px">
        <button onclick="removeOtherIncome(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:1rem;padding:0 4px;flex-shrink:0" title="Remove">✕</button>
      </div>`).join('');
    }

    function collectOtherIncomes() {
      const newList = [];
      for (let i = 0; i < OTHER_INCOMES.length; i++) {
        const nameEl = document.getElementById(`oi-name-${i}`);
        const amtEl = document.getElementById(`oi-amt-${i}`);
        if (nameEl && amtEl) newList.push({ name: nameEl.value.trim(), amount: parseFloat(amtEl.value) || 0 });
      }
      OTHER_INCOMES = newList;
    }

    function addOtherIncome() {
      collectOtherIncomes();
      OTHER_INCOMES.push({ name: '', amount: 0 });
      renderOtherIncomeRows();
      const el = document.getElementById(`oi-name-${OTHER_INCOMES.length - 1}`);
      if (el) el.focus();
    }

    function removeOtherIncome(i) {
      collectOtherIncomes();
      OTHER_INCOMES.splice(i, 1);
      renderOtherIncomeRows();
    }

    function renderOtherDeductionRows() {
      const list = document.getElementById('od-list');
      if (!list) return;
      if (OTHER_DEDUCTIONS.length === 0) {
        list.innerHTML = `<div style="font-size:.76rem;color:var(--gray);padding:4px 0">No extra deduction added.</div>`;
        return;
      }
      list.innerHTML = OTHER_DEDUCTIONS.map((od, i) => `<div class="otrow" style="gap:6px">
        <input type="text" class="otinp" id="od-name-${i}" value="${od.name.replace(/"/g,'&quot;')}" placeholder="Name" style="flex:1;max-width:none;text-align:left;font-size:.82rem">
        <input type="number" class="otinp" id="od-amt-${i}" value="${od.amount || ''}" min="0" step="100" placeholder="0" style="max-width:80px">
        <button onclick="removeOtherDeduction(${i})" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:1rem;padding:0 4px;flex-shrink:0" title="Remove">✕</button>
      </div>`).join('');
    }

    function collectOtherDeductions() {
      const newList = [];
      for (let i = 0; i < OTHER_DEDUCTIONS.length; i++) {
        const nameEl = document.getElementById(`od-name-${i}`);
        const amtEl = document.getElementById(`od-amt-${i}`);
        if (nameEl && amtEl) newList.push({ name: nameEl.value.trim(), amount: parseFloat(amtEl.value) || 0 });
      }
      OTHER_DEDUCTIONS = newList;
    }

    function addOtherDeduction() {
      collectOtherDeductions();
      OTHER_DEDUCTIONS.push({ name: '', amount: 0 });
      renderOtherDeductionRows();
      const el = document.getElementById(`od-name-${OTHER_DEDUCTIONS.length - 1}`);
      if (el) el.focus();
    }

    function removeOtherDeduction(i) {
      collectOtherDeductions();
      OTHER_DEDUCTIONS.splice(i, 1);
      renderOtherDeductionRows();
    }

    function previewHourly() {
      const base = parseFloat(document.getElementById('set-base').value) || 0;
      document.getElementById('set-hrate').textContent = `฿${fmt(base / 30 / 9)}/hr`;
    }

    function closeSettings() { document.getElementById('setbg').classList.remove('open'); }

    async function saveSettings() {
      const base = parseFloat(document.getElementById('set-base').value);
      const travel = parseFloat(document.getElementById('set-travel').value);
      const ssf = parseFloat(document.getElementById('set-ssf').value);
      if ([base, travel, ssf].some(v => isNaN(v) || v < 0)) return;
      collectOtherIncomes();
      collectOtherDeductions();
      const s = { base, travel, ssf, otherIncomes: OTHER_INCOMES, otherDeductions: OTHER_DEDUCTIONS };
      db.collection('users').doc(currentUser.uid).set({ settings: s }, { merge: true });
      applySettings(s);
      renderAll();
      closeSettings();
    }

    function settingsBgClick(e) { if (e.target === document.getElementById('setbg')) closeSettings(); }

