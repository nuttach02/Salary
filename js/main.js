    // ── TABS ───────────────────────────────────────────────────────────────────
    function switchTab(tab) {
      ['ot', 'att'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.toggle('active', t === tab);
        document.getElementById(`pane-${t}`).classList.toggle('active', t === tab);
      });
    }

    // ── NAVIGATION ─────────────────────────────────────────────────────────────
    async function changeMonth(d) {
      gridAnimDir = d;
      M += d;
      if (M < 1) { M = 12; Y-- }
      if (M > 12) { M = 1; Y++ }
      await loadMonth();
    }

    // ── KEYBOARD ───────────────────────────────────────────────────────────────
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeModal(); closeSettings(); closePicker(); closeLeave(); closeImport();
        if (document.getElementById('year-screen').style.display !== 'none') closeYearView();
      }
    });

    // ── ANIMATION HELPERS ──────────────────────────────────────────────────────
    let gridAnimDir = 0;
    let _prevNet = null, _prevOtHrs = null, _prevLeaveHrs = null;

    function cellClick(ds, e) {
      const cell = e.target.closest('.ccell');
      if (!cell) return;
      const rect = cell.getBoundingClientRect();
      const rip = document.createElement('div');
      rip.className = 'ripple-circle';
      rip.style.left = (e.clientX - rect.left) + 'px';
      rip.style.top = (e.clientY - rect.top) + 'px';
      cell.appendChild(rip);
      setTimeout(() => rip.remove(), 560);
      openModal(ds);
    }

    function countUpEl(el, from, to, dur, formatFn) {
      const f = formatFn || (n => String(Math.round(n)));
      const start = performance.now();
      function step(now) {
        const p = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = f(from + (to - from) * ease);
        if (p < 1) requestAnimationFrame(step);
        else el.textContent = f(to);
      }
      requestAnimationFrame(step);
    }

    function animateGrids() {
      if (!gridAnimDir) return;
      const cls = gridAnimDir > 0 ? 'slide-right' : 'slide-left';
      ['ot-grid', 'att-grid'].forEach(id => {
        const g = document.getElementById(id);
        if (!g) return;
        g.classList.remove('slide-right', 'slide-left');
        void g.offsetWidth;
        g.classList.add(cls);
      });
      gridAnimDir = 0;
    }

    let _toastTimer;
    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.className = 'toast in';
      clearTimeout(_toastTimer);
      _toastTimer = setTimeout(() => {
        t.className = 'toast out';
        setTimeout(() => { t.className = 'toast'; }, 260);
      }, 1800);
    }

    // Auto-select content of number inputs on focus for easier editing
    document.addEventListener('focusin', e => {
      if (e.target.matches('input[type="number"]')) e.target.select();
    });

    // Swipe left/right to navigate months on mobile
    let _swipeX = 0, _swipeY = 0;
    document.addEventListener('touchstart', e => {
      _swipeX = e.touches[0].clientX;
      _swipeY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - _swipeX;
      const dy = e.changedTouches[0].clientY - _swipeY;
      const anyOpen = document.getElementById('mbg').classList.contains('open') ||
        document.getElementById('setbg').classList.contains('open');
      if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 1.5 && !anyOpen)
        changeMonth(dx < 0 ? 1 : -1);
    }, { passive: true });

    // ── MONTH PICKER ──────────────────────────────────────────────────────────
    let pickerYear = Y;

    function openPicker() {
      pickerYear = Y;
      renderPicker();
      document.getElementById('mpicker').classList.toggle('open');
    }

    function closePicker() {
      document.getElementById('mpicker').classList.remove('open');
    }

    function renderPicker() {
      document.getElementById('picker-year').textContent = pickerYear;
      document.getElementById('picker-grid').innerHTML = MONTHS.map((name, i) => {
        const active = (i + 1 === M && pickerYear === Y) ? ' active' : '';
        return `<button class="picker-month${active}" onclick="selectPickerMonth(${i + 1})">${name.slice(0, 3)}</button>`;
      }).join('');
    }

    function changePickerYear(d) {
      pickerYear += d;
      renderPicker();
    }

    async function selectPickerMonth(m) {
      M = m; Y = pickerYear;
      closePicker();
      await loadMonth();
    }

    document.addEventListener('click', e => {
      const picker = document.getElementById('mpicker');
      if (!picker.classList.contains('open')) return;
      if (!document.getElementById('mnav-wrap').contains(e.target)) closePicker();
    });

    // ── AUTH OBSERVER (entry point) ────────────────────────────────────────────
    auth.onAuthStateChanged(async user => {
      if (user) {
        currentUser = user;
        showApp();
        await loadSettings();
        await loadMonth();
        appReady = true;
        // a company-page push that arrived before we finished loading — run it now
        if (pendingExternalImport) { const h = pendingExternalImport; pendingExternalImport = null; ingestImportHtml(h); }
      } else {
        currentUser = null;
        appReady = false;
        showAuthScreen();
      }
    });
