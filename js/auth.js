    // ── AUTH UI ────────────────────────────────────────────────────────────────
    let authMode = 'in';

    // Username login is backed by Firebase email/password using a synthetic email.
    // If the user types a real email (contains "@") it's used verbatim, so existing
    // email accounts keep working.
    const USERNAME_EMAIL_DOMAIN = 'salaryot.app';
    function usernameToEmail(raw) {
      const v = raw.trim();
      return v.includes('@') ? v : `${v.toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
    }

    // Google sign-in
    const googleProvider = new firebase.auth.GoogleAuthProvider();
    googleProvider.setCustomParameters({ prompt: 'select_account' });

    async function signInWithGoogle() {
      const btn = document.getElementById('google-btn');
      btn.disabled = true;
      document.getElementById('auth-err').classList.remove('show');
      try {
        await auth.signInWithPopup(googleProvider);
        // onAuthStateChanged takes it from here
      } catch (err) {
        btn.disabled = false;
        // User dismissed the popup — nothing worth showing
        if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') return;
        const msgs = {
          'auth/popup-blocked': 'Popup blocked. Please allow popups for this site and try again.',
          'auth/unauthorized-domain': 'This domain isn’t authorized for Google sign-in. Add it under Firebase Console → Authentication → Settings → Authorized domains.',
          'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
          'auth/operation-not-allowed': 'Google sign-in isn’t enabled. Enable it in Firebase Console → Authentication → Sign-in method.',
        };
        showAuthError(msgs[err.code] || err.message);
      }
    }

    function switchAuthTab(mode) {
      authMode = mode;
      document.getElementById('atab-in').classList.toggle('active', mode === 'in');
      document.getElementById('atab-up').classList.toggle('active', mode === 'up');
      document.getElementById('auth-btn').textContent = mode === 'in' ? 'Sign In' : 'Create Account';
      document.getElementById('auth-err').classList.remove('show');
      document.getElementById('auth-pass').autocomplete = mode === 'in' ? 'current-password' : 'new-password';
    }

    function showAuthError(msg) {
      const el = document.getElementById('auth-err');
      el.textContent = msg;
      el.classList.add('show');
    }

    async function submitAuth() {
      const username = document.getElementById('auth-user').value.trim();
      const pass = document.getElementById('auth-pass').value;
      const btn = document.getElementById('auth-btn');
      if (!username || !pass) { showAuthError('Please enter your username and password.'); return; }

      btn.disabled = true;
      document.getElementById('auth-err').classList.remove('show');

      const email = usernameToEmail(username);
      try {
        if (authMode === 'in') {
          await auth.signInWithEmailAndPassword(email, pass);
        } else {
          await auth.createUserWithEmailAndPassword(email, pass);
        }
        // onAuthStateChanged takes it from here
      } catch (err) {
        btn.disabled = false;
        const msgs = {
          'auth/user-not-found': 'No account found with this username.',
          'auth/wrong-password': 'Incorrect password.',
          'auth/invalid-credential': 'Incorrect username or password.',
          'auth/email-already-in-use': 'That username is already taken.',
          'auth/weak-password': 'Password must be at least 6 characters.',
          'auth/invalid-email': 'Invalid username. Use letters, numbers, dots, hyphens or underscores.',
          'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        };
        showAuthError(msgs[err.code] || err.message);
      }
    }

    function showApp() {
      document.getElementById('loading-screen').classList.add('hidden');
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('year-screen').style.display = 'none';
      document.getElementById('app').style.display = '';
      document.getElementById('uname').textContent = currentUser.email.split('@')[0];
      applyThemeIcon();
    }

    function showAuthScreen() {
      document.getElementById('loading-screen').classList.add('hidden');
      document.getElementById('auth-screen').classList.remove('hidden');
      document.getElementById('year-screen').style.display = 'none';
      document.getElementById('app').style.display = 'none';
    }

    async function logout() {
      mdata = {};
      await auth.signOut();
    }

