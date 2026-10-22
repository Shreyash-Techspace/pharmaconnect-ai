/* ==========================================================================
   Pharma-Connect AI — Login Page Logic
   Real OTP via EmailJS + Demo bypass for evaluation accounts
   ========================================================================== */

// ── State ──────────────────────────────────────────────────────────────────
let _pendingEmail    = '';
let _pendingPassword = '';
let _pendingRole     = '';
let _pendingName     = '';
let _forgotEmail     = '';
let _isDemo          = false;

const DEMO_ACCOUNTS = {
  patient:  { email: 'rahul@pharmaconnect.ai',        password: 'PatientPass@123' },
  pharmacy: { email: 'apollo@pharmaconnect.ai',        password: 'PharmaPass@123' },
  admin:    { email: 'admin@pharmaconnect.ai',         password: 'AdminPass@123'  },
};

// ── Init EmailJS ────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const cfg = window.APP_CONFIG || {};
  if (cfg.EMAILJS_PUBLIC_KEY && cfg.EMAILJS_PUBLIC_KEY !== 'YOUR_EMAILJS_PUBLIC_KEY') {
    emailjs.init(cfg.EMAILJS_PUBLIC_KEY);
  }

  // If already logged in, redirect to app
  const stored = localStorage.getItem('pharma_user');
  if (stored) {
    window.location.href = '/';
  }
});

// ── Toast ──────────────────────────────────────────────────────────────────
function loginToast(title, msg, type = 'info') {
  const container = document.getElementById('loginToastContainer');
  const iconMap = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  const el = document.createElement('div');
  el.className = `l-toast ${type}`;
  el.innerHTML = `
    <i class="fa-solid ${iconMap[type] || iconMap.info} l-toast-icon"></i>
    <div>
      <div class="l-toast-title">${title}</div>
      <div class="l-toast-msg">${msg}</div>
    </div>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

// ── Tab switching ───────────────────────────────────────────────────────────
function switchLoginTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('loginSection').style.display    = isLogin ? 'block' : 'none';
  document.getElementById('registerSection').style.display = isLogin ? 'none'  : 'block';
  if (!isLogin) {
    const s1 = document.getElementById('regStep1');
    const s2 = document.getElementById('regStep2');
    if (s1) s1.style.display = 'block';
    if (s2) s2.style.display = 'none';
  }
  document.getElementById('tabLogin').classList.toggle('active',    isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
  document.getElementById('authTitle').innerText    = isLogin ? 'Welcome Back' : 'Create Account';
  document.getElementById('authSubtitle').innerText = isLogin
    ? 'Sign in to access your healthcare dashboard'
    : 'Register as patient or pharmacy owner';
}

function showLoginSection() {
  document.getElementById('loginStep1').style.display    = 'block';
  document.getElementById('loginStep2').style.display    = 'none';
  document.getElementById('forgotSection').style.display = 'none';
}

function showForgotSection() {
  document.getElementById('loginStep1').style.display    = 'none';
  document.getElementById('loginStep2').style.display    = 'none';
  document.getElementById('forgotSection').style.display = 'block';
}

function backToStep1() {
  document.getElementById('loginStep1').style.display = 'block';
  document.getElementById('loginStep2').style.display = 'none';
}

// ── Password utils ──────────────────────────────────────────────────────────
function toggleEye(inputId, btn) {
  const inp = document.getElementById(inputId);
  const ico = btn.querySelector('i');
  if (inp.type === 'password') {
    inp.type = 'text';
    ico.className = 'fa-solid fa-eye-slash';
  } else {
    inp.type = 'password';
    ico.className = 'fa-solid fa-eye';
  }
}

function checkPwdStrength(pwd) {
  const fill = document.getElementById('pwdFill');
  const text = document.getElementById('pwdText');
  if (!fill || !text) return;
  let score = 0;
  if (pwd.length >= 6)  score += 25;
  if (pwd.length >= 10) score += 25;
  if (/[0-9]/.test(pwd))      score += 25;
  if (/[^A-Za-z0-9]/.test(pwd)) score += 25;
  fill.style.width = `${score}%`;
  const colors = ['#ef4444','#f59e0b','#3b82f6','#10b981'];
  const labels = ['Weak','Fair','Good','Excellent!'];
  const idx = Math.min(3, Math.floor(score / 25) - (score === 100 ? 0 : 1));
  fill.style.background = colors[Math.max(0, idx)];
  text.innerText = `Strength: ${labels[Math.max(0, idx)]}`;
}

function togglePharmacyField() {
  const role = document.getElementById('regRole').value;
  const pharmSection = document.getElementById('regPharmacyFields');
  if (pharmSection) {
    pharmSection.style.display = (role === 'pharmacy') ? 'block' : 'none';
    if (role === 'pharmacy') {
      const latInput = document.getElementById('regLat');
      const lngInput = document.getElementById('regLng');
      if (latInput && !latInput.value) {
        setDemoStoreLocationPalghar();
      }
    }
  }
}

function detectStoreLocation() {
  const statusEl = document.getElementById('storeLocationStatus');
  const latInput = document.getElementById('regLat');
  const lngInput = document.getElementById('regLng');
  const addrInput = document.getElementById('regAddress');

  if (!navigator.geolocation) {
    if (statusEl) statusEl.innerText = '⚠️ Geolocation not supported by your browser.';
    return;
  }

  if (statusEl) statusEl.innerText = '📡 Detecting GPS coordinates...';

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = parseFloat(pos.coords.latitude.toFixed(5));
      const lng = parseFloat(pos.coords.longitude.toFixed(5));
      if (latInput) latInput.value = lat;
      if (lngInput) lngInput.value = lng;
      if (statusEl) statusEl.innerHTML = `✅ GPS Captured: <strong>${lat}, ${lng}</strong>`;

      // Reverse geocode via Nominatim
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
        .then(r => r.json())
        .then(d => {
          if (addrInput && (!addrInput.value || addrInput.value.includes('Palghar'))) {
            addrInput.value = d.display_name || `${lat}, ${lng}`;
          }
        })
        .catch(() => {});
    },
    err => {
      console.warn('Geolocation error:', err);
      if (statusEl) statusEl.innerText = '⚠️ Could not fetch GPS. Switched to Palghar demo coordinates.';
      setDemoStoreLocationPalghar();
    },
    { timeout: 8000 }
  );
}

function setDemoStoreLocationPalghar() {
  const latInput = document.getElementById('regLat');
  const lngInput = document.getElementById('regLng');
  const addrInput = document.getElementById('regAddress');
  const statusEl = document.getElementById('storeLocationStatus');

  // Slight jitter so multiple stores don't overlap exactly
  const jitterLat = (Math.random() - 0.5) * 0.008;
  const jitterLng = (Math.random() - 0.5) * 0.008;
  const palgharLat = parseFloat((19.6967 + jitterLat).toFixed(5));
  const palgharLng = parseFloat((72.7699 + jitterLng).toFixed(5));

  if (latInput) latInput.value = palgharLat;
  if (lngInput) lngInput.value = palgharLng;
  if (addrInput && !addrInput.value) {
    addrInput.value = 'Station Road, Palghar West, Maharashtra - 401404';
  }
  if (statusEl) {
    statusEl.innerHTML = `📍 Demo Location: <strong>Palghar, Maharashtra (${palgharLat}, ${palgharLng})</strong>`;
  }
}

// ── Send OTP via EmailJS ────────────────────────────────────────────────────
async function sendOtpEmail(toEmail, userName, otpCode) {
  const cfg = window.APP_CONFIG || {};
  const hasEmailJS = cfg.EMAILJS_SERVICE_ID && cfg.EMAILJS_SERVICE_ID !== 'YOUR_EMAILJS_SERVICE_ID';

  if (!hasEmailJS) {
    // No EmailJS configured — log to console for dev
    console.warn(`[DEV] EmailJS not configured. OTP for ${toEmail}: ${otpCode}`);
    return { sent: false };
  }

  try {
    await emailjs.send(cfg.EMAILJS_SERVICE_ID, cfg.EMAILJS_TEMPLATE_ID, {
      to_email:  toEmail,
      user_name: userName || 'User',
      otp_code:  otpCode,
      app_name:  'Pharma-Connect AI',
    });
    return { sent: true };
  } catch (err) {
    console.error('EmailJS error:', err);
    return { sent: false, error: err };
  }
}

// ── Step 1: Credentials ─────────────────────────────────────────────────────
async function handleLoginStep1(e) {
  e.preventDefault();
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const role     = document.getElementById('loginRole').value;
  const btn      = document.getElementById('loginStep1Btn');

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner"></i> Verifying...';

  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role })
    });
    const data = await res.json();

    if (!res.ok) {
      loginToast('Login Failed', data.detail || 'Invalid credentials.', 'error');
      return;
    }

    if (data.status === 'OTP_REQUIRED') {
      _pendingEmail    = email;
      _pendingPassword = password;
      _pendingRole     = role;
      _pendingName     = data.user_name || '';
      _isDemo          = !!data.otp_demo;

      // Show Step 2
      document.getElementById('loginStep1').style.display = 'none';
      document.getElementById('loginStep2').style.display = 'block';
      document.getElementById('otpTargetEmail').innerText = email;

      const alertBox = document.getElementById('otpDemoAlert');

      if (_isDemo && data.otp_demo) {
        // Demo account (1-Click quick testing accounts only)
        alertBox.style.display = 'inline-block';
        alertBox.innerHTML = `🔒 Demo Account OTP: <strong>${data.otp_demo}</strong>`;
        document.getElementById('otpInput').value = data.otp_demo;
        loginToast('Demo Account', 'OTP auto-filled for quick demo test.', 'info');
      } else {
        // Real Enterprise Account: code sent to Gmail inbox only
        alertBox.style.display = 'none';
        document.getElementById('otpInput').value = '';
        loginToast(
          '📧 OTP Sent to Gmail',
          `A 6-digit code was sent to ${email}. Check your inbox.`,
          'success'
        );
      }

    } else if (data.status === 'SUCCESS') {
      completeLogin(data);
    }
  } catch (err) {
    loginToast('Connection Error', 'Cannot reach server. Make sure it is running.', 'error');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-arrow-right"></i> Continue to OTP';
  }
}

// ── Step 2: Verify OTP ──────────────────────────────────────────────────────
async function handleLoginStep2() {
  const otpCode = document.getElementById('otpInput').value.trim();
  if (!otpCode || otpCode.length !== 6) {
    loginToast('Invalid OTP', 'Please enter the 6-digit code.', 'error');
    return;
  }

  const btn = document.getElementById('verifyOtpBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner"></i> Verifying...';

  try {
    const res  = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:    _pendingEmail,
        password: _pendingPassword,
        otp_code: otpCode,
        role:     _pendingRole
      })
    });
    const data = await res.json();

    if (res.ok && data.status === 'SUCCESS') {
      completeLogin(data);
    } else {
      loginToast('OTP Failed', data.detail || 'Wrong or expired OTP.', 'error');
    }
  } catch (err) {
    loginToast('Error', 'Verification failed. Try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Verify OTP & Sign In';
  }
}

// ── Resend OTP ──────────────────────────────────────────────────────────────
async function resendOtp() {
  const btn = document.getElementById('resendBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner"></i> Sending...';
  try {
    const res  = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: _pendingEmail, purpose: 'login' })
    });
    const data = await res.json();

    if (_isDemo && data.otp_demo) {
      document.getElementById('otpDemoAlert').style.display = 'inline-block';
      document.getElementById('otpDemoAlert').innerHTML = `🔒 Demo Account OTP: <strong>${data.otp_demo}</strong>`;
      document.getElementById('otpInput').value = data.otp_demo;
      loginToast('OTP Resent', 'Demo OTP auto-filled.', 'info');
    } else {
      document.getElementById('otpDemoAlert').style.display = 'none';
      loginToast('📧 OTP Resent', `New 6-digit code sent to ${_pendingEmail}. Check your inbox.`, 'success');
    }
  } catch {
    loginToast('Error', 'Could not resend OTP. Is the server running?', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Resend OTP';
  }
}

// ── Quick Demo Login ────────────────────────────────────────────────────────
async function quickDemoLogin(role) {
  const creds = DEMO_ACCOUNTS[role];
  if (!creds) return;

  document.getElementById('loginEmail').value    = creds.email;
  document.getElementById('loginPassword').value = creds.password;
  document.getElementById('loginRole').value     = role;

  loginToast('Demo Login', `Logging in as ${role}...`, 'info');

  try {
    // Step 1
    const r1   = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: creds.email, password: creds.password, role })
    });
    const d1 = await r1.json();

    if (d1.status === 'OTP_REQUIRED' && d1.otp_demo) {
      // Step 2 auto-complete
      const r2 = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: creds.email, password: creds.password,
          otp_code: d1.otp_demo, role
        })
      });
      const d2 = await r2.json();
      if (d2.status === 'SUCCESS') { completeLogin(d2); return; }
    } else if (d1.status === 'SUCCESS') {
      completeLogin(d1);
      return;
    }
    loginToast('Demo Failed', d1.detail || 'Login failed.', 'error');
  } catch (err) {
    loginToast('Error', 'Cannot reach server. Is it running?', 'error');
  }
}

// ── Complete Login: store user & redirect ───────────────────────────────────
function completeLogin(data) {
  localStorage.setItem('pharma_user', JSON.stringify(data.user));
  if (data.store) localStorage.setItem('pharma_store', JSON.stringify(data.store));
  loginToast('Welcome!', `Logged in as ${data.user.name}`, 'success');
  setTimeout(() => { window.location.href = '/'; }, 500);
}

// ── Register: 2-Step OTP Workflow ───────────────────────────────────────────
let _pendingRegData = null;

async function handleRegStep1(e) {
  e.preventDefault();
  const btn = document.getElementById('regStep1Btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner"></i> Sending Verification OTP...';

  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;
  const address = document.getElementById('regAddress').value.trim();
  const license = document.getElementById('regLicense') ? document.getElementById('regLicense').value.trim() : '';
  const latVal = document.getElementById('regLat') ? parseFloat(document.getElementById('regLat').value) : null;
  const lngVal = document.getElementById('regLng') ? parseFloat(document.getElementById('regLng').value) : null;

  if (!email || !email.includes('@')) {
    loginToast('Invalid Email', 'Please enter a valid email address.', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Continue to OTP Verification';
    return;
  }

  if (!phone || phone.length < 10) {
    loginToast('Invalid Phone', 'Please enter a valid mobile number with country code.', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Continue to OTP Verification';
    return;
  }

  if (!password || password.length < 6) {
    loginToast('Weak Password', 'Password must be at least 6 characters long.', 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Continue to OTP Verification';
    return;
  }

  _pendingRegData = {
    name, email, phone, password, role, address, license,
    avatar: 'patient_avatar.png',
    security_question: '',
    security_answer: '',
    lat: !isNaN(latVal) ? latVal : null,
    lng: !isNaN(lngVal) ? lngVal : null
  };

  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        purpose: 'register',
        name,
        phone
      })
    });
    const data = await res.json();

    if (!res.ok) {
      loginToast('Registration Error', data.detail || 'Could not send verification OTP.', 'error');
      return;
    }

    // Transition to Step 2
    document.getElementById('regStep1').style.display = 'none';
    document.getElementById('regStep2').style.display = 'block';
    document.getElementById('regOtpTargetEmail').innerText = email;
    document.getElementById('regOtpTargetPhone').innerText = phone ? `📱 Registered Mobile: ${phone}` : '';
    document.getElementById('regOtpInput').value = '';

    const regAlert = document.getElementById('regOtpAlert');
    regAlert.style.display = 'none';
    loginToast('✅ OTP Dispatched', `6-digit security code sent to ${email}. Check your Gmail inbox.`, 'success');
    document.getElementById('regOtpInput').focus();
  } catch (err) {
    loginToast('Connection Error', 'Cannot reach server. Make sure it is running.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> Continue to OTP Verification';
  }
}

async function handleRegStep2() {
  const otpCode = document.getElementById('regOtpInput').value.trim();
  if (!otpCode || otpCode.length !== 6) {
    loginToast('Invalid Code', 'Please enter the 6-digit verification code.', 'error');
    return;
  }

  const btn = document.getElementById('verifyRegOtpBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner"></i> Verifying & Creating Account...';

  const payload = {
    ..._pendingRegData,
    otp_code: otpCode
  };

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (res.ok && data.status === 'SUCCESS') {
      completeLogin(data);
    } else {
      loginToast('Verification Failed', data.detail || 'Wrong or expired OTP.', 'error');
    }
  } catch (err) {
    loginToast('Error', 'Registration failed. Try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-user-check"></i> Verify OTP & Complete Registration';
  }
}

function backToRegStep1() {
  document.getElementById('regStep1').style.display = 'block';
  document.getElementById('regStep2').style.display = 'none';
}

async function resendRegOtp() {
  if (!_pendingRegData) return;
  const btn = document.getElementById('regResendBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner"></i> Resending...';
  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: _pendingRegData.email,
        purpose: 'register',
        name: _pendingRegData.name,
        phone: _pendingRegData.phone
      })
    });
    const data = await res.json();
    if (res.ok) {
      const regAlert = document.getElementById('regOtpAlert');
      regAlert.style.display = 'none';
      loginToast('OTP Resent', `New 6-digit code sent to ${_pendingRegData.email}. Check your inbox.`, 'success');
    } else {
      loginToast('Error', data.detail || 'Could not resend OTP.', 'error');
    }
  } catch {
    loginToast('Error', 'Could not resend OTP.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-rotate"></i> Resend OTP';
  }
}

// ── Forgot Password ──────────────────────────────────────────────────────────
async function handleForgotSend(e) {
  e.preventDefault();
  _forgotEmail = document.getElementById('forgotEmail').value.trim();
  try {
    const res  = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: _forgotEmail, purpose: 'reset' })
    });
    const data = await res.json();
    document.getElementById('forgotStep1').style.display = 'none';
    document.getElementById('forgotStep2').style.display = 'block';
    // For demo accounts show hint
    if (data.otp_demo) {
      document.getElementById('forgotOtpCode').value = data.otp_demo;
    }
    loginToast('OTP Sent', `Reset code sent to ${_forgotEmail}`, 'success');
  } catch {
    loginToast('Error', 'Could not send reset OTP.', 'error');
  }
}

async function handleForgotReset(e) {
  e.preventDefault();
  const otpCode   = document.getElementById('forgotOtpCode').value.trim();
  const newPwd    = document.getElementById('forgotNewPwd').value;
  try {
    const res  = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: _forgotEmail, otp_code: otpCode, new_password: newPwd })
    });
    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      loginToast('Password Reset', 'Your password has been updated. Please login.', 'success');
      showLoginSection();
    } else {
      loginToast('Failed', data.detail || 'Reset failed.', 'error');
    }
  } catch {
    loginToast('Error', 'Reset request failed.', 'error');
  }
}
