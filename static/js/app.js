/* ==========================================================================
   Pharma-Connect AI - Master Frontend Application Logic
   ========================================================================== */

// Global Application State & Storage
let currentRole = 'patient';
let currentLanguage = 'en';
let mapInstance = null;
let markersGroup = [];
let forecastChartInstance = null;

let currentUser = JSON.parse(localStorage.getItem('pharma_user') || 'null');
let currentPharmacyStore = JSON.parse(localStorage.getItem('pharma_store') || 'null');
let cart = JSON.parse(localStorage.getItem('pharma_cart') || '[]');
let masterInventoryCache = [];
let pharmacyOrdersCache = [];
let patientOrdersCache = [];
let activePharmacyOrderFilter = 'ALL';

// ==========================================
// ANIMATED TOAST NOTIFICATION ENGINE
// ==========================================
function showToast(title, message, type = 'info', iconOverride = null) {
  let container = document.getElementById('toastNotificationContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastNotificationContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const iconMap = {
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-circle-xmark',
    warning: 'fa-solid fa-triangle-exclamation',
    info: 'fa-solid fa-circle-info'
  };

  const iconClass = iconOverride || iconMap[type] || iconMap.info;

  const card = document.createElement('div');
  card.className = `toast-card ${type}`;
  card.innerHTML = `
    <div class="toast-icon"><i class="${iconClass}"></i></div>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${message}</div>
    </div>
    <button class="toast-close-btn" onclick="this.parentElement.remove()">&times;</button>
  `;

  container.appendChild(card);

  setTimeout(() => {
    card.style.animation = 'toastFadeOut 0.3s forwards';
    setTimeout(() => {
      if (card.parentNode) card.parentNode.removeChild(card);
    }, 300);
  }, 3500);
}

// Global Browser Alert Interceptor for Animated Toasts
window.alert = function(msg) {
  if (typeof msg !== 'string') msg = String(msg);
  let title = "System Notification";
  let type = "info";
  if (msg.includes("❌") || msg.includes("Error") || msg.includes("Failed") || msg.includes("Denied")) {
    title = "Action Required";
    type = "error";
  } else if (msg.includes("🎉") || msg.includes("✅") || msg.includes("Added") || msg.includes("Success")) {
    title = "Success";
    type = "success";
  } else if (msg.includes("🔒") || msg.includes("⚠️") || msg.includes("Required")) {
    title = "Authentication & Security";
    type = "warning";
  }

  const cleanMsg = msg.replace(/[❌🎉✅🔒⚠️🛒]/g, '').trim();
  showToast(title, cleanMsg, type);
};

// ==========================================
// ANIMATED INTRO SPLASH OVERLAY CONTROLLER
// ==========================================
function openIntroSplash() {
  const overlay = document.getElementById('introSplashOverlay');
  if (overlay) overlay.style.display = 'flex';
}

function closeIntroSplash() {
  const overlay = document.getElementById('introSplashOverlay');
  if (overlay) {
    overlay.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => {
      overlay.style.display = 'none';
      overlay.style.animation = '';
    }, 300);
  }
}

// Auto open intro splash on first visit in session
document.addEventListener('DOMContentLoaded', () => {
  const introSeen = sessionStorage.getItem('pharma_intro_seen');
  if (!introSeen) {
    setTimeout(openIntroSplash, 600);
    sessionStorage.setItem('pharma_intro_seen', 'true');
  }
});

// i18n Translations Dictionary

const TRANSLATIONS = {
  en: {
    hero_title: "Find Medicines Faster. <span>Deliver Care Smarter.</span>",
    hero_subheading: "Locate medicines instantly across connected pharmacies, reserve stock with digital QR receipts, upload prescriptions for AI OCR analysis, dispatch 24/7 emergency deliveries, and forecast stock shortages before they happen.",
    btn_search: "Search Medicines",
    btn_register_pharmacy: "Register Pharmacy",
    btn_emergency: "Need Medicine Urgently",
    role_patient: "Patient",
    role_pharmacy: "Pharmacy",
    role_ai: "AI Analytics",
    role_hospital: "Hospital",
    role_delivery: "Delivery",
    role_admin: "Admin"
  },
  hi: {
    hero_title: "दवाइयां तेज़ी से खोजें। <span>स्वास्थ्य सेवा बेहतर बनाएं।</span>",
    hero_subheading: "आस-पास के मेडिकल स्टोर में तुरंत दवाएं खोजें, डिजिटल QR रसीद के साथ स्टॉक बुक करें, AI द्वारा नुस्खा स्कैन करें और आपातकालीन डिलीवरी प्राप्त करें।",
    btn_search: "दवाइयां खोजें",
    btn_register_pharmacy: "मेडिकल स्टोर पंजीकृत करें",
    btn_emergency: "आपातकालीन दवा की आवश्यकता",
    role_patient: "मरीज़",
    role_pharmacy: "फार्मेसी",
    role_ai: "AI विश्लेषण",
    role_hospital: "अस्पताल",
    role_delivery: "डिलीवरी",
    role_admin: "एडमिन"
  },
  mr: {
    hero_title: "औषधे जलद शोधा. <span>आरोग्यसेवा अधिक प्रभावी करा.</span>",
    hero_subheading: "जवळच्या फार्मसीमध्ये औषधांची उपलब्धता तपासा, डिजिटल पावतीसह पावती आरक्षित करा, AI याद्वारे प्रिस्क्रिप्शन स्कैन करा आणि तातडीची डिलिव्हरी मिळवा.",
    btn_search: "औषधे शोधा",
    btn_register_pharmacy: "फार्मसी नोंदणी करा",
    btn_emergency: "तातडीने औषध हवे आहे",
    role_patient: "रुग्ण",
    role_pharmacy: "फार्मसी",
    role_ai: "AI विश्लेषण",
    role_hospital: "रुग्णालय",
    role_delivery: "डिलिव्हरी",
    role_admin: "एडमिन"
  }
};

// Initialize Application on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  updateUserSessionUI();
  updateCartBadge();
  executePatientSearch('Dolo');
  renderFamilyProfiles();
  renderReminders();
  loadPatientOrders();
  loadPharmacyInventory(getStoreId());
  loadPharmacyOrders();
  loadAIForecastingData();
  loadAdminData();
  fetchStats();
});

// Helper to get active pharmacy store ID
function getStoreId() {
  if (currentPharmacyStore && currentPharmacyStore.id) return currentPharmacyStore.id;
  if (currentUser && currentUser.pharmacy_id) return currentUser.pharmacy_id;
  return 'PH-001';
}

// ==========================================
// AUTHENTICATION & ACCESS CONTROL
// ==========================================

function updateUserSessionUI() {
  const badge = document.getElementById('userSessionBadge');
  const authBtn = document.getElementById('authBtnTrigger');
  const nameDisp = document.getElementById('userNameDisplay');
  const roleDisp = document.getElementById('userRoleDisplay');
  const avatarEmoji = document.getElementById('userAvatarEmoji');

  const navPatient = document.getElementById('navPatientBtn');
  const navPharmacy = document.getElementById('navPharmacyBtn');
  const navAdmin = document.getElementById('navAdminBtn');

  if (currentUser) {
    if (badge) badge.style.display = 'flex';
    if (authBtn) authBtn.style.display = 'none';
    if (nameDisp) nameDisp.innerText = currentUser.name;
    if (roleDisp) roleDisp.innerText = currentUser.role.toUpperCase();
    if (avatarEmoji) {
      avatarEmoji.innerText = currentUser.role === 'pharmacy' ? '🏥' : (currentUser.role === 'admin' ? '🛡️' : '👤');
    }

    // Update store details if pharmacy
    if (currentUser.role === 'pharmacy' && currentPharmacyStore) {
      const storeName = document.getElementById('pharmStoreName');
      const storeLic = document.getElementById('pharmLicense');
      const storeAddr = document.getElementById('pharmAddress');
      const storePhone = document.getElementById('pharmPhone');

      if (storeName) storeName.innerText = currentPharmacyStore.name;
      if (storeLic) storeLic.innerText = currentPharmacyStore.license || 'DL-2024-AP8819';
      if (storeAddr) storeAddr.innerText = currentPharmacyStore.address || 'Downtown Central';
      if (storePhone) storePhone.innerText = currentPharmacyStore.phone || '+91 98201 12345';
    }

    // Role-Based Access Control for Portal Switcher Buttons
    if (currentUser.role === 'patient') {
      if (navPatient) navPatient.style.display = 'inline-flex';
      if (navPharmacy) navPharmacy.style.display = 'none';
      if (navAdmin) navAdmin.style.display = 'none';
    } else if (currentUser.role === 'pharmacy') {
      if (navPatient) navPatient.style.display = 'none';
      if (navPharmacy) navPharmacy.style.display = 'inline-flex';
      if (navAdmin) navAdmin.style.display = 'none';
    } else if (currentUser.role === 'admin') {
      // Admin has master access to inspect both Patient and Pharmacy portals safely
      if (navPatient) navPatient.style.display = 'inline-flex';
      if (navPharmacy) navPharmacy.style.display = 'inline-flex';
      if (navAdmin) navAdmin.style.display = 'inline-flex';
    }
  } else {
    if (badge) badge.style.display = 'none';
    if (authBtn) authBtn.style.display = 'inline-flex';

    // Logged Out State: Patient Portal active; Pharmacy & Admin locked with auth prompt
    if (navPatient) {
      navPatient.style.display = 'inline-flex';
      navPatient.innerHTML = '<i class="fa-solid fa-user-injured"></i> <span>Patient Portal</span>';
    }
    if (navPharmacy) {
      navPharmacy.style.display = 'inline-flex';
      navPharmacy.innerHTML = '<i class="fa-solid fa-lock" style="color:var(--amber-warning);"></i> <span>Pharmacy Portal</span>';
    }
    if (navAdmin) {
      navAdmin.style.display = 'inline-flex';
      navAdmin.innerHTML = '<i class="fa-solid fa-lock" style="color:var(--amber-warning);"></i> <span>Admin Portal</span>';
    }
  }
}

function switchRole(role) {
  const guardedRoles = ['pharmacy', 'admin'];

  if (!currentUser) {
    if (guardedRoles.includes(role)) {
      alert(`🔒 Authentication Required: Please log in as an authorized ${role.toUpperCase()} to access this portal.`);
      window.location.href = '/login';
      return;
    }
  } else {
    // Role Isolation Guard: Patient cannot access Pharmacy/Admin, Pharmacy cannot access Patient/Admin (Admin can access all)
    if (currentUser.role !== 'admin' && currentUser.role !== role) {
      alert(`⚠️ Access Control: You are currently logged in as ${currentUser.name} (${currentUser.role.toUpperCase()}). Please log out first to switch to the ${role.toUpperCase()} portal.`);
      return;
    }
  }

  currentRole = role;

  // Highlight active role button
  const btnMap = { patient: 'navPatientBtn', pharmacy: 'navPharmacyBtn', admin: 'navAdminBtn' };
  ['navPatientBtn', 'navPharmacyBtn', 'navAdminBtn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.classList.remove('active');
  });
  if (btnMap[role]) {
    const activeBtn = document.getElementById(btnMap[role]);
    if (activeBtn) activeBtn.classList.add('active');
  }

  // Toggle views
  document.querySelectorAll('.view-module').forEach(mod => mod.style.display = 'none');
  const targetView = document.getElementById(`${role}View`);
  if (targetView) targetView.style.display = 'block';

  // Trigger role data loading
  if (role === 'patient') loadPatientOrders();
  if (role === 'pharmacy') {
    switchPharmacySubTab('orders');
    loadPharmacyInventory(getStoreId());
    loadPharmacyOrders();
  }
  if (role === 'admin') loadAdminData();
}


// Sub-Tab Switchers for Consolidated Dashboards
function switchPharmacySubTab(tabName) {
  const subTabs = ['orders', 'inventory', 'hospital', 'ai', 'delivery'];
  subTabs.forEach(t => {
    const capitalized = (t === 'ai') ? 'AI' : (t.charAt(0).toUpperCase() + t.slice(1));
    const btn = document.getElementById(`pharmTabBtn${capitalized}`);
    const content = document.getElementById(`pharmSubTab${capitalized}`);
    if (btn) btn.classList.toggle('active', t === tabName);
    if (content) content.style.display = (t === tabName) ? 'block' : 'none';
  });

  if (tabName === 'ai') loadAIForecastingData();
  if (tabName === 'inventory') loadPharmacyInventory(getStoreId());
  if (tabName === 'orders') loadPharmacyOrders();
  if (tabName === 'delivery') loadDeliveryDispatches();
}

function switchAdminSubTab(tabName) {
  const subTabs = ['patients', 'pharmacies', 'audit'];
  subTabs.forEach(t => {
    const capitalized = t.charAt(0).toUpperCase() + t.slice(1);
    const btn = document.getElementById(`adminTabBtn${capitalized}`);
    const content = document.getElementById(`adminSubTab${capitalized}`);
    if (btn) btn.classList.toggle('active', t === tabName);
    if (content) content.style.display = (t === tabName) ? 'block' : 'none';
  });
}

function openAuthModal(targetRole = null) {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.classList.add('active');
    if (targetRole) {
      const select = document.getElementById('loginRoleSelect');
      if (select) select.value = targetRole;
    }
  }
}

async function quickLoginDemo(role) {
  const credentials = {
    patient: { email: 'rahul@pharmaconnect.ai', pass: 'PatientPass@123' },
    pharmacy: { email: 'apollo@pharmaconnect.ai', pass: 'PharmaPass@123' },
    admin: { email: 'admin@pharmaconnect.ai', pass: 'AdminPass@123' }
  };

  if (!credentials[role]) return;

  const select = document.getElementById('loginRoleSelect');
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPassword');

  if (select) select.value = role;
  if (emailInput) emailInput.value = credentials[role].email;
  if (passInput) passInput.value = credentials[role].pass;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials[role].email,
        password: credentials[role].pass,
        role: role
      })
    });
    const data = await res.json();
    if (res.ok && data.status === 'OTP_REQUIRED') {
      const res2 = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: credentials[role].email,
          password: credentials[role].pass,
          otp_code: data.otp_demo || '123456',
          role: role
        })
      });
      const data2 = await res2.json();
      if (res2.ok && data2.status === 'SUCCESS') {
        completeUserLogin(data2);
        return;
      }
    } else if (res.ok && data.status === 'SUCCESS') {
      completeUserLogin(data);
    } else {
      alert(`❌ ${data.detail || 'Quick demo login failed.'}`);
    }
  } catch (err) {
    alert("Quick login error.");
  }
}


function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('active');
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const regForm = document.getElementById('registerForm');
  const loginBtn = document.getElementById('tabAuthLoginBtn');
  const regBtn = document.getElementById('tabAuthRegisterBtn');

  if (tab === 'login') {
    loginForm.style.display = 'block';
    regForm.style.display = 'none';
    loginBtn.classList.add('active');
    regBtn.classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    regForm.style.display = 'block';
    loginBtn.classList.remove('active');
    regBtn.classList.add('active');
  }
}

function autoFillDemo(role) {
  switchAuthTab('login');
  const emailInput = document.getElementById('loginEmail');
  const passInput = document.getElementById('loginPassword');
  const roleSelect = document.getElementById('loginRoleSelect');

  const demoCreds = {
    patient: { email: 'patient@pharma.ai', pass: 'patient123' },
    pharmacy: { email: 'apollo@pharma.ai', pass: 'pharma123' },
    hospital: { email: 'hospital@pharma.ai', pass: 'hosp123' },
    delivery: { email: 'delivery@pharma.ai', pass: 'rider123' },
    admin: { email: 'admin@pharma.ai', pass: 'admin123' }
  };

  if (demoCreds[role]) {
    emailInput.value = demoCreds[role].email;
    passInput.value = demoCreds[role].pass;
    roleSelect.value = role;
  }
}

function toggleRoleRegisterFields() {
  const role = document.getElementById('regRoleSelect').value;
  const pharmFields = document.getElementById('regPharmacyFields');
  if (pharmFields) {
    pharmFields.style.display = (role === 'pharmacy') ? 'block' : 'none';
    if (role === 'pharmacy') {
      const latInput = document.getElementById('regLatInApp');
      if (latInput && !latInput.value) {
        setInAppStoreLocationPalghar();
      }
    }
  }
}

function detectInAppStoreLocation() {
  const statusEl = document.getElementById('inAppLocationStatus');
  const latInput = document.getElementById('regLatInApp');
  const lngInput = document.getElementById('regLngInApp');
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

      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
        .then(r => r.json())
        .then(d => {
          if (addrInput && (!addrInput.value || addrInput.value.includes('Address') || addrInput.value.includes('Palghar'))) {
            addrInput.value = d.display_name || `${lat}, ${lng}`;
          }
        })
        .catch(() => {});
    },
    err => {
      if (statusEl) statusEl.innerText = '⚠️ Could not fetch GPS. Switched to Palghar demo coordinates.';
      setInAppStoreLocationPalghar();
    },
    { timeout: 8000 }
  );
}

function setInAppStoreLocationPalghar() {
  const latInput = document.getElementById('regLatInApp');
  const lngInput = document.getElementById('regLngInApp');
  const addrInput = document.getElementById('regAddress');
  const statusEl = document.getElementById('inAppLocationStatus');

  const jitterLat = (Math.random() - 0.5) * 0.008;
  const jitterLng = (Math.random() - 0.5) * 0.008;
  const palgharLat = parseFloat((19.6967 + jitterLat).toFixed(5));
  const palgharLng = parseFloat((72.7699 + jitterLng).toFixed(5));

  if (latInput) latInput.value = palgharLat;
  if (lngInput) lngInput.value = palgharLng;
  if (addrInput && (!addrInput.value || addrInput.value === 'Address')) {
    addrInput.value = 'Station Road, Palghar West, Maharashtra - 401404';
  }
  if (statusEl) {
    statusEl.innerHTML = `📍 Demo: <strong>Palghar, Maharashtra (${palgharLat}, ${palgharLng})</strong>`;
  }
}

function togglePasswordVisibility(inputId, eyeIconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(eyeIconId);
  if (!input || !icon) return;

  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-solid fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fa-solid fa-eye';
  }
}

function evaluatePasswordStrength(password) {
  const bar = document.getElementById('pwdStrengthBar');
  const text = document.getElementById('pwdStrengthText');
  if (!bar || !text) return;

  let score = 0;
  if (password.length >= 6) score += 25;
  if (password.length >= 10) score += 25;
  if (/[0-9]/.test(password)) score += 25;
  if (/[^A-Za-z0-9]/.test(password)) score += 25;

  bar.style.width = `${score}%`;

  if (score <= 25) {
    bar.style.background = 'var(--rose-danger)';
    text.innerText = 'Strength: Weak (Add numbers & special chars)';
    text.style.color = 'var(--rose-danger)';
  } else if (score <= 50) {
    bar.style.background = 'var(--amber-warning)';
    text.innerText = 'Strength: Fair';
    text.style.color = 'var(--amber-warning)';
  } else if (score <= 75) {
    bar.style.background = 'var(--medical-blue)';
    text.innerText = 'Strength: Good';
    text.style.color = 'var(--medical-blue)';
  } else {
    bar.style.background = 'var(--emerald-green)';
    text.innerText = 'Strength: Excellent & Secure!';
    text.style.color = 'var(--emerald-green)';
  }
}

function selectAvatar(avatarFile, element) {
  document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('active'));
  element.classList.add('active');
  const hiddenInput = document.getElementById('regAvatarSelected');
  if (hiddenInput) hiddenInput.value = avatarFile;
}

// 2-Step Login Handlers
let pendingLoginEmail = '';
let pendingLoginPassword = '';
let pendingLoginRole = '';

async function handleUserLoginStep1(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const role = document.getElementById('loginRoleSelect').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role })
    });

    const data = await res.json();
    if (res.ok && data.status === 'OTP_REQUIRED') {
      pendingLoginEmail = email;
      pendingLoginPassword = password;
      pendingLoginRole = role;

      document.getElementById('loginStep1Container').style.display = 'none';
      document.getElementById('loginStep2Container').style.display = 'block';
      document.getElementById('otpEmailTargetDisplay').innerText = email;
      
      const alertBox = document.getElementById('otpDemoAlertBox');
      if (alertBox) {
        alertBox.innerText = `🔒 Simulated SMS Code: ${data.otp_demo}`;
      }

      const otpInput = document.getElementById('loginOtpInput');
      if (otpInput) {
        otpInput.value = data.otp_demo; // Auto-fill for friction-free testing
        otpInput.focus();
      }
    } else if (res.ok && data.status === 'SUCCESS') {
      completeUserLogin(data);
    } else {
      alert(`❌ ${data.detail || 'Login failed. Please check credentials.'}`);
    }
  } catch (err) {
    alert("Login request failed. Make sure server is running.");
  }
}

async function handleUserLoginStep2() {
  const otpCode = document.getElementById('loginOtpInput').value.trim();
  if (!otpCode || otpCode.length !== 6) {
    alert("Please enter a valid 6-digit OTP code.");
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: pendingLoginEmail,
        password: pendingLoginPassword,
        otp_code: otpCode,
        role: pendingLoginRole
      })
    });

    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      completeUserLogin(data);
    } else {
      alert(`❌ ${data.detail || 'OTP verification failed.'}`);
    }
  } catch (err) {
    alert("OTP verification error.");
  }
}

function completeUserLogin(data) {
  currentUser = data.user;
  currentPharmacyStore = data.store || null;

  localStorage.setItem('pharma_user', JSON.stringify(currentUser));
  if (currentPharmacyStore) localStorage.setItem('pharma_store', JSON.stringify(currentPharmacyStore));

  updateUserSessionUI();
  closeAuthModal();
  backToLoginStep1();
  alert(`🎉 ${data.message}`);

  switchRole(currentUser.role);
}

function backToLoginStep1() {
  document.getElementById('loginStep1Container').style.display = 'block';
  document.getElementById('loginStep2Container').style.display = 'none';
}

async function resendLoginOTP() {
  if (!pendingLoginEmail) return;
  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingLoginEmail, purpose: 'login' })
    });
    const data = await res.json();
    if (data.otp_demo) {
      document.getElementById('otpDemoAlertBox').innerText = `🔒 New Simulated SMS Code: ${data.otp_demo}`;
      document.getElementById('loginOtpInput').value = data.otp_demo;
    }
    alert(`🔒 New 6-Digit OTP code sent to ${pendingLoginEmail}!`);
  } catch (err) {
    alert("Failed to resend OTP.");
  }
}

async function handleUserRegister(e) {
  e.preventDefault();
  const role = document.getElementById('regRoleSelect').value;
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPassword').value;
  const phone = document.getElementById('regPhone').value;
  const address = document.getElementById('regAddress').value;
  const license = document.getElementById('regLicense') ? document.getElementById('regLicense').value : '';
  const avatar = document.getElementById('regAvatarSelected') ? document.getElementById('regAvatarSelected').value : 'patient_avatar.png';
  const secQuestion = document.getElementById('regSecQuestion') ? document.getElementById('regSecQuestion').value : '';
  const secAnswer = document.getElementById('regSecAnswer') ? document.getElementById('regSecAnswer').value : '';

  const latVal = document.getElementById('regLatInApp') ? parseFloat(document.getElementById('regLatInApp').value) : null;
  const lngVal = document.getElementById('regLngInApp') ? parseFloat(document.getElementById('regLngInApp').value) : null;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, email, password, role, phone, address, license,
        avatar, security_question: secQuestion, security_answer: secAnswer,
        lat: !isNaN(latVal) ? latVal : null,
        lng: !isNaN(lngVal) ? lngVal : null
      })
    });

    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      currentUser = data.user;
      currentPharmacyStore = data.store || null;

      localStorage.setItem('pharma_user', JSON.stringify(currentUser));
      if (currentPharmacyStore) localStorage.setItem('pharma_store', JSON.stringify(currentPharmacyStore));

      updateUserSessionUI();
      closeAuthModal();
      alert(`🎉 ${data.message}`);
      // Refresh facilities and map so newly registered pharmacy immediately appears!
      _loadFacilitiesData();
      switchRole(currentUser.role);
    } else {
      alert(`❌ ${data.detail || 'Registration failed.'}`);
    }
  } catch (err) {
    alert("Registration error.");
  }
}

function logoutUser() {
  currentUser = null;
  currentPharmacyStore = null;
  localStorage.removeItem('pharma_user');
  localStorage.removeItem('pharma_store');
  localStorage.removeItem('pharma_cart');
  // Redirect to dedicated login page
  window.location.replace('/login');
}

// Forgot Password Flow
function openForgotPasswordModal() {
  closeAuthModal();
  const modal = document.getElementById('forgotPasswordModal');
  if (modal) modal.classList.add('active');
}

function closeForgotPasswordModal() {
  const modal = document.getElementById('forgotPasswordModal');
  if (modal) modal.classList.remove('active');
}

let resetEmailTarget = '';

async function handleSendResetOTP(e) {
  e.preventDefault();
  const email = document.getElementById('forgotEmail').value.trim();
  resetEmailTarget = email;

  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, purpose: 'reset' })
    });
    const data = await res.json();

    document.getElementById('forgotPasswordForm').style.display = 'none';
    const form2 = document.getElementById('resetPasswordStep2Form');
    form2.style.display = 'block';
    
    document.getElementById('resetOtpHint').innerText = `🔒 Simulated OTP Code: ${data.otp_demo}`;
    document.getElementById('resetOtpCode').value = data.otp_demo;
  } catch (err) {
    alert("Reset request failed.");
  }
}

async function handleResetPasswordFinal(e) {
  e.preventDefault();
  const otpCode = document.getElementById('resetOtpCode').value.trim();
  const newPassword = document.getElementById('resetNewPassword').value;

  try {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetEmailTarget, otp_code: otpCode, new_password: newPassword })
    });

    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      alert(`🎉 ${data.message}`);
      closeForgotPasswordModal();
      openAuthModal();
    } else {
      alert(`❌ ${data.detail || 'Reset failed.'}`);
    }
  } catch (err) {
    alert("Reset failed.");
  }
}

// User Profile Settings Modal
function openUserProfileModal() {
  if (!currentUser) {
    openAuthModal();
    return;
  }

  const modal = document.getElementById('userProfileModal');
  if (!modal) return;

  document.getElementById('profileNameDisplay').innerText = currentUser.name;
  document.getElementById('profileRoleBadge').innerText = currentUser.role.toUpperCase();
  document.getElementById('editProfName').value = currentUser.name;
  document.getElementById('editProfPhone').value = currentUser.phone || '';
  document.getElementById('editProfAddress').value = currentUser.address || '';

  modal.classList.add('active');
}

function closeUserProfileModal() {
  const modal = document.getElementById('userProfileModal');
  if (modal) modal.classList.remove('active');
}

async function handleUserProfileSave(e) {
  e.preventDefault();
  const name = document.getElementById('editProfName').value;
  const phone = document.getElementById('editProfPhone').value;
  const address = document.getElementById('editProfAddress').value;

  try {
    const res = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser.id,
        name: name,
        phone: phone,
        address: address,
        avatar: currentUser.avatar || 'patient_avatar.png'
      })
    });

    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      currentUser = data.user;
      localStorage.setItem('pharma_user', JSON.stringify(currentUser));
      updateUserSessionUI();
      closeUserProfileModal();
      alert("🎉 Profile details updated successfully!");
    } else {
      alert("Profile update failed.");
    }
  } catch (err) {
    alert("Profile update error.");
  }
}

// AI Health Chatbot Functions
function toggleAIChatbotWindow() {
  const win = document.getElementById('aiChatbotWindow');
  if (win) win.classList.toggle('active');
}

async function sendChatMessage() {
  const input = document.getElementById('chatbotInput');
  const text = input.value.trim();
  if (!text) return;

  const msgsDiv = document.getElementById('chatbotMessages');
  
  // User bubble
  msgsDiv.innerHTML += `<div class="chat-msg user">${text}</div>`;
  input.value = '';
  msgsDiv.scrollTop = msgsDiv.scrollHeight;

  // Bot thinking indicator
  const thinkId = 'think-' + Date.now();
  msgsDiv.innerHTML += `<div class="chat-msg bot" id="${thinkId}"><i class="fa-solid fa-spinner fa-spin"></i> Thinking...</div>`;
  msgsDiv.scrollTop = msgsDiv.scrollHeight;

  try {
    const res = await fetch('/api/ai/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, user_role: currentRole })
    });
    const data = await res.json();
    
    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) {
      thinkEl.innerHTML = data.reply.replace(/\n/g, '<br>');
    }
    msgsDiv.scrollTop = msgsDiv.scrollHeight;
  } catch (err) {
    const thinkEl = document.getElementById(thinkId);
    if (thinkEl) thinkEl.innerText = "Error connecting to AI Healthcare Assistant.";
  }
}

// Generic Substitute Comparator Tool
function showSubstituteComparison(formulation) {
  const container = document.getElementById('substituteResultsContainer');
  if (!container) return;

  const comparisons = {
    'Paracetamol 650mg': [
      { brand: "Dolo 650 (Micro Labs)", mrp: 30.50, isGeneric: false },
      { brand: "Calpol 650 (GSK)", mrp: 31.00, isGeneric: false },
      { brand: "Jan Aushadhi Paracetamol 650mg", mrp: 9.50, isGeneric: true, savings: "69%" }
    ],
    'Azithromycin 500mg': [
      { brand: "Azithral 500 (Alembic)", mrp: 120.00, isGeneric: false },
      { brand: "Azee 500 (Cipla)", mrp: 118.50, isGeneric: false },
      { brand: "Jan Aushadhi Azithromycin 500mg", mrp: 38.00, isGeneric: true, savings: "68%" }
    ],
    'Pantoprazole 40mg': [
      { brand: "Pan 40 (Alkem)", mrp: 85.00, isGeneric: false },
      { brand: "Pantocid 40 (Sun Pharma)", mrp: 88.00, isGeneric: false },
      { brand: "Jan Aushadhi Pantoprazole 40mg", mrp: 22.00, isGeneric: true, savings: "74%" }
    ]
  };

  const list = comparisons[formulation] || comparisons['Paracetamol 650mg'];

  let html = `<div style="font-weight:700; color:var(--text-primary); margin-bottom:8px;">Formulation: ${formulation}</div>`;
  list.forEach(item => {
    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:8px 12px; border-radius:6px; margin-bottom:6px; border:1px solid var(--border-color);">
        <div>
          <strong style="color:${item.isGeneric ? 'var(--emerald-green)' : 'var(--text-primary)'};">${item.brand}</strong>
          ${item.isGeneric ? `<span class="badge badge-green" style="margin-left:6px;">Generic Jan Aushadhi (${item.savings} OFF)</span>` : ''}
        </div>
        <div style="font-weight:800; color:${item.isGeneric ? 'var(--emerald-green)' : 'var(--text-primary)'};">₹ ${item.mrp.toFixed(2)}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ==========================================
// THEME & UTILITY CONTROLS
// ==========================================

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  
  const icon = document.getElementById('themeToggleBtn').querySelector('i');
  icon.className = newTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function toggleAccessibility() {
  document.body.classList.toggle('accessibility-mode');
  alert(document.body.classList.contains('accessibility-mode') 
    ? "Elderly Accessibility Mode Enabled: Larger Text & High Contrast."
    : "Standard Mode Restored.");
}

function toggleRuralMode() {
  document.body.classList.toggle('rural-mode-active');
}

function changeLanguage(lang) {
  currentLanguage = lang;
  const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// Fetch Landing Page Stats
async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();
    document.getElementById('statPharmacies').innerText = data.registered_pharmacies + '+';
    document.getElementById('statMedicines').innerText = data.medicines_tracked.toLocaleString() + '+';
    document.getElementById('statDeliveries').innerText = data.emergency_deliveries.toLocaleString() + '+';
    document.getElementById('statForecastAccuracy').innerText = data.forecast_accuracy;
  } catch (err) {
    console.error("Stats fetch error", err);
  }
}

// ==========================================
// MAP ENGINE — Leaflet (default) + Google Maps (optional upgrade)
// ==========================================

// ==========================================
// HEALTHCARE MAP ENGINE & SURROUNDING FACILITIES
// (Medical Stores + Emergency Hospitals with Palghar Demo)
// ==========================================

let _googleMap       = null;
let _leafletMap      = null;
let _googleMarkers   = [];
let _leafletMarkers  = [];
let _leafletUserMarker = null;
let _markerMapById   = {}; // map facility.id -> marker for easy focus

let _userCoords = { lat: 19.6967, lng: 72.7699 }; // Palghar, Maharashtra demo default
let _userLocationName = "Palghar, Maharashtra (Demo Area)";
let _allFacilities = [];
let _activeCategory = "all";
let _facilitySearchTerm = "";
let _facilitySortTerm = "distance";

// ── Default map: Leaflet + OpenStreetMap (no API key required) ──────────────
function initMap() {
  const container = document.getElementById('googleMapContainer');
  if (!container) return;

  // Retrieve any stored location from localStorage
  try {
    const saved = localStorage.getItem('pharma_user_location');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.lat && parsed.lng) {
        _userCoords = { lat: parsed.lat, lng: parsed.lng };
        _userLocationName = parsed.name || _userLocationName;
      }
    }
  } catch(e) {}

  updateLocationUI(_userLocationName);

  // If Google Maps API key is configured, initGoogleMap() will be called by script callback
  if (window._gmapsLoaded) return;

  if (!_leafletMap) {
    _leafletMap = L.map('googleMapContainer').setView([_userCoords.lat, _userCoords.lng], 14);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> | Pharma-Connect AI'
    }).addTo(_leafletMap);
  }

  // Load both Medical Stores and Hospitals around user location
  _loadFacilitiesData();
}

function updateLocationUI(locName) {
  const badge = document.getElementById('activeLocationBadge');
  const nameDisp = document.getElementById('userLocationNameDisplay');
  if (badge) badge.innerHTML = `📍 ${locName}`;
  if (nameDisp) nameDisp.innerText = locName;
}

// ── Geolocation & Demo Handlers ─────────────────────────────────────────────

function detectUserLocation(isUserClick = false) {
  const badge = document.getElementById('activeLocationBadge');
  if (badge) badge.innerHTML = `📡 Detecting your GPS location...`;

  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser. Defaulting to Palghar, Maharashtra demo location.");
    setDemoLocationPalghar();
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      _userCoords = {
        lat: parseFloat(pos.coords.latitude.toFixed(5)),
        lng: parseFloat(pos.coords.longitude.toFixed(5))
      };

      // Reverse geocode via OpenStreetMap Nominatim
      fetch(`https://nominatim.openstreetmap.org/reverse?lat=${_userCoords.lat}&lon=${_userCoords.lng}&format=json`)
        .then(r => r.json())
        .then(d => {
          const area = d.address ? (d.address.city || d.address.town || d.address.suburb || d.address.county || 'Your Area') : 'Current Location';
          _userLocationName = `${area} (${_userCoords.lat.toFixed(3)}, ${_userCoords.lng.toFixed(3)})`;
          updateLocationUI(_userLocationName);
          localStorage.setItem('pharma_user_location', JSON.stringify({ lat: _userCoords.lat, lng: _userCoords.lng, name: _userLocationName }));
        })
        .catch(() => {
          _userLocationName = `Current GPS (${_userCoords.lat.toFixed(3)}, ${_userCoords.lng.toFixed(3)})`;
          updateLocationUI(_userLocationName);
        });

      if (_leafletMap) {
        _leafletMap.setView([_userCoords.lat, _userCoords.lng], 14);
      }
      if (_googleMap) {
        _googleMap.setCenter(_userCoords);
      }

      _loadFacilitiesData();
      if (isUserClick) {
        // notification feedback
        const notif = document.getElementById('ruralBanner');
        if (notif) {
          notif.innerHTML = `📍 <strong>Location Detected:</strong> Showing surrounding medical stores & hospitals near you!`;
          notif.style.display = 'block';
          setTimeout(() => { if (notif) notif.style.display = 'none'; }, 4000);
        }
      }
    },
    err => {
      console.warn("Geolocation permission not granted or error, using Palghar demo:", err);
      if (isUserClick) {
        alert("Location access was denied or timed out. Switched to Palghar, Maharashtra demo location.");
      }
      setDemoLocationPalghar();
    },
    { timeout: 8000 }
  );
}

function setDemoLocationPalghar(isUserClick = false) {
  _userCoords = { lat: 19.6967, lng: 72.7699 };
  _userLocationName = "Palghar, Maharashtra (Demo Area)";
  updateLocationUI(_userLocationName);
  localStorage.setItem('pharma_user_location', JSON.stringify({ lat: _userCoords.lat, lng: _userCoords.lng, name: _userLocationName }));

  if (_leafletMap) {
    _leafletMap.setView([_userCoords.lat, _userCoords.lng], 14);
  }
  if (_googleMap) {
    _googleMap.setCenter(_userCoords);
  }

  _loadFacilitiesData();
}

// ── Load Facilities Data from API ───────────────────────────────────────────

async function _loadFacilitiesData() {
  try {
    const res = await fetch(`/api/facilities?lat=${_userCoords.lat}&lng=${_userCoords.lng}&category=all`);
    const data = await res.json();

    if (data.facilities && data.facilities.length > 0) {
      _allFacilities = data.facilities;
    } else {
      _allFacilities = _getStaticPalgharFacilities();
    }

    // Update facility count badges
    const allEl  = document.getElementById('countAllFacilities');
    const phEl   = document.getElementById('countPharmacies');
    const hoEl   = document.getElementById('countHospitals');
    if (allEl) allEl.innerText = _allFacilities.length;
    if (phEl)  phEl.innerText  = _allFacilities.filter(f => f.type === 'pharmacy').length;
    if (hoEl)  hoEl.innerText  = _allFacilities.filter(f => f.type === 'hospital').length;

    // Render Markers on Active Map (Leaflet or Google)
    _renderMapMarkers();

    // Render Healthcare Facilities List below the map
    _renderNearbyFacilitiesList();

    // Sync cart fulfilling pharmacy dropdown options with latest database stores
    _syncCartPharmacyDropdown();

  } catch (err) {
    console.warn("Facilities fetch error, using fallback Palghar data:", err);
    _allFacilities = _getStaticPalgharFacilities();
    _renderMapMarkers();
    _renderNearbyFacilitiesList();
    _syncCartPharmacyDropdown();
  }
}

function _getStaticPalgharFacilities() {
  return [
    {
      id: "PH-001", type: "pharmacy", subtype: "Medical Store & Chemist",
      name: "Apollo Pharmacy - Palghar Station", license: "DL-2024-AP8819",
      address: "Station Road, Palghar West, Maharashtra - 401404", phone: "+91 98201 12345",
      lat: 19.6975, lng: 72.7678, rating: 4.9, is_open: true, emergency_delivery: true,
      total_stock: 140, status_badge: "140 Meds in Stock", badge_color: "green", distance_km: 0.25
    },
    {
      id: "PH-002", type: "pharmacy", subtype: "Medical Store & Chemist",
      name: "Sanjivani Medical & General Stores", license: "DL-2024-HP4412",
      address: "Kacheri Road, Near Post Office, Palghar, Maharashtra - 401404", phone: "+91 98202 23456",
      lat: 19.6982, lng: 72.7710, rating: 4.8, is_open: true, emergency_delivery: true,
      total_stock: 115, status_badge: "115 Meds in Stock", badge_color: "green", distance_km: 0.32
    },
    {
      id: "PH-003", type: "pharmacy", subtype: "Medical Store & Chemist",
      name: "Mahavir Chemist & Druggist", license: "DL-2024-WM9931",
      address: "Near ST Bus Stand, Palghar East, Maharashtra - 401404", phone: "+91 98203 34567",
      lat: 19.6955, lng: 72.7745, rating: 4.7, is_open: true, emergency_delivery: true,
      total_stock: 100, status_badge: "100 Meds in Stock", badge_color: "green", distance_km: 0.52
    },
    {
      id: "PH-004", type: "pharmacy", subtype: "Medical Store & Chemist",
      name: "Lifeline 24x7 Medicos", license: "DL-2024-CF1029",
      address: "Manor Road, Opposite District Court, Palghar, Maharashtra - 401404", phone: "+91 98204 45678",
      lat: 19.7010, lng: 72.7730, rating: 4.9, is_open: true, emergency_delivery: true,
      total_stock: 160, status_badge: "160 Meds in Stock", badge_color: "green", distance_km: 0.65
    },
    {
      id: "PH-005", type: "pharmacy", subtype: "Medical Store & Chemist",
      name: "Wellness Pharmacy & Surgicals", license: "DL-2024-LH7741",
      address: "Shirgaon Naka, Palghar West, Maharashtra - 401404", phone: "+91 98205 56789",
      lat: 19.6920, lng: 72.7620, rating: 4.6, is_open: true, emergency_delivery: true,
      total_stock: 125, status_badge: "125 Meds in Stock", badge_color: "green", distance_km: 0.85
    },
    {
      id: "HOSP-001", type: "hospital", subtype: "District Civil Hospital & 24/7 Trauma",
      name: "Palghar District Civil Hospital", license: "REG-HOSP-PALGHAR",
      address: "Opp. Collector Office, Palghar West, Maharashtra - 401404", phone: "+91 2525 252244",
      lat: 19.7040, lng: 72.7750, rating: 4.7, is_open: true, emergency_delivery: true,
      icu_beds: 24, services: "24/7 Trauma, ICU, Blood Bank, Emergency OT",
      total_stock: 220, status_badge: "ICU: 24 Beds • 220 Meds in Stock", badge_color: "blue", distance_km: 0.95
    },
    {
      id: "HOSP-002", type: "hospital", subtype: "Multi-Specialty & ICU Center",
      name: "Shraddha Hospital & Critical Care", license: "REG-HOSP-PALGHAR",
      address: "Station Road, Palghar West, Maharashtra - 401404", phone: "+91 2525 253100",
      lat: 19.6990, lng: 72.7660, rating: 4.8, is_open: true, emergency_delivery: true,
      icu_beds: 16, services: "ICU, Emergency Surgery, Cardiac Care, Ventilators",
      total_stock: 150, status_badge: "ICU: 16 Beds • 150 Meds in Stock", badge_color: "blue", distance_km: 0.45
    },
    {
      id: "HOSP-003", type: "hospital", subtype: "Rural Health & Charitable Hospital",
      name: "Dr. M. L. Dhawale Memorial Hospital", license: "REG-HOSP-PALGHAR",
      address: "Rural Health Campus, Palghar East, Maharashtra - 401404", phone: "+91 2525 256932",
      lat: 19.6890, lng: 72.7810, rating: 4.9, is_open: true, emergency_delivery: true,
      icu_beds: 20, services: "Emergency Ward, Multispecialty, Diagnostic Imaging, Dialysis",
      total_stock: 190, status_badge: "ICU: 20 Beds • 190 Meds in Stock", badge_color: "blue", distance_km: 1.2
    },
    {
      id: "HOSP-004", type: "hospital", subtype: "Super Specialty & Emergency Care",
      name: "Ved Multispeciality Hospital & Trauma", license: "REG-HOSP-PALGHAR",
      address: "Manor Road, Palghar, Maharashtra - 401404", phone: "+91 2525 254888",
      lat: 19.7025, lng: 72.7715, rating: 4.6, is_open: true, emergency_delivery: true,
      icu_beds: 14, services: "24/7 Emergency, Ventilators, Ambulance Dispatch",
      total_stock: 175, status_badge: "ICU: 14 Beds • 175 Meds in Stock", badge_color: "blue", distance_km: 0.75
    },
    {
      id: "HOSP-005", type: "hospital", subtype: "Maternity & Emergency Clinic",
      name: "Philia Hospital & Maternity Home", license: "REG-HOSP-PALGHAR",
      address: "Kelve Road Junction, Palghar West, Maharashtra - 401404", phone: "+91 2525 251020",
      lat: 19.6935, lng: 72.7685, rating: 4.7, is_open: true, emergency_delivery: true,
      icu_beds: 8, services: "Emergency Care, Pediatric ICU, 24/7 In-House Pharmacy",
      total_stock: 160, status_badge: "ICU: 8 Beds • 160 Meds in Stock", badge_color: "blue", distance_km: 0.6
    }
  ];
}

// ── Map Marker Rendering (Leaflet & Google) ─────────────────────────────────

function _renderMapMarkers() {
  if (_leafletMap) {
    _renderLeafletMarkers();
  } else if (_googleMap) {
    _renderGoogleMarkers();
  }
}

function _renderLeafletMarkers() {
  if (!_leafletMap) return;

  // Clear previous markers
  _leafletMarkers.forEach(m => _leafletMap.removeLayer(m));
  _leafletMarkers = [];
  _markerMapById = {};

  // Render User Location Pulsing Dot
  if (_leafletUserMarker) {
    _leafletMap.removeLayer(_leafletUserMarker);
  }
  _leafletUserMarker = L.circleMarker([_userCoords.lat, _userCoords.lng], {
    color: '#ffffff', weight: 3,
    fillColor: '#0284c7', fillOpacity: 1, radius: 10
  }).addTo(_leafletMap).bindPopup(`
    <div style="font-family:var(--font-sans); padding:4px; text-align:center;">
      <strong style="color:#0284c7; font-size:13px;">📍 You Are Here</strong><br>
      <span style="font-size:11px; color:#64748b;">${_userLocationName}</span>
    </div>
  `);

  // Filter facilities by active category
  const filtered = _allFacilities.filter(f => {
    if (_activeCategory === 'all') return true;
    return f.type === _activeCategory;
  });

  filtered.forEach(f => {
    const isPharm = (f.type === 'pharmacy');
    const color = isPharm
      ? (f.total_stock > 30 ? '#10b981' : (f.total_stock > 0 ? '#f59e0b' : '#ef4444'))
      : '#2563eb';

    const radius = isPharm ? 12 : 14;

    const marker = L.circleMarker([f.lat, f.lng], {
      color: '#ffffff', weight: 2,
      fillColor: color, fillOpacity: 0.92, radius: radius
    }).addTo(_leafletMap);

    const typeBadge = isPharm
      ? `<span style="background:#ecfdf5; color:#065f46; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">🏪 Medical Store</span>`
      : `<span style="background:#eff6ff; color:#1e40af; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">🏥 ${f.subtype || 'Hospital & ICU'}</span>`;

    const cleanName = (f.name || '').replace(/'/g, "\\'");
    const actionBtn = isPharm
      ? `<button onclick="openFacilityMedicinesModal('${f.id}','${cleanName}','pharmacy')" style="background:#0284c7; color:#fff; border:none; padding:7px 10px; border-radius:6px; font-size:11px; cursor:pointer; width:100%; font-weight:700; margin-top:6px; display:flex; align-items:center; justify-content:center; gap:6px;"><i class="fa-solid fa-cart-shopping"></i> Order Medicines (${f.total_stock || 0} in stock)</button>`
      : `<div style="display:flex; gap:6px; margin-top:6px;">
           <button onclick="openFacilityMedicinesModal('${f.id}','${cleanName}','hospital')" style="background:#0284c7; color:#fff; border:none; padding:6px 8px; border-radius:6px; font-size:11px; cursor:pointer; flex:1; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;"><i class="fa-solid fa-pills"></i> Hospital Meds (${f.total_stock || 0})</button>
           <button onclick="openEmergencyModalForHospital('${cleanName}')" style="background:#dc2626; color:#fff; border:none; padding:6px 8px; border-radius:6px; font-size:11px; cursor:pointer; flex:1; font-weight:700; display:flex; align-items:center; justify-content:center; gap:4px;"><i class="fa-solid fa-truck-medical"></i> Emergency</button>
         </div>`;

    marker.bindPopup(`
      <div style="font-family:sans-serif; padding:4px; min-width:215px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
          <strong style="font-size:13px; color:#0f172a;">${f.name}</strong>
        </div>
        <div style="margin-bottom:6px; display:flex; align-items:center; gap:6px;">
          ${typeBadge}
          ${f.distance_km != null ? `<span style="font-size:11px; color:#64748b; font-weight:600;">${f.distance_km} km away</span>` : ''}
        </div>
        <div style="font-size:11px; color:#475569; margin-bottom:4px; line-height:1.4;">
          📍 ${f.address}<br>
          📞 <a href="tel:${f.phone}" style="color:#0284c7; text-decoration:none;">${f.phone}</a>
        </div>
        <div style="font-size:11px; font-weight:700; color:${color}; margin-bottom:4px;">
          ${f.status_badge || 'Active'}
        </div>
        ${actionBtn}
      </div>
    `);

    _leafletMarkers.push(marker);
    _markerMapById[f.id] = marker;
  });
}

function _renderGoogleMarkers() {
  if (!_googleMap) return;

  _googleMarkers.forEach(m => m.setMap(null));
  _googleMarkers = [];
  _markerMapById = {};

  // User Marker
  if (_googleUserMarker) _googleUserMarker.setMap(null);
  _googleUserMarker = new google.maps.Marker({
    position: _userCoords,
    map: _googleMap,
    title: 'Your Location',
    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 9, fillColor: '#0284c7', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }
  });

  const iw = new google.maps.InfoWindow();
  const filtered = _allFacilities.filter(f => (_activeCategory === 'all' || f.type === _activeCategory));

  filtered.forEach(f => {
    const isPharm = (f.type === 'pharmacy');
    const color = isPharm ? (f.total_stock > 30 ? '#10b981' : '#f59e0b') : '#2563eb';
    const m = new google.maps.Marker({
      position: { lat: f.lat, lng: f.lng },
      map: _googleMap,
      title: f.name,
      icon: { path: google.maps.SymbolPath.CIRCLE, scale: isPharm ? 11 : 13, fillColor: color, fillOpacity: 0.9, strokeColor: '#fff', strokeWeight: 2 }
    });

    m.addListener('click', () => {
      const cleanName = (f.name || '').replace(/'/g, "\\'");
      const actionHtml = isPharm
        ? `<button onclick="openFacilityMedicinesModal('${f.id}','${cleanName}','pharmacy')" style="background:#0284c7; color:#fff; border:none; padding:6px 10px; border-radius:6px; font-size:11px; cursor:pointer; width:100%; font-weight:700; margin-top:6px;">🛒 Order Medicines (${f.total_stock || 0} in stock)</button>`
        : `<div style="display:flex; gap:6px; margin-top:6px;">
             <button onclick="openFacilityMedicinesModal('${f.id}','${cleanName}','hospital')" style="background:#0284c7; color:#fff; border:none; padding:6px 8px; border-radius:6px; font-size:11px; cursor:pointer; flex:1; font-weight:700;">💊 Hospital Meds (${f.total_stock || 0})</button>
             <button onclick="openEmergencyModalForHospital('${cleanName}')" style="background:#dc2626; color:#fff; border:none; padding:6px 8px; border-radius:6px; font-size:11px; cursor:pointer; flex:1; font-weight:700;">🚨 Emergency</button>
           </div>`;

      iw.setContent(`
        <div style="font-family:sans-serif; padding:4px; min-width:215px;">
          <strong style="font-size:13px; color:#0f172a;">${f.name}</strong><br>
          <span style="font-size:11px; color:#64748b;">${isPharm ? '🏪 Medical Store' : '🏥 Hospital'} &bull; ${f.distance_km != null ? f.distance_km + ' km' : ''}</span><br>
          <div style="font-size:11px; color:#475569; margin:3px 0;">📍 ${f.address}</div>
          <span style="color:${color}; font-weight:700; font-size:12px;">${f.status_badge}</span>
          ${actionHtml}
        </div>
      `);
      iw.open(_googleMap, m);
    });

    _googleMarkers.push(m);
    _markerMapById[f.id] = m;
  });
}

// ── Render Healthcare Facilities Cards Below the Map ────────────────────────

function _renderNearbyFacilitiesList() {
  const container = document.getElementById('nearbyFacilitiesContainer');
  if (!container) return;

  let list = _allFacilities.filter(f => {
    if (_activeCategory !== 'all' && f.type !== _activeCategory) return false;
    if (_facilitySearchTerm) {
      const q = _facilitySearchTerm.toLowerCase();
      return (f.name.toLowerCase().includes(q) || f.address.toLowerCase().includes(q));
    }
    return true;
  });

  // Sort
  if (_facilitySortTerm === 'distance') {
    list.sort((a, b) => (a.distance_km != null ? a.distance_km : 999) - (b.distance_km != null ? b.distance_km : 999));
  } else if (_facilitySortTerm === 'rating') {
    list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (_facilitySortTerm === 'name') {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 30px; background: var(--bg-subtle); border-radius: 8px;">
        <i class="fa-solid fa-store-slash" style="font-size: 28px; color: var(--text-muted); margin-bottom: 8px;"></i>
        <div style="font-weight: 700;">No healthcare facilities found matching your filter.</div>
        <p style="font-size: 12px; color: var(--text-muted);">Try selecting "All" or clearing the search box.</p>
      </div>
    `;
    return;
  }

  let html = '';
  list.forEach(f => {
    const isPharm = (f.type === 'pharmacy');
    const badgeBg = isPharm ? 'rgba(16, 185, 129, 0.12)' : 'rgba(37, 99, 235, 0.12)';
    const badgeColor = isPharm ? '#059669' : '#1d4ed8';
    const typeLabel = isPharm ? '🏪 Medical Store & Chemist' : `🏥 ${f.subtype || 'Hospital & ICU'}`;

    const statusPill = isPharm
      ? `<span class="badge badge-green" style="font-size:11px;"><i class="fa-solid fa-boxes-stacked"></i> ${f.status_badge || 'Meds Available'}</span>`
      : `<span class="badge badge-blue" style="font-size:11px;"><i class="fa-solid fa-bed-pulse"></i> ${f.status_badge || 'ICU Beds Ready'}</span>`;

    const emergencyBadge = f.emergency_delivery
      ? `<span style="font-size:11px; color:var(--emerald-green); font-weight:700;"><i class="fa-solid fa-truck-fast"></i> Express 15-min delivery</span>`
      : `<span style="font-size:11px; color:var(--text-muted);"><i class="fa-solid fa-clock"></i> Open Regular Hours</span>`;

    const cleanName = (f.name || '').replace(/'/g, "\\'");
    const primaryAction = isPharm
      ? `<button class="btn btn-primary" onclick="openFacilityMedicinesModal('${f.id}', '${cleanName}', 'pharmacy')" style="padding: 6px 12px; font-size: 12px; flex: 1;">
           <i class="fa-solid fa-cart-shopping"></i> Order Meds (${f.total_stock || 0})
         </button>`
      : `<div style="display:flex; gap:6px; flex:1;">
           <button class="btn btn-primary" onclick="openFacilityMedicinesModal('${f.id}', '${cleanName}', 'hospital')" style="padding: 6px 10px; font-size: 12px; flex: 1; background: var(--medical-blue); border-color: var(--medical-blue);">
             <i class="fa-solid fa-pills"></i> Hospital Meds (${f.total_stock || 0})
           </button>
           <button class="btn btn-primary" onclick="openEmergencyModalForHospital('${cleanName}')" style="padding: 6px 10px; font-size: 12px; background:var(--rose-danger); border-color:var(--rose-danger); flex: 1;">
             <i class="fa-solid fa-truck-medical"></i> Emergency
           </button>
         </div>`;

    html += `
      <div class="facility-card" id="card-facility-${f.id}" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 16px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: var(--shadow-sm); transition: transform 0.2s, box-shadow 0.2s;">
        <div>
          <!-- Header: Category Badge + Distance -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="background: ${badgeBg}; color: ${badgeColor}; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px;">
              ${typeLabel}
            </span>
            <span style="font-size: 12px; font-weight: 800; color: var(--medical-blue); background: var(--bg-subtle); padding: 2px 8px; border-radius: 12px;">
              📍 ${f.distance_km != null ? f.distance_km + ' km' : 'Nearby'}
            </span>
          </div>

          <!-- Facility Name & Rating -->
          <h4 style="font-size: 15px; font-weight: 800; color: var(--text-primary); margin: 0 0 6px 0; line-height: 1.3;">
            ${f.name}
          </h4>

          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 8px;">
            <span style="color: #f59e0b; font-weight: 700;"><i class="fa-solid fa-star"></i> ${f.rating || '4.8'}</span>
            <span style="color: var(--text-muted);">&bull;</span>
            ${statusPill}
          </div>

          <!-- Address & Phone -->
          <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 10px; line-height: 1.5;">
            <div><i class="fa-solid fa-location-dot" style="color:var(--text-muted); width:14px;"></i> ${f.address}</div>
            <div style="margin-top: 3px;"><i class="fa-solid fa-phone" style="color:var(--text-muted); width:14px;"></i> <a href="tel:${f.phone}" style="color:var(--medical-blue); font-weight:600; text-decoration:none;">${f.phone}</a></div>
          </div>

          <!-- Services / Features tag -->
          <div style="margin-bottom: 14px;">
            ${emergencyBadge}
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 8px; align-items: center; border-top: 1px solid var(--border-color); padding-top: 12px;">
          <button class="btn btn-secondary" onclick="focusFacilityOnMap('${f.id}')" style="padding: 6px 10px; font-size: 12px; display: flex; align-items: center; gap: 5px;">
            <i class="fa-solid fa-map-pin" style="color:var(--emerald-green);"></i> View on Map
          </button>
          ${primaryAction}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// ── Interactive Map Helpers ─────────────────────────────────────────────────

function filterFacilities(cat) {
  _activeCategory = cat;
  ['filterAllBtn', 'filterPharmBtn', 'filterHospBtn'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('active-filter');
  });

  if (cat === 'all') {
    const el = document.getElementById('filterAllBtn');
    if (el) el.classList.add('active-filter');
  } else if (cat === 'pharmacy') {
    const el = document.getElementById('filterPharmBtn');
    if (el) el.classList.add('active-filter');
  } else if (cat === 'hospital') {
    const el = document.getElementById('filterHospBtn');
    if (el) el.classList.add('active-filter');
  }

  _renderMapMarkers();
  _renderNearbyFacilitiesList();
}

function handleFacilitySearch(val) {
  _facilitySearchTerm = val.trim();
  _renderNearbyFacilitiesList();
}

function handleFacilitySort(val) {
  _facilitySortTerm = val;
  _renderNearbyFacilitiesList();
}

function focusFacilityOnMap(facilityId) {
  const fac = _allFacilities.find(f => f.id === facilityId);
  if (!fac) return;

  // Scroll to map container
  const mapSection = document.getElementById('healthcareMapSection');
  if (mapSection) {
    mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (_leafletMap) {
    _leafletMap.setView([fac.lat, fac.lng], 16, { animate: true });
    const marker = _markerMapById[facilityId];
    if (marker) {
      setTimeout(() => { marker.openPopup(); }, 300);
    }
  } else if (_googleMap) {
    _googleMap.setCenter({ lat: fac.lat, lng: fac.lng });
    _googleMap.setZoom(16);
    const marker = _markerMapById[facilityId];
    if (marker) {
      google.maps.event.trigger(marker, 'click');
    }
  }
}

function selectStoreForOrder(pharmacyId, pharmacyName) {
  const fac = _allFacilities.find(f => f.id === pharmacyId);
  const type = fac ? fac.type : 'pharmacy';
  openFacilityMedicinesModal(pharmacyId, pharmacyName, type);
}

function openEmergencyModalForHospital(hospitalName) {
  openEmergencyModal();
  const medInput = document.getElementById('emgMedicine');
  if (medInput && !medInput.value) {
    medInput.value = `Emergency Bed / ICU Admission at ${hospitalName}`;
  }
}

// ==========================================
// DEDICATED FACILITY MEDICINE CATALOG ENGINE
// ==========================================

let _currentFacilityData = null;
let _activeFacCategory = 'all';

async function openFacilityMedicinesModal(facilityId, facilityName, facilityType) {
  const modal = document.getElementById('facilityMedicinesModal');
  if (!modal) return;

  const titleEl = document.getElementById('facMedFacilityName');
  const typeBadge = document.getElementById('facMedTypeBadge');
  const addressEl = document.getElementById('facMedAddress');
  const phoneEl = document.getElementById('facMedPhone');
  const stockBadge = document.getElementById('facMedStockBadge');
  const iconContainer = document.getElementById('facMedIconContainer');
  const container = document.getElementById('facilityMedicinesContainer');
  const searchInput = document.getElementById('facilityMedSearchInput');

  if (titleEl) titleEl.innerText = facilityName;
  if (searchInput) searchInput.value = '';
  _activeFacCategory = 'all';

  const isHosp = (facilityType === 'hospital');
  if (iconContainer) {
    iconContainer.innerHTML = isHosp ? '<i class="fa-solid fa-hospital"></i>' : '<i class="fa-solid fa-clinic-medical"></i>';
    iconContainer.style.background = isHosp ? 'rgba(37, 99, 235, 0.12)' : 'rgba(16, 185, 129, 0.12)';
    iconContainer.style.color = isHosp ? '#2563eb' : '#059669';
  }
  if (typeBadge) {
    typeBadge.className = isHosp ? 'badge badge-blue' : 'badge badge-green';
    typeBadge.innerText = isHosp ? '🏥 Hospital & In-House Pharmacy' : '🏪 Medical Store & Chemist';
  }

  container.innerHTML = `
    <div style="text-align:center; padding:50px 20px; color:var(--text-muted);">
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size:32px; color:var(--medical-blue);"></i>
      <p style="margin-top:12px; font-weight:600;">Loading real-time medicine dataset for ${facilityName}...</p>
    </div>
  `;

  modal.classList.add('active');
  updateFacilityCartSummary(facilityId, facilityName);

  try {
    const res = await fetch(`/api/facilities/${facilityId}/medicines`);
    if (!res.ok) {
      container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--rose-danger);"><i class="fa-solid fa-triangle-exclamation" style="font-size:24px;"></i><p style="margin-top:8px;">Failed to load medicines dataset for this facility.</p></div>`;
      return;
    }
    const data = await res.json();
    _currentFacilityData = data;

    const fac = data.facility;
    if (addressEl) addressEl.innerHTML = `<i class="fa-solid fa-location-dot" style="color:var(--medical-blue);"></i> ${fac.address}`;
    if (phoneEl) phoneEl.innerHTML = `<i class="fa-solid fa-phone" style="color:var(--medical-blue);"></i> <a href="tel:${fac.phone}" style="color:inherit; text-decoration:none;">${fac.phone}</a>`;
    if (stockBadge) stockBadge.innerHTML = `<i class="fa-solid fa-boxes-stacked"></i> ${data.total_medicines} Medicines in Stock`;

    renderFacilityCategoryChips(data.categories || []);
    renderFacilityMedicinesList(data.medicines || []);
  } catch (err) {
    console.error("Error loading facility medicines:", err);
    container.innerHTML = `<div style="text-align:center; padding:30px; color:var(--rose-danger);">Failed to connect to facility medicine server.</div>`;
  }
}

function closeFacilityMedicinesModal() {
  const modal = document.getElementById('facilityMedicinesModal');
  if (modal) modal.classList.remove('active');
}

function renderFacilityCategoryChips(categories) {
  const container = document.getElementById('facMedCategoryChips');
  if (!container) return;

  let html = `<button onclick="filterFacilityByCategory('all')" class="badge ${_activeFacCategory === 'all' ? 'badge-blue' : 'badge-subtle'}" style="cursor:pointer; border:none; padding:5px 12px; font-size:12px; font-weight:700; white-space:nowrap; border-radius:20px;">All Meds</button>`;
  categories.forEach(cat => {
    const active = (_activeFacCategory === cat) ? 'badge-blue' : 'badge-subtle';
    html += `<button onclick="filterFacilityByCategory('${cat.replace(/'/g, "\\'")}')" class="badge ${active}" style="cursor:pointer; border:none; padding:5px 12px; font-size:12px; font-weight:700; white-space:nowrap; border-radius:20px;">${cat}</button>`;
  });
  container.innerHTML = html;
}

function filterFacilityByCategory(category) {
  _activeFacCategory = category;
  if (_currentFacilityData) {
    renderFacilityCategoryChips(_currentFacilityData.categories || []);
    filterFacilityMedicines();
  }
}

function filterFacilityMedicines() {
  if (!_currentFacilityData || !_currentFacilityData.medicines) return;
  const q = (document.getElementById('facilityMedSearchInput')?.value || '').toLowerCase().trim();

  const filtered = _currentFacilityData.medicines.filter(m => {
    const matchesCat = (_activeFacCategory === 'all' || m.category === _activeFacCategory);
    if (!matchesCat) return false;
    if (!q) return true;
    return m.name.toLowerCase().includes(q) ||
           m.generic_name.toLowerCase().includes(q) ||
           m.category.toLowerCase().includes(q) ||
           (m.symptoms && m.symptoms.some(s => s.toLowerCase().includes(q)));
  });

  renderFacilityMedicinesList(filtered);
}

function renderFacilityMedicinesList(medicines) {
  const container = document.getElementById('facilityMedicinesContainer');
  if (!container) return;

  if (medicines.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:40px 20px; color:var(--text-muted); background:var(--bg-card); border-radius:10px; border:1px dashed var(--border-color);">
        <i class="fa-solid fa-pills" style="font-size:32px; color:var(--text-muted); margin-bottom:10px;"></i>
        <h4 style="margin:0 0 6px 0; color:var(--text-primary);">No medicines found</h4>
        <p style="font-size:13px; margin:0;">No medicines matching your search or category filter in this facility's dataset.</p>
      </div>
    `;
    return;
  }

  const fac = _currentFacilityData.facility;
  const facId = fac.id;
  const facName = fac.name.replace(/'/g, "\\'");

  let html = `<div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:14px;">`;

  medicines.forEach(m => {
    const isRx = m.prescription_required;
    const isLowStock = m.stock < 20;
    const stockBadge = isLowStock
      ? `<span style="font-size:11px; font-weight:700; color:#b45309; background:#fef3c7; padding:2px 8px; border-radius:6px;"><i class="fa-solid fa-triangle-exclamation"></i> Only ${m.stock} left</span>`
      : `<span style="font-size:11px; font-weight:700; color:#065f46; background:#ecfdf5; padding:2px 8px; border-radius:6px;"><i class="fa-solid fa-circle-check"></i> ${m.stock} in Stock</span>`;

    const cleanMedName = m.name.replace(/'/g, "\\'");
    const cleanGenName = (m.generic_name || '').replace(/'/g, "\\'");

    html += `
      <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:10px; padding:14px; display:flex; flex-direction:column; justify-content:space-between; box-shadow:var(--shadow-sm); transition:transform 0.15s, box-shadow 0.15s;">
        <div>
          <!-- Category & Rx Badge -->
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
            <span style="font-size:10px; font-weight:700; background:rgba(2, 132, 199, 0.08); color:var(--medical-blue); padding:2px 6px; border-radius:4px;">
              ${m.category}
            </span>
            <span style="font-size:10px; font-weight:700; color:${isRx ? '#b45309' : '#059669'}; background:${isRx ? '#fffbeb' : '#f0fdf4'}; padding:2px 6px; border-radius:4px;">
              ${isRx ? 'Rx Required' : 'OTC'}
            </span>
          </div>

          <!-- Medicine Name & Formula -->
          <h4 style="font-size:15px; font-weight:800; color:var(--text-primary); margin:0 0 3px 0; line-height:1.3;">
            ${m.name}
          </h4>
          <div style="font-size:11px; color:var(--text-muted); margin-bottom:8px; line-height:1.3;">
            ${m.generic_name}
          </div>

          <!-- Dosage & Symptoms -->
          <div style="font-size:11px; color:var(--text-secondary); background:var(--bg-subtle); padding:6px 8px; border-radius:6px; margin-bottom:8px;">
            <div><strong>Dosage:</strong> ${m.dosage || 'As directed by physician'}</div>
            ${m.symptoms && m.symptoms.length > 0 ? `<div style="margin-top:2px;"><strong>For:</strong> ${m.symptoms.slice(0, 3).join(', ')}</div>` : ''}
          </div>

          <!-- Stock Pill -->
          <div style="margin-bottom:10px;">
            ${stockBadge}
          </div>
        </div>

        <!-- Price & Action Buttons -->
        <div style="border-top:1px solid var(--border-color); padding-top:10px; display:flex; flex-direction:column; gap:8px;">
          <div style="display:flex; justify-content:space-between; align-items:baseline;">
            <span style="font-size:11px; color:var(--text-muted);">MRP / Unit:</span>
            <span style="font-size:16px; font-weight:800; color:var(--emerald-green);">₹ ${m.price.toFixed(2)}</span>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-secondary" onclick="addFacilityMedicineToCart('${m.id}', '${cleanMedName}', '${cleanGenName}', ${m.price}, '${facId}', '${facName}')" style="padding:6px 10px; font-size:11px; flex:1; display:flex; align-items:center; justify-content:center; gap:4px;">
              <i class="fa-solid fa-plus"></i> Add to Cart
            </button>
            <button class="btn btn-primary" onclick="orderNowDirect('${m.id}', '${cleanMedName}', '${cleanGenName}', ${m.price}, '${facId}', '${facName}')" style="padding:6px 10px; font-size:11px; flex:1; display:flex; align-items:center; justify-content:center; gap:4px; font-weight:700;">
              <i class="fa-solid fa-bolt"></i> Order Now
            </button>
          </div>
        </div>
      </div>
    `;
  });

  html += `</div>`;
  container.innerHTML = html;
}

function addFacilityMedicineToCart(medId, medName, genericName, price, facilityId, facilityName) {
  addToCart(medId, medName, genericName, price, facilityId, facilityName);
  updateFacilityCartSummary(facilityId, facilityName);
}

function orderNowDirect(medId, medName, genericName, price, facilityId, facilityName) {
  if (!currentUser) {
    alert("🔒 Authentication Required: Please sign in or create a Patient account to order medicines.");
    openAuthModal('patient');
    return;
  }
  if (currentUser.role !== 'patient' && currentUser.role !== 'admin') {
    alert("⚠️ Patient Access Only: Only Patient accounts can place orders.");
    return;
  }

  const existing = cart.find(c => c.med_id === medId && c.pharmacy_id === facilityId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      med_id: medId,
      name: medName,
      generic_name: genericName,
      price: price,
      quantity: 1,
      pharmacy_id: facilityId,
      pharmacy_name: facilityName
    });
  }

  localStorage.setItem('pharma_cart', JSON.stringify(cart));
  updateCartBadge();
  closeFacilityMedicinesModal();

  openCartModalForFacility(facilityId, facilityName);
}

function updateFacilityCartSummary(facilityId, facilityName) {
  const summaryEl = document.getElementById('facMedCartSummary');
  const totalEl = document.getElementById('facMedCartTotal');
  if (!summaryEl || !totalEl) return;

  const targetId = facilityId || (_currentFacilityData && _currentFacilityData.facility ? _currentFacilityData.facility.id : null);
  const items = targetId ? cart.filter(c => c.pharmacy_id === targetId) : cart;

  const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
  const grandTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  summaryEl.innerText = `🛒 Cart: ${totalQty} items for this facility`;
  totalEl.innerText = `₹ ${grandTotal.toFixed(2)}`;
}

function proceedToCheckoutFromFacility() {
  if (!_currentFacilityData || !_currentFacilityData.facility) {
    openCartModal();
    return;
  }
  const fac = _currentFacilityData.facility;
  const itemsForFacility = cart.filter(c => c.pharmacy_id === fac.id);
  if (itemsForFacility.length === 0) {
    alert(`Please add at least 1 medicine from "${fac.name}" to cart first, or click "Order Now" on any medicine.`);
    return;
  }
  closeFacilityMedicinesModal();
  openCartModalForFacility(fac.id, fac.name);
}

function openCartModalForFacility(facilityId, facilityName) {
  openCartModal();
  const sel = document.getElementById('cartPharmacySelect');
  if (sel) {
    let found = false;
    for (let i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === facilityId) {
        sel.selectedIndex = i;
        found = true;
        break;
      }
    }
    if (!found) {
      const opt = document.createElement('option');
      opt.value = facilityId;
      opt.innerText = facilityName;
      sel.appendChild(opt);
      sel.value = facilityId;
    }
    onCartPharmacySelectChanged();
  }
}

function _syncCartPharmacyDropdown() {
  const sel = document.getElementById('cartPharmacySelect');
  if (sel && _allFacilities && _allFacilities.length > 0) {
    const currentVal = sel.value;
    let html = '';
    _allFacilities.forEach(f => {
      const isHosp = (f.type === 'hospital');
      const icon = isHosp ? '🏥' : '🏪';
      const dist = (f.distance_km != null) ? ` (${f.distance_km} km)` : '';
      html += `<option value="${f.id}" data-name="${f.name.replace(/"/g, '&quot;')}" data-address="${(f.address || '').replace(/"/g, '&quot;')}" data-phone="${(f.phone || '').replace(/"/g, '&quot;')}">${icon} ${f.name}${dist}</option>`;
    });
    sel.innerHTML = html;
    if (currentVal) {
      sel.value = currentVal;
    } else if (cart.length > 0) {
      sel.value = cart[0].pharmacy_id;
    }
    onCartPharmacySelectChanged();
  }

  const emgSel = document.getElementById('emgPharmacy');
  if (emgSel && _allFacilities && _allFacilities.length > 0) {
    let emgHtml = '';
    _allFacilities.forEach(f => {
      const isHosp = (f.type === 'hospital');
      const icon = isHosp ? '🏥' : '🏪';
      const dist = (f.distance_km != null) ? ` (${f.distance_km} km)` : '';
      emgHtml += `<option value="${f.id}">${icon} ${f.name}${dist} — 24/7 Service</option>`;
    });
    emgSel.innerHTML = emgHtml;
  }
}

function onCartPharmacySelectChanged() {
  const sel = document.getElementById('cartPharmacySelect');
  const bannerName = document.getElementById('cartFulfillingStoreName');
  const bannerDetails = document.getElementById('cartFulfillingStoreDetails');
  if (!sel) return;

  const opt = sel.selectedOptions[0];
  if (!opt) return;

  const facId = opt.value;
  const fac = _allFacilities.find(f => f.id === facId);
  const name = fac ? fac.name : (opt.getAttribute('data-name') || opt.text);
  const address = fac ? fac.address : (opt.getAttribute('data-address') || 'Station Road, Palghar');
  const phone = fac ? fac.phone : (opt.getAttribute('data-phone') || '+91 98200 00000');
  const isHosp = fac ? (fac.type === 'hospital') : name.includes('Hospital');

  if (bannerName) {
    bannerName.innerHTML = `${isHosp ? '🏥' : '🏪'} ${name}`;
  }
  if (bannerDetails) {
    bannerDetails.innerHTML = `${address} • 📞 ${phone}`;
  }
}

// ── Google Maps optional callback ───────────────────────────────────────────
function initGoogleMap() {
  const container = document.getElementById('googleMapContainer');
  if (!container) return;

  if (_leafletMap) { _leafletMap.remove(); _leafletMap = null; }

  _googleMap = new google.maps.Map(container, {
    zoom: 14,
    center: _userCoords,
    mapTypeId: 'roadmap',
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true
  });

  _loadFacilitiesData();
}



// ==========================================
// EMERGENCY DISPATCH MODAL
// ==========================================

function openEmergencyModal() {
  const modal = document.getElementById('emergencyModal');
  if (!modal) return;

  // Pre-fill patient info if logged in
  if (currentUser) {
    const nameEl  = document.getElementById('emgPatientName');
    const phoneEl = document.getElementById('emgPhone');
    if (nameEl  && currentUser.name)  nameEl.value  = currentUser.name;
    if (phoneEl && currentUser.phone) phoneEl.value = currentUser.phone;
  }

  // Auto-detect location
  detectEmergencyLocation();

  // Reset result area
  const result = document.getElementById('emergencyResult');
  if (result) result.style.display = 'none';
  const form = document.getElementById('emergencyForm');
  if (form) form.style.display = 'block';

  modal.classList.add('active');
}

function closeEmergencyModal() {
  const modal = document.getElementById('emergencyModal');
  if (modal) modal.classList.remove('active');
}

function detectEmergencyLocation() {
  const addrInput = document.getElementById('emgAddress');
  if (!addrInput) return;
  if (navigator.geolocation) {
    addrInput.value = 'Detecting your location...';
    navigator.geolocation.getCurrentPosition(
      pos => {
        // Reverse geocode using Nominatim (free, no key needed)
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`)
          .then(r => r.json())
          .then(d => {
            addrInput.value = d.display_name || `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
          })
          .catch(() => {
            addrInput.value = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
          });
      },
      () => { addrInput.placeholder = 'Enter your address manually'; addrInput.value = ''; }
    );
  }
}

async function handleEmergencySubmit(e) {
  e.preventDefault();

  const name    = document.getElementById('emgPatientName').value.trim();
  const phone   = document.getElementById('emgPhone').value.trim();
  const med     = document.getElementById('emgMedicine').value.trim();
  const address = document.getElementById('emgAddress').value.trim();
  const pharmId = document.getElementById('emgPharmacy').value;

  const submitBtn = document.getElementById('emgSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dispatching...';

  try {
    const res  = await fetch('/api/emergency/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_name:     name,
        patient_phone:    phone,
        location_address: address,
        requested_med:    med,
        pharmacy_id:      pharmId
      })
    });
    const data = await res.json();

    if (res.ok && data.status === 'DISPATCHED') {
      const result = document.getElementById('emergencyResult');
      result.style.display = 'block';
      result.innerHTML = `
        <div style="background:rgba(16,185,129,0.08);border:1.5px solid #10b981;border-radius:12px;padding:18px;">
          <div style="font-size:22px;margin-bottom:8px;">🚨 Dispatch Confirmed!</div>
          <div style="font-size:14px;font-weight:700;color:#10b981;margin-bottom:12px;">${data.message}</div>
          <div style="font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div>🏪 <strong>Pharmacy:</strong><br>${data.pharmacy_name}</div>
            <div>⏱️ <strong>ETA:</strong><br><span style="color:var(--rose-danger);font-weight:800;">${data.eta}</span></div>
            <div>🛵 <strong>Rider:</strong><br>${data.rider_name}</div>
            <div>📞 <strong>Rider Phone:</strong><br><a href="tel:${data.rider_phone}" style="color:var(--medical-blue);">${data.rider_phone}</a></div>
          </div>
        </div>
      `;
      // Hide the form, keep modal open to show result
      document.getElementById('emergencyForm').style.display = 'none';
      showToast('🚨 Emergency Dispatched!', `Rider ${data.rider_name} is on the way. ETA: ${data.eta}`, 'success');
    } else {
      alert(`Emergency dispatch failed: ${data.detail || 'Unknown error'}`);
    }
  } catch (err) {
    alert('Network error. Please call emergency helpline: 1800-PHARMA-AI');
    console.error(err);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fa-solid fa-truck-medical"></i> 🚨 DISPATCH EMERGENCY RIDER NOW';
  }
}

// ==========================================
// PATIENT MEDICINE SEARCH & OCR ENGINE
// ==========================================

function handleSearchKeyUp(e) {
  if (e.key === 'Enter') {
    executePatientSearch();
  }
}

function searchByTag(tag) {
  document.getElementById('patientSearchInput').value = tag;
  executePatientSearch(tag);
}

async function executePatientSearch(customQuery = null) {
  const query = customQuery || document.getElementById('patientSearchInput').value || 'Dolo';
  const area = document.getElementById('searchResultsArea');
  area.innerHTML = '<div style="text-align:center; padding:30px;"><i class="fa-solid fa-spinner fa-spin" style="font-size:28px; color:var(--medical-blue);"></i><p style="margin-top:10px;">Checking real-time pharmacy stock & AI alternatives...</p></div>';

  try {
    const res = await fetch(`/api/medicines/search?query=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!data.results || data.results.length === 0) {
      area.innerHTML = `<div style="text-align:center; padding:30px; color:var(--rose-danger);"><i class="fa-solid fa-triangle-exclamation" style="font-size:32px;"></i><p style="font-weight:700; margin-top:10px;">No exact medicines found for "${query}".</p></div>`;
      return;
    }

    let html = `<h4 style="margin-bottom:14px; font-weight:700; font-size:16px;">Search Results & Pharmacy Stock (${data.total_matches} Medicines Found)</h4>`;

    data.results.forEach(item => {
      const med = item.medicine;
      html += `
        <div class="card" style="margin-bottom: 20px; border-left: 4px solid var(--medical-blue);">
          <div class="flex-between" style="margin-bottom: 10px;">
            <div>
              <h3 style="font-family:var(--font-heading); font-size:22px; color:var(--text-primary);">${med.name}</h3>
              <p style="font-size:13px; color:var(--text-secondary);">${med.generic_name} • <span style="color:var(--medical-blue); font-weight:600;">${med.category}</span></p>
            </div>
            <div style="text-align:right;">
              <span class="badge ${med.prescription_required ? 'badge-warning' : 'badge-green'}">${med.prescription_required ? 'Rx Prescription Required' : 'OTC Available'}</span>
              <div style="font-size:20px; font-weight:800; color:var(--emerald-green); margin-top:4px;">₹ ${med.mrp.toFixed(2)}</div>
            </div>
          </div>

          <div style="font-size:13px; color:var(--text-secondary); margin-bottom:14px; background:var(--bg-subtle); padding:10px; border-radius:8px;">
            <strong>Symptoms/Use:</strong> ${med.symptoms.join(', ')}<br>
            <strong>Dosage Info:</strong> ${med.dosage}
          </div>

          <h4 style="font-size:14px; font-weight:700; margin-bottom:10px;">Nearby Store Availability (${item.total_available_stores} Open Stores In-Stock):</h4>
      `;

      item.availability.forEach(store => {
        const isStockAvailable = store.stock > 0 && store.is_open;
        html += `
          <div class="store-avail-card" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-subtle); padding:12px; border-radius:8px; margin-bottom:8px;">
            <div>
              <div style="font-weight:700; font-size:15px; color:var(--text-primary);">${store.pharmacy_name}</div>
              <div style="font-size:12px; color:var(--text-secondary);">
                📍 ${store.distance} away • ⭐ ${store.rating} • ${store.is_open ? '🟢 Open Now' : '🔴 Closed'}
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:12px;">
              <div style="text-align:right;">
                <div style="font-size:14px; font-weight:700; color:${isStockAvailable ? 'var(--emerald-green)' : 'var(--rose-danger)'};">
                  ${store.stock > 0 ? store.stock + ' Units Available' : 'Out of Stock'}
                </div>
                <div style="font-size:11px; color:var(--text-muted);">ETA: ${store.delivery_eta}</div>
              </div>
              <button class="btn btn-primary" ${!isStockAvailable ? 'disabled style="opacity:0.5;"' : ''} onclick="addToCart('${med.id}', '${med.name}', '${med.generic_name}', ${store.price}, '${store.pharmacy_id}', '${store.pharmacy_name}')">
                <i class="fa-solid fa-cart-plus"></i> Add to Cart
              </button>
            </div>
          </div>
        `;
      });

      if (med.alternatives && med.alternatives.length > 0) {
        html += `
          <div style="margin-top:12px; padding:8px 12px; background:var(--purple-light); border-radius:8px; font-size:12px; color:var(--purple-ai); font-weight:600;">
            <i class="fa-solid fa-vial"></i> AI Chemical Composition Alternatives: ${med.alternatives.join(', ')}
          </div>
        `;
      }

      html += `</div>`;
    });

    area.innerHTML = html;

  } catch (err) {
    area.innerHTML = '<div style="color:var(--rose-danger); padding:20px;">Failed to perform medicine search. Please try again.</div>';
  }
}

// Voice Search Integration using Web Speech API
function startVoiceSearch() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    alert("Speech recognition is not supported in this browser version. Please type search query.");
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  const indicator = document.getElementById('voiceWaveIndicator');
  if (indicator) indicator.classList.add('active');

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('patientSearchInput').value = transcript;
    if (indicator) indicator.classList.remove('active');
    executePatientSearch(transcript);
  };

  recognition.onerror = () => {
    if (indicator) indicator.classList.remove('active');
  };

  recognition.onend = () => {
    if (indicator) indicator.classList.remove('active');
  };

  recognition.start();
}

function triggerBarcodeUpload() {
  document.getElementById('barcodeFileInput').click();
}

function handleBarcodeFile(e) {
  const file = e.target.files[0];
  if (file) {
    alert(`Scanning Barcode from image "${file.name}"...\nBarcode Identified: 890123456001 (Dolo 650)`);
    document.getElementById('patientSearchInput').value = "890123456001";
    executePatientSearch("890123456001");
  }
}

// Prescription AI OCR Scanner Upload
async function uploadPrescriptionFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const statusArea = document.getElementById('ocrStatusArea');

  // Preview uploaded prescription image
  let imagePreviewHtml = '';
  if (file.type && file.type.startsWith('image/')) {
    const objectUrl = URL.createObjectURL(file);
    imagePreviewHtml = `<div style="text-align:center; margin-bottom:12px;"><img src="${objectUrl}" style="max-height:160px; border-radius:8px; border:1px solid var(--border-color); box-shadow:var(--shadow-sm);" alt="Prescription Preview"></div>`;
  }

  statusArea.innerHTML = `
    <div style="background:var(--purple-light); padding:16px; border-radius:10px; color:var(--purple-ai); text-align:center;">
      ${imagePreviewHtml}
      <i class="fa-solid fa-brain fa-spin" style="font-size:24px;"></i>
      <h4 style="margin-top:8px; font-weight:700;">AI Vision OCR Processing...</h4>
      <p style="font-size:12px; margin-top:4px;">Scanning prescription text, fuzzy-matching drugs with database, verifying stock...</p>
    </div>
  `;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/prescriptions/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (!res.ok || data.status !== 'SUCCESS') {
      statusArea.innerHTML = `<div style="color:var(--rose-danger); padding:16px; background:var(--rose-light); border-radius:8px;">❌ ${data.detail || 'OCR Processing failed.'}</div>`;
      return;
    }

    let itemsHtml = `
      <div style="background:var(--bg-subtle); padding:16px; border-radius:10px; border:1px solid var(--border-color); margin-top:12px;">
        ${imagePreviewHtml}
        <div class="flex-between" style="margin-bottom:12px;">
          <div style="font-weight:700; font-size:14px; color:var(--emerald-green);">
            <i class="fa-solid fa-circle-check"></i> OCR Confidence: ${data.ocr_confidence_score}% | Extracted ${data.extracted_count} Medicines
          </div>
          <span class="badge badge-purple">Prescription Verified</span>
        </div>
    `;

    data.items.forEach(item => {
      itemsHtml += `
        <div class="ocr-result-item" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; padding:10px 12px; background:var(--bg-card); border-radius:8px; border:1px solid var(--border-color);">
          <div>
            <div style="font-weight:700; font-size:15px; color:var(--text-primary);">${item.corrected_name}</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
              Raw OCR: "<code>${item.raw_ocr}</code>" • Dosage: <strong>${item.dosage_instruction}</strong>
            </div>
            <div style="font-size:11px; color:var(--emerald-green); font-weight:700; margin-top:2px;">
              Stock Available: ${item.medicine.stock} Units • Price: ₹ ${item.medicine.mrp.toFixed(2)}
            </div>
          </div>
          <div>
            <button class="btn btn-primary" style="padding:6px 12px; font-size:12px;" onclick="addToCart('${item.medicine.id}', '${item.corrected_name}', '${item.medicine.generic_name}', ${item.medicine.mrp}, '${_allFacilities[0]?.id || 'PH-001'}', '${(_allFacilities[0]?.name || 'Apollo Pharmacy - Palghar Station').replace(/'/g, "\\'")}')">
              <i class="fa-solid fa-cart-plus"></i> Add
            </button>
          </div>
        </div>
      `;
    });

    itemsHtml += `
      <div style="display:flex; gap:10px; margin-top:14px;">
        <button class="btn btn-primary" onclick="openCartModal()" style="width:100%;">
          <i class="fa-solid fa-cart-shopping"></i> View Cart & Checkout Now
        </button>
      </div>
      </div>
    `;

    statusArea.innerHTML = itemsHtml;
  } catch (err) {
    statusArea.innerHTML = '<div style="color:var(--rose-danger); padding:16px; background:var(--rose-light); border-radius:8px;">❌ OCR Network error. Please verify server connection.</div>';
  }
}

// ==========================================
// PATIENT SHOPPING CART & CHECKOUT ENGINE
// ==========================================

function addToCart(medId, medName, genericName, price, pharmacyId, pharmacyName) {
  if (!currentUser) {
    alert("🔒 Authentication Required: Please sign in or create a Patient account to add medicines to cart and place orders securely.");
    openAuthModal('patient');
    return;
  }
  if (currentUser.role !== 'patient' && currentUser.role !== 'admin') {
    alert("⚠️ Patient Access Only: Only logged-in Patient accounts can add items to cart and place orders.");
    return;
  }

  const existing = cart.find(c => c.med_id === medId && c.pharmacy_id === pharmacyId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      med_id: medId,
      name: medName,
      generic_name: genericName,
      price: price,
      quantity: 1,
      pharmacy_id: pharmacyId,
      pharmacy_name: pharmacyName
    });
  }

  localStorage.setItem('pharma_cart', JSON.stringify(cart));
  updateCartBadge();
  alert(`🛒 Added 1x "${medName}" to Cart from ${pharmacyName}!`);
}

function updateCartBadge() {
  const totalQty = cart.reduce((sum, item) => sum + item.quantity, 0);
  const badge = document.getElementById('cartCountBadge');
  if (badge) badge.innerText = totalQty;

  const btn = document.getElementById('cartFloatingBtn');
  if (btn) btn.style.display = (totalQty > 0) ? 'flex' : 'none';
}

function openCartModal() {
  if (!currentUser) {
    alert("🔒 Authentication Required: Please log in as a Patient to view your shopping cart and checkout.");
    openAuthModal('patient');
    return;
  }
  const modal = document.getElementById('cartModal');
  if (!modal) return;

  _syncCartPharmacyDropdown();
  if (cart.length > 0) {
    const sel = document.getElementById('cartPharmacySelect');
    if (sel) {
      sel.value = cart[0].pharmacy_id;
      onCartPharmacySelectChanged();
    }
  }

  renderCartItems();
  modal.classList.add('active');
}

function closeCartModal() {
  const modal = document.getElementById('cartModal');
  if (modal) modal.classList.remove('active');
}

function renderCartItems() {
  const container = document.getElementById('cartItemsContainer');
  const totalDisp = document.getElementById('cartTotalDisplay');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">Your shopping cart is empty. Search medicines to add items!</div>';
    if (totalDisp) totalDisp.innerText = '₹ 0.00';
    return;
  }

  let html = '';
  let grandTotal = 0;

  cart.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    grandTotal += itemTotal;

    html += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-bottom:1px solid var(--border-color);">
        <div>
          <strong style="font-size:14px;">${item.name}</strong>
          <div style="font-size:11px; color:var(--text-muted);">${item.pharmacy_name} • ₹${item.price.toFixed(2)} each</div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="font-size:13px; font-weight:700;">Qty: ${item.quantity}</div>
          <div style="font-size:14px; font-weight:800; color:var(--emerald-green);">₹${itemTotal.toFixed(2)}</div>
          <button onclick="removeFromCart(${index})" style="background:none; border:none; color:var(--rose-danger); cursor:pointer; font-size:14px;"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  if (totalDisp) totalDisp.innerText = `₹ ${grandTotal.toFixed(2)}`;
}

function removeFromCart(index) {
  cart.splice(index, 1);
  localStorage.setItem('pharma_cart', JSON.stringify(cart));
  updateCartBadge();
  renderCartItems();
}

async function handleCartCheckout(e) {
  e.preventDefault();
  if (!currentUser) {
    alert("🔒 Authentication Required: Please log in as a Patient to place medicine orders.");
    openAuthModal('patient');
    return;
  }
  if (currentUser.role !== 'patient' && currentUser.role !== 'admin') {
    alert("⚠️ Access Denied: Only Patient accounts can checkout and place orders.");
    return;
  }
  if (cart.length === 0) {
    alert("Your cart is empty.");
    return;
  }

  const patientId = currentUser.id;
  const patientName = currentUser.name;
  const patientPhone = currentUser.phone || "+91 98201 99887";
  const address = document.getElementById('cartAddress').value || currentUser.address || "Flat 402, Sunshine Heights";
  const pharmacyId = document.getElementById('cartPharmacySelect').value || (cart[0] && cart[0].pharmacy_id) || "PH-001";
  const selOpt = document.getElementById('cartPharmacySelect')?.selectedOptions[0];
  const pharmacyName = (cart[0] && cart[0].pharmacy_name) || (selOpt ? (selOpt.getAttribute('data-name') || selOpt.text) : "Selected Medical Store");
  const deliveryType = document.getElementById('cartDeliveryType').value || "DELIVERY";

  const cartItemsPayload = cart.map(item => ({
    med_id: item.med_id,
    quantity: item.quantity
  }));

  try {
    const res = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patientId,
        patient_name: patientName,
        patient_phone: patientPhone,
        patient_address: address,
        pharmacy_id: pharmacyId,
        pharmacy_name: pharmacyName,
        delivery_type: deliveryType,
        items: cartItemsPayload
      })
    });

    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      const order = data.order;
      cart = [];
      localStorage.removeItem('pharma_cart');
      updateCartBadge();
      closeCartModal();

      showOrderReceiptModal(order);

      loadPatientOrders();
      loadPharmacyOrders();
    } else {
      alert(`Order placement failed: ${data.detail || 'Error'}`);
    }
  } catch (err) {
    alert("Checkout server error.");
  }
}

// ==========================================
// PATIENT ORDER HISTORY & LIVE SYNC TRACKER
// ==========================================

async function loadPatientOrders() {
  const patientId = currentUser ? currentUser.id : 'USR-PAT-001';
  try {
    const res = await fetch(`/api/orders/patient/${patientId}`);
    const data = await res.json();
    patientOrdersCache = data.orders || [];
    renderPatientOrders(patientOrdersCache);
  } catch (err) {
    console.error("Error loading patient orders", err);
  }
}

function renderPatientOrders(orders) {
  const container = document.getElementById('patientOrdersList');
  if (!container) return;

  if (orders.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted);">No past or active medicine orders found.</div>';
    return;
  }

  let html = '';
  orders.forEach(order => {
    const statusSteps = ['PENDING', 'APPROVED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
    const currentStepIdx = statusSteps.indexOf(order.status);

    html += `
      <div class="card" style="margin-bottom:16px; border:1px solid var(--border-color); border-left:4px solid var(--medical-blue);">
        <div class="flex-between" style="margin-bottom:12px; flex-wrap:wrap; gap:8px;">
          <div>
            <strong style="font-size:16px; color:var(--medical-blue);">Order #${order.order_id}</strong>
            <span style="font-size:12px; color:var(--text-muted); margin-left:8px;">Placed: ${order.created_at}</span>
          </div>
          <div>
            <span class="badge ${getStatusBadgeClass(order.status)}">${formatStatus(order.status)}</span>
            <strong style="font-size:16px; color:var(--emerald-green); margin-left:10px;">₹ ${order.total_amount.toFixed(2)}</strong>
          </div>
        </div>

        <div style="background:var(--bg-subtle); padding:10px 14px; border-radius:8px; font-size:13px; margin-bottom:14px;">
          <div style="font-weight:700; color:var(--text-primary);">
            🏪 Assigned Pharmacy Store: <span style="color:var(--medical-blue);">${order.pharmacy_name}</span>
          </div>
          <div style="color:var(--text-secondary); margin-top:2px;">
            📍 Address: ${order.pharmacy_address || '101 Healthcare Blvd'} • 📞 Contact Store: ${order.pharmacy_phone || '+91 98201 12345'}
          </div>
          <div style="color:var(--text-secondary); margin-top:2px;">
            🚚 Delivery Type: <strong>${order.delivery_type}</strong> • Target Address: ${order.patient_address}
          </div>
        </div>

        <div style="margin-bottom:14px; padding:10px 0;">
          <div style="display:flex; justify-content:space-between; position:relative;">
            <div style="text-align:center; flex:1;">
              <div style="width:24px; height:24px; border-radius:50%; background:${currentStepIdx >= 0 ? 'var(--medical-blue)' : 'var(--border-color)'}; color:white; margin:0 auto; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">1</div>
              <div style="font-size:11px; font-weight:600; margin-top:4px;">Order Placed</div>
            </div>
            <div style="text-align:center; flex:1;">
              <div style="width:24px; height:24px; border-radius:50%; background:${currentStepIdx >= 1 ? 'var(--emerald-green)' : 'var(--border-color)'}; color:white; margin:0 auto; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">2</div>
              <div style="font-size:11px; font-weight:600; margin-top:4px;">Pharmacy Approved</div>
            </div>
            <div style="text-align:center; flex:1;">
              <div style="width:24px; height:24px; border-radius:50%; background:${currentStepIdx >= 2 ? 'var(--amber-warning)' : 'var(--border-color)'}; color:white; margin:0 auto; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">3</div>
              <div style="font-size:11px; font-weight:600; margin-top:4px;">Out for Delivery</div>
            </div>
            <div style="text-align:center; flex:1;">
              <div style="width:24px; height:24px; border-radius:50%; background:${currentStepIdx >= 3 ? 'var(--emerald-green)' : 'var(--border-color)'}; color:white; margin:0 auto; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">4</div>
              <div style="font-size:11px; font-weight:600; margin-top:4px;">Delivered</div>
            </div>
          </div>
        </div>

        <div style="font-size:13px; color:var(--text-secondary);">
          <strong>Ordered Items:</strong> ${(order.items || []).map(i => `${i.med_name || i.name || 'Medicine'} (x${i.quantity || 1})`).join(', ')}
        </div>

        <div style="margin-top:10px; text-align:right;">
          <button class="btn btn-secondary" style="padding:4px 10px; font-size:12px;" onclick="showOrderReceiptModal(${JSON.stringify(order).replace(/"/g, '&quot;')})">
            <i class="fa-solid fa-qrcode"></i> View QR Receipt
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function getStatusBadgeClass(status) {
  if (status === 'PENDING') return 'badge-warning';
  if (status === 'APPROVED') return 'badge-green';
  if (status === 'OUT_FOR_DELIVERY') return 'badge-blue';
  if (status === 'DELIVERED') return 'badge-green';
  if (status === 'REJECTED') return 'badge-danger';
  return 'badge-blue';
}

function formatStatus(status) {
  if (status === 'PENDING') return '⏳ Pending Approval';
  if (status === 'APPROVED') return '✅ Approved / Packing';
  if (status === 'OUT_FOR_DELIVERY') return '🚚 Out for Delivery';
  if (status === 'DELIVERED') return '🎉 Delivered';
  if (status === 'REJECTED') return '❌ Rejected';
  return status;
}

function showOrderReceiptModal(order) {
  const modal = document.getElementById('receiptModal');
  const content = document.getElementById('receiptContent');
  if (!modal || !content) return;

  let itemsHtml = (order.items || []).map(i => `<li>${i.med_name || i.name || 'Medicine'} x ${i.quantity || 1} = ₹${((i.total_price != null ? i.total_price : (i.unit_price || 0) * (i.quantity || 1))).toFixed(2)}</li>`).join('');

  content.innerHTML = `
    <div style="text-align:center; margin-bottom:12px;">
      <h3 style="margin:0; font-family:var(--font-heading); color:var(--medical-blue);">Pharma-Connect AI Digital Receipt</h3>
      <div style="font-size:12px; color:var(--text-muted);">Receipt ID: ${order.order_id}</div>
    </div>
    <div style="font-size:13px; line-height:1.6; margin-bottom:12px;">
      <strong>Patient:</strong> ${order.patient_name}<br>
      <strong>Store:</strong> ${order.pharmacy_name}<br>
      <strong>Fulfillment:</strong> ${order.delivery_type}<br>
      <strong>Order Date:</strong> ${order.created_at}<br>
      <strong>Total Paid:</strong> ₹${order.total_amount.toFixed(2)}
    </div>
    <div style="font-size:13px; font-weight:700; margin-bottom:6px;">Medicines Purchased:</div>
    <ul style="font-size:12px; margin-bottom:14px; padding-left:20px;">${itemsHtml}</ul>
    <div id="qrcodeCanvasContainer" style="text-align:center; padding:10px; background:white; border-radius:8px; display:inline-block; width:100%;"></div>
  `;

  modal.classList.add('active');

  setTimeout(() => {
    const qrContainer = document.getElementById('qrcodeCanvasContainer');
    if (qrContainer) {
      qrContainer.innerHTML = '';
      new QRCode(qrContainer, {
        text: order.qr_code_data || `PHARMA-ORD-${order.order_id}`,
        width: 120,
        height: 120
      });
    }
  }, 100);
}

function closeReceiptModal() {
  const modal = document.getElementById('receiptModal');
  if (modal) modal.classList.remove('active');
}

// ==========================================
// PHARMACY INCOMING ORDERS CONSOLE
// ==========================================

async function loadPharmacyOrders() {
  const storeId = getStoreId();
  try {
    const res = await fetch(`/api/orders/pharmacy/${storeId}`);
    const data = await res.json();
    pharmacyOrdersCache = data.orders || [];
    renderPharmacyOrders();
  } catch (err) {
    console.error("Error loading pharmacy orders", err);
  }
}

function filterPharmacyOrders(filterStatus) {
  activePharmacyOrderFilter = filterStatus;
  document.querySelectorAll('#pharmacyView .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.innerText.toLowerCase().includes(filterStatus.toLowerCase()) || (filterStatus === 'ALL' && btn.innerText.includes('All')));
  });
  renderPharmacyOrders();
}

function renderPharmacyOrders() {
  const container = document.getElementById('pharmacyOrdersList');
  if (!container) return;

  let filtered = pharmacyOrdersCache;
  if (activePharmacyOrderFilter !== 'ALL') {
    filtered = pharmacyOrdersCache.filter(o => o.status === activePharmacyOrderFilter);
  }

  const activeCountEl = document.getElementById('pharmActiveOrders');
  if (activeCountEl) {
    const pendingOrActive = pharmacyOrdersCache.filter(o => o.status === 'PENDING' || o.status === 'APPROVED' || o.status === 'OUT_FOR_DELIVERY').length;
    activeCountEl.innerText = `${pendingOrActive} Orders`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">No orders matching status '${activePharmacyOrderFilter}'.</div>`;
    return;
  }

  let html = '';
  filtered.forEach(order => {
    html += `
      <div style="background:var(--bg-card); border:1px solid var(--border-color); border-radius:10px; padding:16px; margin-bottom:12px;">
        <div class="flex-between" style="margin-bottom:8px; flex-wrap:wrap; gap:8px;">
          <div>
            <strong style="font-size:15px; color:var(--medical-blue);">Order #${order.order_id}</strong>
            <span style="font-size:12px; color:var(--text-muted); margin-left:6px;">• Patient: <strong>${order.patient_name}</strong> (${order.patient_phone})</span>
          </div>
          <div>
            <span class="badge ${getStatusBadgeClass(order.status)}">${formatStatus(order.status)}</span>
            <strong style="font-size:15px; color:var(--emerald-green); margin-left:10px;">₹ ${order.total_amount.toFixed(2)}</strong>
          </div>
        </div>

        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:10px;">
          📍 Delivery Address: ${order.patient_address} | Type: <strong>${order.delivery_type}</strong>
        </div>

        <div style="font-size:13px; background:var(--bg-subtle); padding:8px 12px; border-radius:6px; margin-bottom:12px;">
          <strong>Items:</strong> ${(order.items || []).map(i => `${i.med_name || i.name || 'Medicine'} (x${i.quantity || 1})`).join(', ')}
        </div>

        <!-- Dynamic Action Buttons -->
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          ${order.status === 'PENDING' ? `
            <button class="btn btn-primary" style="padding:6px 12px; font-size:12px;" onclick="updateOrderStatus('${order.order_id}', 'APPROVED')">
              <i class="fa-solid fa-circle-check"></i> Approve Order
            </button>
            <button class="btn btn-secondary" style="padding:6px 12px; font-size:12px; color:var(--rose-danger);" onclick="updateOrderStatus('${order.order_id}', 'REJECTED')">
              <i class="fa-solid fa-circle-xmark"></i> Reject
            </button>
          ` : ''}

          ${order.status === 'APPROVED' ? `
            <button class="btn btn-primary" style="padding:6px 12px; font-size:12px;" onclick="updateOrderStatus('${order.order_id}', 'OUT_FOR_DELIVERY')">
              <i class="fa-solid fa-truck-fast"></i> Dispatch for Delivery
            </button>
          ` : ''}

          ${order.status === 'OUT_FOR_DELIVERY' ? `
            <button class="btn btn-primary" style="padding:6px 12px; font-size:12px; background:var(--emerald-green);" onclick="updateOrderStatus('${order.order_id}', 'DELIVERED')">
              <i class="fa-solid fa-circle-check"></i> Mark Completed / Delivered
            </button>
          ` : ''}

          ${order.status === 'DELIVERED' ? `
            <span style="font-size:12px; color:var(--emerald-green); font-weight:700;">🎉 Order Completed</span>
          ` : ''}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const res = await fetch('/api/orders/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, status: newStatus })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`✅ ${data.message}`);
      loadPharmacyOrders();
      loadPatientOrders();
    }
  } catch (err) {
    alert("Failed to update status.");
  }
}

// ==========================================
// DYNAMIC INVENTORY & STOCK MANAGEMENT
// ==========================================

async function loadPharmacyInventory(pharmacyId) {
  try {
    const res = await fetch(`/api/pharmacy/inventory/${pharmacyId}`);
    const data = await res.json();
    masterInventoryCache = data.inventory || [];

    const totalSkuEl = document.getElementById('pharmTotalSku');
    if (totalSkuEl) totalSkuEl.innerText = `${masterInventoryCache.length} SKUs`;

    const alertCountEl = document.getElementById('pharmExpiryAlerts');
    if (alertCountEl) {
      const riskCount = masterInventoryCache.filter(i => i.expiry_alert !== 'NORMAL').length;
      alertCountEl.innerText = `${riskCount} SKUs`;
    }

    renderInventoryTable(masterInventoryCache);
  } catch (err) {
    console.error("Inventory fetch error", err);
  }
}

function filterInventoryTable(riskCategory) {
  if (riskCategory === 'ALL') {
    renderInventoryTable(masterInventoryCache);
  } else if (riskCategory === 'LOW') {
    renderInventoryTable(masterInventoryCache.filter(i => i.low_stock_flag));
  } else {
    renderInventoryTable(masterInventoryCache.filter(i => i.expiry_alert.includes(riskCategory)));
  }
}

function renderInventoryTable(items) {
  const tbody = document.getElementById('inventoryTableBody');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px; color:var(--text-muted);">No inventory items match this risk filter.</td></tr>';
    return;
  }

  window._storeInventoryMap = window._storeInventoryMap || {};

  let html = '';
  items.forEach(item => {
    window._storeInventoryMap[item.med_id] = item;
    let alertBadge = '<span class="badge badge-green">NORMAL</span>';
    if (item.expiry_alert === 'CRITICAL_30_DAYS') alertBadge = '<span class="badge badge-danger">🚨 Expiry <30 Days</span>';
    if (item.expiry_alert === 'WARNING_60_DAYS') alertBadge = '<span class="badge badge-warning">⚠️ Expiry <60 Days</span>';
    if (item.expiry_alert === 'ALERT_90_DAYS') alertBadge = '<span class="badge badge-blue">📅 Expiry <90 Days</span>';

    html += `
      <tr>
        <td><strong>${item.name}</strong><br><span style="font-size:11px; color:var(--text-muted);">${item.generic_name}</span></td>
        <td>${item.category}</td>
        <td id="invStock_${item.med_id}"><strong style="color:${item.low_stock_flag ? 'var(--rose-danger)' : 'var(--text-primary)'};">${item.stock} Units</strong></td>
        <td id="invPrice_${item.med_id}">
          <div style="display:flex; align-items:center; gap:6px;">
            <strong style="color:var(--emerald-green); font-size:13px;" id="invPriceText_${item.med_id}">₹ ${Number(item.mrp || 0).toFixed(2)}</strong>
            <button class="btn btn-secondary" style="padding:3px 8px; font-size:11px; margin-left:4px; cursor:pointer;" onclick="openEditPriceModal('${item.med_id}')" title="Modify selling price for patient search">✏️ Edit Price</button>
          </div>
        </td>
        <td><code>${item.batch}</code></td>
        <td>${item.expiry}</td>
        <td>${alertBadge}</td>
        <td>
          <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; cursor:pointer;" onclick="openQuickRefillModal('${item.med_id}')">+ Refill Stock</button>
        </td>
      </tr>
    `;
  });
  tbody.innerHTML = html;
}

function openAddStockModal() {
  const modal = document.getElementById('addStockModal');
  if (modal) modal.classList.add('active');
}

function closeAddStockModal() {
  const modal = document.getElementById('addStockModal');
  if (modal) modal.classList.remove('active');
}

async function handleAddStockSubmit(e) {
  e.preventDefault();
  const medName = document.getElementById('stockMedName').value;
  const genericName = document.getElementById('stockGenericName').value;
  const category = document.getElementById('stockCategory').value;
  const qty = parseInt(document.getElementById('stockQty').value);
  const mrp = parseFloat(document.getElementById('stockMrp').value);
  const batch = document.getElementById('stockBatch').value;
  const expiry = document.getElementById('stockExpiry').value;
  const symptoms = document.getElementById('stockSymptoms').value;

  const storeId = getStoreId();

  try {
    const res = await fetch('/api/pharmacy/inventory/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pharmacy_id: storeId,
        med_name: medName,
        generic_name: genericName,
        category: category,
        mrp: mrp,
        stock_qty: qty,
        batch_no: batch,
        expiry_date: expiry,
        symptoms: symptoms
      })
    });

    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      alert(`🎉 ${data.message}`);
      closeAddStockModal();
      loadPharmacyInventory(storeId);
      executePatientSearch(medName); // Update patient search live!
    } else {
      alert(`Stock addition failed: ${data.detail || 'Error'}`);
    }
  } catch (err) {
    alert("Add stock request error.");
  }
}

async function quickStockRefill(medId, medName) {
  openQuickRefillModal(medId, medName);
}

// ==========================================
// STORE PROFILE & COMMERCIAL ONBOARDING
// ==========================================

function openStoreProfileModal() {
  const modal = document.getElementById('storeProfileModal');
  if (!modal) return;

  if (currentPharmacyStore) {
    document.getElementById('editStoreName').value = currentPharmacyStore.name || 'Apollo Pharmacy - Palghar Station';
    document.getElementById('editStorePhone').value = currentPharmacyStore.phone || '+91 98201 12345';
    document.getElementById('editStoreAddress').value = currentPharmacyStore.address || 'Station Road, Palghar West, Maharashtra - 401404';
  }
  modal.classList.add('active');
}

function closeStoreProfileModal() {
  const modal = document.getElementById('storeProfileModal');
  if (modal) modal.classList.remove('active');
}

async function handleStoreProfileSave(e) {
  e.preventDefault();
  const name = document.getElementById('editStoreName').value;
  const phone = document.getElementById('editStorePhone').value;
  const address = document.getElementById('editStoreAddress').value;
  const isOpen = document.getElementById('editStoreIsOpen').checked;
  const isEmergency = document.getElementById('editStoreEmergency').checked;

  const storeId = getStoreId();

  try {
    const res = await fetch('/api/pharmacy/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pharmacy_id: storeId,
        name: name,
        phone: phone,
        address: address,
        is_open: isOpen,
        emergency_delivery: isEmergency
      })
    });

    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      currentPharmacyStore = data.store;
      localStorage.setItem('pharma_store', JSON.stringify(currentPharmacyStore));
      closeStoreProfileModal();
      updateUserSessionUI();
      alert(`🎉 ${data.message}`);
    } else {
      alert("Failed to update store profile.");
    }
  } catch (err) {
    alert("Profile update network error.");
  }
}

function openInvoiceScannerModal() {
  document.getElementById('invoiceScannerModal').classList.add('active');
}

function closeInvoiceScannerModal() {
  document.getElementById('invoiceScannerModal').classList.remove('active');
}

async function uploadSupplierInvoiceFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const prog = document.getElementById('invoiceScanProgress');
  prog.innerHTML = `
    <div style="background:var(--teal-light); padding:16px; border-radius:8px; color:var(--teal-accent); text-align:center;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:24px;"></i>
      <h4 style="margin-top:6px;">Parsing Supplier Invoice Bill...</h4>
      <p style="font-size:12px;">Reading SKUs, Batch numbers, and auto-updating database...</p>
    </div>
  `;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/pharmacy/ai-invoice-scanner', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    prog.innerHTML = `
      <div style="background:var(--emerald-light); padding:16px; border-radius:8px; color:var(--emerald-green); text-align:center;">
        <i class="fa-solid fa-circle-check" style="font-size:28px;"></i>
        <h4 style="margin-top:6px; font-weight:700;">Invoice Parsed Successfully!</h4>
        <p style="font-size:13px; margin-top:4px;">${data.message}</p>
      </div>
    `;

    setTimeout(() => {
      closeInvoiceScannerModal();
      loadPharmacyInventory(getStoreId());
    }, 1500);
  } catch (err) {
    prog.innerHTML = '<div style="color:var(--rose-danger);">Failed to parse invoice file.</div>';
  }
}

// ==========================================
// AI FORECASTING & OTHER MODULES
// ==========================================

async function loadAIForecastingData() {
  try {
    const res = await fetch('/api/ai/forecasting-analytics');
    const data = await res.json();

    const ctx = document.getElementById('forecastChart');
    if (ctx) {
      const labels = data.demand_trends.map(t => t.medicine.split('/')[0]);
      const currentDem = data.demand_trends.map(t => t.current_demand);
      const forecastDem = data.demand_trends.map(t => t.forecasted_demand);

      if (forecastChartInstance) forecastChartInstance.destroy();

      forecastChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [
            { label: 'Current Demand', data: currentDem, backgroundColor: '#0284c7' },
            { label: 'Forecasted Next Week Demand', data: forecastDem, backgroundColor: '#10b981' }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { position: 'top' } }
        }
      });
    }

    const alertDiv = document.getElementById('outbreakAlertsContainer');
    if (alertDiv) {
      let html = '';
      data.outbreak_alerts.forEach(o => {
        html += `
          <div style="background:var(--rose-light); border:1px solid var(--rose-danger); border-radius:10px; padding:16px; margin-bottom:12px;">
            <div class="flex-between">
              <strong style="color:var(--rose-danger); font-size:14px;">📍 ${o.region}</strong>
              <span class="badge badge-danger">${o.severity} RISK</span>
            </div>
            <p style="font-size:13px; font-weight:700; margin-top:6px; color:var(--text-primary);">${o.alert_message}</p>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:6px; font-weight:600;">
              💡 Action: ${o.recommended_action}
            </div>
          </div>
        `;
      });
      alertDiv.innerHTML = html;
    }

    const refillBody = document.getElementById('refillTableBody');
    if (refillBody) {
      let html = '';
      data.smart_stock_refill_system.forEach(r => {
        html += `
          <tr>
            <td><strong>${r.medicine_name}</strong></td>
            <td>${r.current_stock} Units</td>
            <td>${r.predicted_demand_next_week} Units</td>
            <td><strong style="color:var(--emerald-green);">+ ${r.recommended_refill} Units</strong></td>
            <td><span class="badge ${r.urgency === 'HIGH' ? 'badge-danger' : 'badge-warning'}">${r.urgency}</span></td>
            <td><strong>₹ ${r.estimated_po_cost.toFixed(2)}</strong></td>
          </tr>
        `;
      });
      refillBody.innerHTML = html;
    }

  } catch (err) {
    console.error("AI Forecasting data fetch error", err);
  }
}

function generateBulkSupplierPO() {
  alert("Generated Automated Purchase Order (PO-2026-881) for 4 suppliers!\nNotification sent to Sun Pharma & Cipla Distribution Hub.");
}

async function handleHospitalBulkOrder(e) {
  e.preventDefault();
  const hospName = document.getElementById('hospName').value;
  const medId = document.getElementById('hospMedSelect').value;
  const qty = parseInt(document.getElementById('hospQty').value);
  const isEmg = document.getElementById('hospEmergencyCheck').checked;

  try {
    const res = await fetch('/api/hospital/bulk-reserve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hospital_name: hospName,
        med_id: medId,
        bulk_quantity: qty,
        is_emergency: isEmg
      })
    });
    const data = await res.json();

    document.getElementById('hospitalOrderResult').innerHTML = `
      <div style="background:var(--emerald-light); padding:16px; border-radius:10px; color:var(--emerald-green);">
        <h4 style="font-weight:700;">✅ Hospital Bulk Order ${data.order_id} Confirmed!</h4>
        <p style="font-size:13px; margin-top:4px;">
          Reserved ${data.requested_quantity} Units for ${data.hospital_name}.<br>
          Estimated Fulfillment: <strong>${data.estimated_delivery}</strong> | Est Total: <strong>₹ ${data.total_estimate.toFixed(2)}</strong>
        </p>
      </div>
    `;
  } catch (err) {
    alert("Hospital order failed.");
  }
}

async function handleDonationSubmit(e) {
  e.preventDefault();
  const donor = document.getElementById('donDonorName').value;
  const phone = document.getElementById('donPhone').value;
  const med = document.getElementById('donMedName').value;
  const strips = parseInt(document.getElementById('donStrips').value);

  try {
    const res = await fetch('/api/donation/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        donor_name: donor,
        phone: phone,
        med_name: med,
        strips_count: strips,
        expiry_month_year: "2027-12",
        ngo_preference: "Red Cross Healthcare Trust"
      })
    });
    const data = await res.json();
    alert(`Thank you, ${donor}! Volunteer pickup for ${strips} strips of ${med} scheduled.`);
  } catch (err) {
    alert("Donation submission error.");
  }
}

async function loadAdminData() {
  try {
    const res = await fetch('/api/admin/all-data');
    const data = await res.json();

    // Render Registered Patients Oversight Table
    const patBody = document.getElementById('adminPatientsTableBody');
    const patBadge = document.getElementById('adminPatientCountBadge');
    if (patBody && data.all_patients) {
      if (patBadge) patBadge.innerText = `${data.all_patients.length} Patients`;
      let patHtml = '';
      data.all_patients.forEach(pat => {
        const isSuspended = pat.status === 'suspended';
        const statusBadge = isSuspended
          ? '<span class="badge badge-danger">SUSPENDED</span>'
          : '<span class="badge badge-green">ACTIVE</span>';

        const actionBtn = isSuspended
          ? `<button class="btn btn-primary" style="padding:4px 8px; font-size:11px;" onclick="toggleUserStatus('${pat.id}', '${pat.status}')">Reactivate Account</button>`
          : `<button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; color:var(--rose-danger);" onclick="toggleUserStatus('${pat.id}', '${pat.status}')">Suspend Access</button>`;

        patHtml += `
          <tr>
            <td><code>${pat.id}</code></td>
            <td><strong>${pat.name}</strong></td>
            <td>${pat.email}</td>
            <td>${pat.phone}</td>
            <td><strong>${pat.total_orders} Orders</strong></td>
            <td>${statusBadge}</td>
            <td>${actionBtn}</td>
          </tr>
        `;
      });
      patBody.innerHTML = patHtml;
    }

    // Render Active Pharmacies Governance Table
    const pharmBody = document.getElementById('adminPharmaciesTableBody');
    if (pharmBody && data.active_pharmacies) {
      let pharmHtml = '';
      data.active_pharmacies.forEach(p => {
        const isSuspended = p.status === 'SUSPENDED';
        const statusBadge = isSuspended
          ? '<span class="badge badge-danger">SUSPENDED</span>'
          : '<span class="badge badge-green">AUTHORIZED</span>';

        const actionBtn = isSuspended
          ? `<button class="btn btn-primary" style="padding:4px 8px; font-size:11px;" onclick="togglePharmacyStatus('${p.id}', '${p.status}')">Reactivate Store</button>`
          : `<button class="btn btn-secondary" style="padding:4px 8px; font-size:11px; color:var(--rose-danger);" onclick="togglePharmacyStatus('${p.id}', '${p.status}')">Suspend Authorization</button>`;

        const coordsDisplay = (p.lat && p.lng)
          ? `<span style="font-family:monospace; font-size:11px; color:var(--medical-blue);">📍 ${Number(p.lat).toFixed(4)}, ${Number(p.lng).toFixed(4)}</span>`
          : '<span style="color:var(--text-muted); font-size:11px;">Not pinned</span>';

        pharmHtml += `
          <tr>
            <td><strong>${p.name}</strong></td>
            <td><code>${p.license}</code></td>
            <td style="font-size:12px; max-width:200px; line-height:1.4;">${p.address || 'Palghar, Maharashtra'}</td>
            <td>${coordsDisplay}</td>
            <td>${p.phone}</td>
            <td>${statusBadge}</td>
            <td>${actionBtn}</td>
          </tr>
        `;
      });
      pharmBody.innerHTML = pharmHtml;
    }

    // Render Pending Pharmacies
    const pDiv = document.getElementById('pendingPharmaciesList');
    if (pDiv) {
      if (data.pending_pharmacies.length === 0) {
        pDiv.innerHTML = '<p style="color:var(--text-muted); font-size:13px;">No pending pharmacy approvals.</p>';
      } else {
        let html = '';
        data.pending_pharmacies.forEach(p => {
          html += `
            <div style="background:var(--bg-subtle); padding:12px; border-radius:8px; margin-bottom:10px; border:1px solid var(--border-color);" id="pendCard-${p.id}">
              <div class="flex-between">
                <div>
                  <strong>${p.name}</strong><br>
                  <span style="font-size:11px; color:var(--text-muted);">License: ${p.license} • ${p.address}</span>
                </div>
                <button class="btn btn-primary" style="padding:4px 10px; font-size:12px;" onclick="approvePharmacy('${p.id}')">Approve</button>
              </div>
            </div>
          `;
        });
        pDiv.innerHTML = html;
      }
    }

    // Render Real-Time Security Audit Logs
    const logDiv = document.getElementById('adminAuditLogs');
    if (logDiv) {
      let html = '';
      data.system_audit_logs.forEach(l => {
        html += `<div><span style="color:var(--medical-blue);">[${l.time}]</span> ${l.event}</div>`;
      });
      logDiv.innerHTML = html;
    }

  } catch (err) {
    console.error("Admin data fetch error", err);
  }
}

async function toggleUserStatus(userId, currentStatus) {
  const newStatus = (currentStatus === 'active') ? 'suspended' : 'active';
  try {
    const res = await fetch('/api/admin/users/toggle-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, status: newStatus })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`🎉 ${data.message}`);
      loadAdminData();
    } else {
      alert(`❌ ${data.detail || 'Failed to update user status.'}`);
    }
  } catch (err) {
    alert("User status change failed.");
  }
}

async function togglePharmacyStatus(pharmacyId, currentStatus) {
  const newStatus = (currentStatus === 'APPROVED') ? 'SUSPENDED' : 'APPROVED';
  try {
    const res = await fetch('/api/admin/pharmacies/toggle-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pharmacy_id: pharmacyId, status: newStatus })
    });
    const data = await res.json();
    if (res.ok) {
      alert(`🎉 ${data.message}`);
      loadAdminData();
    } else {
      alert(`❌ ${data.detail || 'Failed to update pharmacy status.'}`);
    }
  } catch (err) {
    alert("Pharmacy status change failed.");
  }
}

async function approvePharmacy(pId) {
  try {
    const res = await fetch(`/api/admin/pharmacies/approve/${pId}`, { method: 'POST' });
    const data = await res.json();
    alert(data.message);
    loadAdminData();
  } catch (err) {
    alert("Approval error");
  }
}

function renderFamilyProfiles() {
  const container = document.getElementById('familyProfilesList');
  if (!container) return;

  const profiles = [
    { name: "Rahul Sharma (Self)", rel: "Primary Member", blood: "O+" },
    { name: "Ramesh Sharma", rel: "Father (Age 68)", blood: "B+" },
    { name: "Sunita Sharma", rel: "Mother (Age 64)", blood: "A+" }
  ];

  let html = '';
  profiles.forEach(p => {
    html += `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-subtle); border-radius:8px; margin-bottom:8px;">
        <div>
          <strong style="font-size:14px;">${p.name}</strong>
          <div style="font-size:12px; color:var(--text-secondary);">${p.rel} • Blood Group: ${p.blood}</div>
        </div>
        <button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="executePatientSearch('Dolo')">Reorder History</button>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderReminders() {
  const container = document.getElementById('remindersList');
  if (!container) return;

  const reminders = [
    { med: "Dolo 650", patient: "Father", time: "08:00 AM & 08:00 PM" },
    { med: "Pantoprazole 40mg", patient: "Mother", time: "07:30 AM (Empty Stomach)" }
  ];

  let html = '';
  reminders.forEach(r => {
    html += `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--bg-subtle); border-radius:8px; margin-bottom:8px;">
        <div>
          <strong style="font-size:14px; color:var(--medical-blue);">${r.med}</strong>
          <div style="font-size:12px; color:var(--text-secondary);">${r.patient} • ${r.time}</div>
        </div>
        <span class="badge badge-green">ACTIVE</span>
      </div>
    `;
  });
  container.innerHTML = html;
}

function addFamilyProfilePrompt() {
  const name = prompt("Enter Member Name & Relation (e.g. Sunita Sharma - Mother):");
  if (name) {
    alert(`✅ Family profile added: ${name}`);
    renderFamilyProfiles();
  }
}

function addReminderPrompt() {
  const med  = prompt("Medicine name & dose (e.g. Dolo 650mg):");
  if (!med) return;
  const time = prompt("Reminder time(s) (e.g. 08:00 AM & 08:00 PM):", "08:00 AM");
  if (!time) return;
  showToast('Reminder Added', `⏰ Reminder set for ${med} at ${time}`, 'success');
  // In a real app this would persist to DB/localStorage and trigger push notification
}

// ==========================================
// INSTANT SKU PRICE & REFILL CONTROLLERS
// ==========================================

function openEditPriceModal(medId, fallbackName, fallbackPrice) {
  const modal = document.getElementById('editPriceModal');
  if (!modal) return;

  const item = (window._storeInventoryMap && window._storeInventoryMap[medId]) || null;
  const storeId = getStoreId();

  const medName = item ? item.name : (fallbackName || 'Medicine SKU');
  const genericDesc = item ? `${item.generic_name || ''} • ${item.category || ''} • Batch ${item.batch || ''}` : '';
  const currentMrp = item ? Number(item.mrp || 0) : Number(fallbackPrice || 0);

  const idInput = document.getElementById('editPriceMedId');
  if (idInput) idInput.value = medId;
  const storeInput = document.getElementById('editPriceStoreId');
  if (storeInput) storeInput.value = storeId;
  const nameEl = document.getElementById('editPriceMedName');
  if (nameEl) nameEl.innerText = medName;
  const genEl = document.getElementById('editPriceMedGeneric');
  if (genEl) genEl.innerText = genericDesc;
  const dispEl = document.getElementById('editPriceCurrentDisplay');
  if (dispEl) dispEl.innerText = `₹ ${currentMrp.toFixed(2)}`;

  const priceInput = document.getElementById('editPriceInput');
  if (priceInput) {
    priceInput.value = currentMrp > 0 ? currentMrp.toFixed(2) : '30.00';
  }

  modal.classList.add('active');

  setTimeout(() => {
    if (priceInput) {
      priceInput.focus();
      priceInput.select();
    }
  }, 60);
}

function closeEditPriceModal() {
  const modal = document.getElementById('editPriceModal');
  if (modal) modal.classList.remove('active');
}

function adjustEditPrice(delta) {
  const priceInput = document.getElementById('editPriceInput');
  if (!priceInput) return;
  const current = parseFloat(priceInput.value) || 0;
  const nextVal = Math.max(1, current + delta);
  priceInput.value = nextVal.toFixed(2);
}

function roundEditPrice() {
  const priceInput = document.getElementById('editPriceInput');
  if (!priceInput) return;
  const current = parseFloat(priceInput.value) || 0;
  priceInput.value = Math.ceil(current).toFixed(2);
}

async function handleEditPriceSubmit(e) {
  if (e) e.preventDefault();
  const medId = document.getElementById('editPriceMedId').value;
  const storeId = document.getElementById('editPriceStoreId').value || getStoreId();
  const priceInput = document.getElementById('editPriceInput');
  const newPrice = parseFloat(priceInput ? priceInput.value : 0);

  if (isNaN(newPrice) || newPrice <= 0) {
    showToast('Invalid Price', 'Please enter a valid selling price greater than ₹0.', 'warning');
    return;
  }

  const saveBtn = document.getElementById('editPriceSaveBtn');
  const origHtml = saveBtn ? saveBtn.innerHTML : '';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  }

  try {
    const res = await fetch('/api/pharmacy/inventory/update-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pharmacy_id: storeId,
        med_id: medId,
        new_mrp: newPrice
      })
    });

    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      // 1. Immediately update in-memory item
      if (window._storeInventoryMap && window._storeInventoryMap[medId]) {
        window._storeInventoryMap[medId].mrp = newPrice;
      }

      // 2. Immediately update cell price on page without waiting for fetch
      const cellText = document.getElementById(`invPriceText_${medId}`);
      if (cellText) {
        cellText.innerText = `₹ ${newPrice.toFixed(2)}`;
        cellText.style.color = 'var(--emerald-green)';
        cellText.style.fontWeight = '700';
      }

      closeEditPriceModal();
      showToast('Price Updated', `₹ ${newPrice.toFixed(2)} is now live across store SKU and patient searches!`, 'success');

      // 3. Refresh background cache & patient search if open
      loadPharmacyInventory(storeId);
      const medNameEl = document.getElementById('editPriceMedName');
      if (medNameEl && medNameEl.innerText) {
        executePatientSearch(medNameEl.innerText);
      }
    } else {
      showToast('Price Update Failed', data.detail || 'Could not update medicine price', 'error');
    }
  } catch (err) {
    console.error("Price update error:", err);
    showToast('Network Error', 'Failed to connect to pharmacy server.', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = origHtml;
    }
  }
}

// Fallback compatibility alias for any existing prompt callers
async function promptUpdateMedicinePrice(medId, medName, currentPrice) {
  openEditPriceModal(medId, medName, currentPrice);
}

// Quick Refill Modal Controllers
function openQuickRefillModal(medId, fallbackName) {
  const modal = document.getElementById('quickRefillModal');
  if (!modal) return;

  const item = (window._storeInventoryMap && window._storeInventoryMap[medId]) || null;
  const storeId = getStoreId();

  const medName = item ? item.name : (fallbackName || 'Medicine SKU');
  const currentStock = item ? Number(item.stock || 0) : 0;
  const cat = item ? `${item.category || ''} • Batch: ${item.batch || ''}` : '';

  const idInput = document.getElementById('quickRefillMedId');
  if (idInput) idInput.value = medId;
  const storeInput = document.getElementById('quickRefillStoreId');
  if (storeInput) storeInput.value = storeId;
  const nameEl = document.getElementById('quickRefillMedName');
  if (nameEl) nameEl.innerText = medName;
  const catEl = document.getElementById('quickRefillCategory');
  if (catEl) catEl.innerText = cat;
  const stockEl = document.getElementById('quickRefillCurrentStock');
  if (stockEl) stockEl.innerText = `${currentStock} Units`;

  const qtyInput = document.getElementById('quickRefillQtyInput');
  if (qtyInput) qtyInput.value = '50';

  modal.classList.add('active');

  setTimeout(() => {
    if (qtyInput) {
      qtyInput.focus();
      qtyInput.select();
    }
  }, 60);
}

function closeQuickRefillModal() {
  const modal = document.getElementById('quickRefillModal');
  if (modal) modal.classList.remove('active');
}

function setRefillQty(qty) {
  const qtyInput = document.getElementById('quickRefillQtyInput');
  if (qtyInput) qtyInput.value = qty;
}

async function handleQuickRefillSubmit(e) {
  if (e) e.preventDefault();
  const medId = document.getElementById('quickRefillMedId').value;
  const storeId = document.getElementById('quickRefillStoreId').value || getStoreId();
  const item = (window._storeInventoryMap && window._storeInventoryMap[medId]) || null;

  const qtyInput = document.getElementById('quickRefillQtyInput');
  const qty = parseInt(qtyInput ? qtyInput.value : 0);

  if (isNaN(qty) || qty <= 0) {
    showToast('Invalid Quantity', 'Please enter at least 1 unit to refill.', 'warning');
    return;
  }

  const saveBtn = document.getElementById('quickRefillSaveBtn');
  const origHtml = saveBtn ? saveBtn.innerHTML : '';
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Adding Stock...';
  }

  const medName = item ? item.name : (document.getElementById('quickRefillMedName').innerText || 'Medicine');
  const mrp = item ? item.mrp : 45.00;

  try {
    const res = await fetch('/api/pharmacy/inventory/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pharmacy_id: storeId,
        med_name: medName,
        stock_qty: qty,
        mrp: mrp,
        batch_no: item ? item.batch : `BAT-REFILL-${Math.floor(Math.random()*900+100)}`,
        expiry_date: item ? item.expiry : "2028-12-31"
      })
    });

    const data = await res.json();
    if (res.ok && data.status === 'SUCCESS') {
      closeQuickRefillModal();
      showToast('Stock Refilled', `Added +${qty} units of ${medName} to store inventory!`, 'success');
      loadPharmacyInventory(storeId);
    } else {
      showToast('Refill Failed', data.detail || 'Could not add stock units.', 'error');
    }
  } catch (err) {
    console.error("Refill error:", err);
    showToast('Network Error', 'Failed to connect to pharmacy server.', 'error');
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = origHtml;
    }
  }
}

async function loadDeliveryDispatches() {
  const container = document.getElementById('deliveryDispatchesContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/admin/all-data');
    const data = await res.json();
    const dispatches = data.emergency_dispatches || [];

    if (dispatches.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); padding:16px;">No active express dispatches at present.</p>';
      return;
    }

    let html = '';
    dispatches.forEach(d => {
      html += `
        <div class="card" style="margin-bottom: 16px; border-left: 4px solid var(--emerald-green); background: var(--bg-subtle);">
          <div class="flex-between" style="flex-wrap:wrap; gap:10px;">
            <div>
              <span class="badge badge-green">🚀 ${d.status}</span>
              <strong style="margin-left:8px; font-size:16px;">Express Dispatch #${d.dispatch_id}</strong>
            </div>
            <div style="font-size:13px; font-weight:700; color:var(--rose-danger);">
              <i class="fa-solid fa-clock"></i> Est. Delivery ETA: ${d.eta || '12 Mins'}
            </div>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-top:14px; font-size:13px;">
            <div>
              <p style="margin:0 0 6px 0;">👤 <strong>Patient Name:</strong> ${d.patient_name} (${d.patient_phone || '+91 98200 11998'})</p>
              <p style="margin:0 0 6px 0;">📍 <strong>Delivery Address:</strong> ${d.location_address || 'Green Park Sector 3'}</p>
              <p style="margin:0;">💊 <strong>Requested Medicine:</strong> <span style="color:var(--medical-blue); font-weight:700;">${d.requested_med}</span></p>
            </div>
            <div>
              <p style="margin:0 0 6px 0;">🏪 <strong>Dispatching Pharmacy:</strong> ${d.pharmacy_name} (${d.distance || '0.8 km'})</p>
              <p style="margin:0 0 6px 0;">🛵 <strong>Assigned Rider:</strong> ${d.rider_name || 'Vikram Singh (Rider #402)'}</p>
              <p style="margin:0;">📞 <strong>Rider Phone:</strong> ${d.rider_phone || '+91 98111 00998'}</p>
            </div>
          </div>

          <div style="margin-top:16px; display:flex; gap:10px; justify-content:flex-end;">
            <button class="btn btn-secondary" style="padding:6px 12px; font-size:12px;" onclick="alert('Contacting rider at ${d.rider_phone || '+91 98111 00998'}...')">
              <i class="fa-solid fa-phone"></i> Contact Rider
            </button>
            <button class="btn btn-primary" style="padding:6px 12px; font-size:12px;" onclick="markDispatchCompleted('${d.dispatch_id}')">
              <i class="fa-solid fa-circle-check"></i> Mark Delivered
            </button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = '<p style="color:var(--rose-danger);">Failed to load delivery dispatches.</p>';
  }
}

function markDispatchCompleted(dispatchId) {
  alert(`✅ Express Dispatch #${dispatchId} marked as successfully delivered!`);
  loadDeliveryDispatches();
}
