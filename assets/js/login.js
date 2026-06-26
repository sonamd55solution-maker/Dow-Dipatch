/**
 * Department of Water — Dispatch Booking System
 * Login Page Logic
 */
(async function () {
  const alertBox   = document.getElementById('alert-box');
  const loginForm  = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const loginBtn   = document.getElementById('login-btn');
  const signupBtn  = document.getElementById('signup-btn');

  // Already logged in → dashboard
  const existing = await DoWAuth.getSession();
  if (existing) { window.location.href = 'dashboard.html'; return; }

  // Toggle forms
  document.getElementById('show-signup-link')?.addEventListener('click', e => {
    e.preventDefault(); clearAlert(); loginForm.hidden = true; signupForm.hidden = false;
  });
  document.getElementById('show-login-link')?.addEventListener('click', e => {
    e.preventDefault(); clearAlert(); signupForm.hidden = true; loginForm.hidden = false;
  });

  // LOGIN
  loginForm.addEventListener('submit', async e => {
    e.preventDefault(); clearAlert();
    setLoading(loginBtn, 'login-btn-text', true, 'Logging in…');
    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
    });
    if (error) {
      showAlert(friendlyError(error.message), 'error');
      setLoading(loginBtn, 'login-btn-text', false, 'Log In'); return;
    }
    const { data: prof, error: pe } = await window.supabaseClient
      .from('profiles').select('is_active').eq('id', data.user.id).single();
    if (pe || !prof) {
      showAlert('Could not load your profile. Contact Admin.', 'error');
      await window.supabaseClient.auth.signOut();
      setLoading(loginBtn, 'login-btn-text', false, 'Log In'); return;
    }
    if (!prof.is_active) {
      showAlert('Your account is disabled. Contact Admin.', 'error');
      await window.supabaseClient.auth.signOut();
      setLoading(loginBtn, 'login-btn-text', false, 'Log In'); return;
    }
    window.location.href = 'dashboard.html';
  });

  // SIGN UP
  signupForm.addEventListener('submit', async e => {
    e.preventDefault(); clearAlert();
    setLoading(signupBtn, 'signup-btn-text', true, 'Creating account…');
    const full_name = document.getElementById('signup-name').value.trim();
    const email     = document.getElementById('signup-email').value.trim();
    const password  = document.getElementById('signup-password').value;
    const { data, error } = await window.supabaseClient.auth.signUp({
      email, password, options: { data: { full_name } },
    });
    if (error) {
      showAlert(friendlyError(error.message), 'error');
      setLoading(signupBtn, 'signup-btn-text', false, 'Create Account'); return;
    }
    if (!data.session) {
      showAlert('Account created! Check your email to confirm, then log in.', 'success');
      signupForm.hidden = true; loginForm.hidden = false;
      setLoading(signupBtn, 'signup-btn-text', false, 'Create Account'); return;
    }
    window.location.href = 'dashboard.html';
  });

  function setLoading(btn, textId, on, label) {
    btn.disabled = on;
    document.getElementById(textId).textContent = label;
  }
  function showAlert(msg, type) {
    alertBox.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
    alertBox.hidden = false;
  }
  function clearAlert() { alertBox.innerHTML = ''; alertBox.hidden = true; }
  function friendlyError(m) {
    if (/invalid login credentials/i.test(m)) return 'Incorrect email or password.';
    if (/user already registered/i.test(m))   return 'This email is already registered. Log in instead.';
    if (/password should be at least/i.test(m)) return 'Password must be at least 6 characters.';
    return m;
  }
})();
