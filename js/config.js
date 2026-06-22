    // ── FIREBASE CONFIG ────────────────────────────────────────────────────────
    // TODO: Replace every value below with your Firebase project config.
    // Firebase Console → Project Settings → Your apps → SDK setup & configuration
    const firebaseConfig = {
      apiKey: "AIzaSyD9f6aVhx1w_NGNA_FBpK8BMxTsdvkQhFc",
      authDomain: "salary-32127.web.app",
      projectId: "salary-32127",
      storageBucket: "salary-32127.appspot.com",
      messagingSenderId: "753481221416",
      appId: "1:753481221416:web:0598587661f99f3959fc1d"
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // ── SETTINGS (editable, per-user) ──────────────────────────────────────────
    let BASE = 23000;
    let TRAVEL = 35;
    let SSF = 875;
    let HOURLY = BASE / 30 / 9;
    let OTHER_INCOMES = [];
    let OTHER_DEDUCTIONS = [];

    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // ── STATE ──────────────────────────────────────────────────────────────────
    let currentUser = null;
    const _now = new Date();
    let Y = _now.getFullYear();
    let M = _now.getMonth() + 1;
    // OT period is 25th prev – 24th curr; if today >= 25 we're in the next period
    if (_now.getDate() >= 25) { M++; if (M > 12) { M = 1; Y++; } }
    let editDate = null;
    // Day's worked/leave state captured when the modal opens, so clearing leave can restore it
    let _editWorkedOrig = true, _editHadLeave = false;
    let mdata = {};

    // ── DARK MODE ──────────────────────────────────────────────────────────────
    function applyThemeIcon() {
      const dark = document.documentElement.classList.contains('dark');
      document.getElementById('theme-btn').textContent = dark ? '☀️' : '🌙';
    }

    function toggleDark() {
      document.documentElement.classList.toggle('dark');
      const dark = document.documentElement.classList.contains('dark');
      localStorage.setItem('theme', dark ? 'dark' : 'light');
      // Re-derive a custom accent for the new mode (inline vars don't follow the toggle).
      applyAccent(localStorage.getItem('accent') || '', dark);
      applyThemeIcon();
    }

