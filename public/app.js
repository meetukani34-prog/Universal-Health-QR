// --- GLOBAL CORE UTILITIES ---
window.APP = { state: {} };
// --- API CONFIGURATION ---
// In production, set this to your Railway URL. In dev, it stays empty for local proxying.
window.API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
  ? '' 
  : 'https://universal-health-qr-production.up.railway.app'; // Placeholder - user should update this

console.log('%c[Sarvam] Booting v1.1.2 @ ' + new Date().toLocaleTimeString(), 'color:#10B981;font-weight:bold');

window.toggleTheme = function () {

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('uhqr_theme', newTheme);
};

window.handleLogout = async function (target = '#/', role = null) {
  const roleMap = {
    patient: { key: 'uhqr_patient', state: 'patient' },
    doctor: { key: 'uhqr_doctor', state: 'doctor' },
    admin: { key: 'uhqr_admin', state: 'admin' },
    super_admin: { key: 'uhqr_superadmin', state: 'superAdmin' },
    hospital_head: { key: 'uhqr_hospital_head', state: 'hospitalHead' }
  };

  if (role && roleMap[role]) {
    const { key, state } = roleMap[role];
    delete APP.state[state];
    try { localStorage.removeItem(key); } catch (e) { }
    if (role === 'doctor') {
      delete APP.state.recentPatients; delete APP.state.docAppointments;
      delete APP.state.docStats; delete APP.state.doctorSSERunning;
    }
  } else {
    APP.state = {};
    Object.values(roleMap).forEach(({ key }) => { try { localStorage.removeItem(key); } catch (e) { } });
  }

  const appEl = document.getElementById('app');
  if (appEl) appEl.classList.add('app-exit-active');
  showToast(`<div class="micro-spinner"></div> De-orbiting session...`, 'logout');
  setTimeout(() => {
    if (appEl) appEl.classList.remove('app-exit-active');
    window.location.hash = target;
  }, 600);
};

function icon(name, cls = '') { return `<span class="material-symbols-outlined ${cls}">${name}</span>`; }
window.icon = icon;


// Restore session from localStorage
(function restoreSession() {
  try {
    const saved = localStorage.getItem('uhqr_patient');
    if (saved) APP.state.patient = JSON.parse(saved);
    const doc = localStorage.getItem('uhqr_doctor');
    if (doc) APP.state.doctor = JSON.parse(doc);
    const adm = localStorage.getItem('uhqr_admin');
    if (adm) APP.state.admin = JSON.parse(adm);
    const sa = localStorage.getItem('uhqr_superadmin');
    if (sa) APP.state.superAdmin = JSON.parse(sa);
    const hh = localStorage.getItem('uhqr_hospital_head');
    if (hh) APP.state.hospitalHead = JSON.parse(hh);
  } catch (e) { }
})();

function saveSession(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { }
}
function clearSession(key) {
  try { localStorage.removeItem(key); } catch (e) { }
}

// Toast
function showToast(msg, type = 'info') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = msg; // Support HTML for micro-spinners
  c.appendChild(t); setTimeout(() => t.remove(), 4000);
}

// De-orbit Cleanup & Animation


// API helper
async function api(url, opts = {}) {
  try {
    const defaultHeaders = opts.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
    const fullUrl = url.startsWith('http') ? url : (window.API_BASE_URL + url);
    const r = await fetch(fullUrl, {
      ...opts,
      headers: { ...defaultHeaders, ...(opts.headers || {}) },
      body: opts.body instanceof FormData ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined)
    });

    let data;
    const contentType = r.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await r.json();
    } else {
      const text = await r.text();
      if (!r.ok) throw new Error(`Server error (${r.status}): ${text.substring(0, 100)}`);
      data = { message: text };
    }

    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (e) {
    console.error('API Error:', e);
    showToast(e.message, 'error');
    throw e;
  }
}

// Router
function navigate(hash) { window.location.hash = hash; }
function showModal(html) {
  const overlay = document.getElementById('modal-overlay');
  const body = document.getElementById('modal-body');
  if (!overlay || !body) return;
  body.innerHTML = html;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden'; // Prevent scroll
}
function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}
function getRoute() {
  const full = window.location.hash.slice(1) || '/';
  const [path, query] = full.split('?');
  const params = {};
  if (query) {
    query.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      params[k] = decodeURIComponent(v || '');
    });
  }
  return { path, parts: path.split('/').filter(Boolean), params };
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', () => {
  render();

  // --- ROBUST EVENT DELEGATION HUB ---
  document.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.dataset.action;

    if (action === 'toggle-theme') {
      e.preventDefault();
      window.toggleTheme();
    }

    if (action === 'logout') {
      e.preventDefault();
      const path = target.dataset.target || '#/';
      const role = target.dataset.role || null;
      window.handleLogout(path, role);
    }

    if (action === 'navigate') {
      e.preventDefault();
      const hash = target.dataset.target;
      if (hash) window.location.hash = hash;
    }

    // Smooth Scroll for Internal Anchors
    const href = e.target.closest('a')?.getAttribute('href');
    if (href && href.startsWith('#') && !href.includes('/')) {
      const id = href.slice(1);
      const el = document.getElementById(id);
      if (el) {
        e.preventDefault();
        el.scrollIntoView({ behavior: 'smooth' });
        // Update hash without triggering hashchange-render cycle if possible, 
        // or just let it happen but render() will handle it.
        history.pushState(null, null, href);
      }
    }
  });
});


function render() {
  const { path, parts, params } = getRoute();
  const app = document.getElementById('app');

  // Optimization: If the target is an anchor on the current page, skip re-render
  if (path && document.getElementById(path) && !path.startsWith('/')) {
    const el = document.getElementById(path);
    el.scrollIntoView({ behavior: 'smooth' });
    return;
  }

  app.innerHTML = '';

  // --- Router Guard: Selective Auth Protocol ---
  // 1. Redirect already logged-in users away from THEIR OWN login/reg pages
  if (APP.state.patient && ['/patient-login', '/patient-register', '/register'].includes(path)) { navigate('/patient-dashboard'); return; }
  if (APP.state.doctor && ['/doctor-login', '/doctor-register', '/register'].includes(path)) { navigate('/doctor-dashboard'); return; }
  if (APP.state.admin && ['/admin-login'].includes(path)) { navigate('/admin'); return; }
  if (APP.state.superAdmin && ['/super-admin-login', '/register'].includes(path)) { navigate('/super-admin'); return; }
  if (APP.state.hospitalHead && ['/hospital-head-login'].includes(path)) { navigate('/hospital-head'); return; }

  // 2. Protect Dashboard Routes (Redirect if NOT logged in)
  if (path === '/patient-dashboard' && !APP.state.patient) { navigate('/patient-login'); return; }
  if (path === '/doctor-dashboard' && !APP.state.doctor) { navigate('/doctor-login'); return; }
  if (path === '/admin' && !APP.state.admin) { navigate('/admin-login'); return; }
  if (path === '/super-admin' && !APP.state.superAdmin) { navigate('/super-admin-login'); return; }
  if (path === '/hospital-head' && !APP.state.hospitalHead) { navigate('/hospital-head-login'); return; }

  // 3. Routing Engine
  if (path === '/' || path === '') renderLanding(app);
  else if (path === '/register') renderRegistrationChoice(app);
  else if (path === '/patient-register') renderRegistrationEmailVerification(app, 'patient');
  else if (path === '/doctor-register') renderRegistrationEmailVerification(app, 'doctor');
  else if (path === '/patient-login') renderPatientLogin(app);
  else if (path === '/patient-dashboard') { renderPatientDashboard(app); initPatientSSE(); }
  else if (path === '/doctor-login') renderDoctorAuth(app);
  else if (path === '/doctor-dashboard') renderDoctorDashboard(app);
  else if (path === '/scan') renderScanner(app);
  else if (parts[0] === 'patient' && parts[1]) renderPatientAccess(app, parts[1]);
  else if (path === '/admin-login') renderAdminAuth(app);
  else if (path === '/admin') renderAdminPanel(app);
  else if (path === '/add-prescription') renderAddPrescription(app);
  else if (path === '/super-admin-login') renderSuperAdminLogin(app);
  else if (path === '/super-admin') renderSuperAdminDashboard(app);
  else if (path === '/hospital-head-login') renderHospitalHeadLogin(app);
  else if (path === '/hospital-head') renderHospitalHeadDashboard(app);
  else if (path === '/beds') renderBedSearch(app);
  else if (path === '/beds/stats') renderBedStats(app);
  else if (path === '/mental-health') renderMHLanding(app);
  else if (path === '/mental-health/tracker') renderMHTracker(app);
  else if (path === '/mental-health/assessment') renderMHAssessment(app);
  else if (path === '/mental-health/chat') renderMHChat(app);
  else if (path === '/mental-health/resources') renderMHResources(app);
  else if (path === '/mental-health/therapists') renderMHTherapists(app);
  else if (path === '/forgot-password') renderForgotPassword(app);
  else if (path === '/privacy') renderPrivacy(app);
  else if (path === '/terms') renderTerms(app);
  else if (path === '/hipaa') renderHIPAA(app);
  else if (path === '/about') renderAbout(app);
  else renderLanding(app);

  // Only scroll to top if not an internal anchor jump
  if (path && !document.getElementById(path)) {
    window.scrollTo(0, 0);
  } else if (!path || path === '/') {
    window.scrollTo(0, 0);
  }
}

// Theme Initialization
(function initTheme() {
  const theme = localStorage.getItem('uhqr_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
})();



function navbar(activeLinks = []) {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const themeIcon = currentTheme === 'dark' ? 'light_mode' : 'dark_mode';

  return `<nav class="navbar"><div class="navbar-inner">
    <a href="#/" class="navbar-brand">
      <img src="/logo.png" alt="Sarvam" class="brand-logo">
      <span class="brand-text">Sarvam</span>
    </a>
    <div class="navbar-links">
      <a href="#/">${icon('home')} <span class="nav-label">Home</span></a>
      <a href="#/beds">${icon('bed')} <span class="nav-label">Find Beds</span></a>
      <a href="#/mental-health" style="color:#34d399 !important; font-weight:700">${icon('volunteer_activism')} <span class="nav-label">Wellness</span></a>
      <a href="#/register">${icon('person_add')} <span class="nav-label">Register</span></a>
      <a href="#/scan">${icon('qr_code_scanner')} <span class="nav-label">Scan QR</span></a>

    </div>
  </div></nav>`;
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ============================================================
// LANDING PAGE
// ============================================================
function renderLanding(app) {
  app.innerHTML = `
  <div class="hud-vignette"></div>
  ${navbar()}
  <div class="page-enter" style="position:relative; min-height:100vh;">
    <!-- Global HUD Background Elements -->
    <div class="geo-grid"></div>
    <div class="hud-data-lines"></div>
    
    <div class="hero-video-container">
      <video class="hero-video" autoplay loop muted playsinline poster="/hero-bg.png" style="width:100%; height:100%; object-fit:cover;">
        <source src="https://assets.mixkit.co/videos/preview/mixkit-abstract-futuristic-technology-background-loop-4509-large.mp4" type="video/mp4">
      </video>
      <div class="hero-overlay" style="position:fixed; inset:0; background:radial-gradient(circle at center, transparent 10%, rgba(0,0,0,0.6) 100%); z-index:-1;"></div>
      <div class="cryo-blur-fade"></div>
    </div>

    <!-- Interactive Background Blobs -->
    <div id="blob1" class="bg-blob"></div>
    <div id="blob2" class="bg-blob secondary"></div>

    <div class="hud-sidebar-index">
      <a href="#hero" class="index-item active" data-index="hero"><span class="index-label">The Identity</span><div class="index-dot"></div></a>
      <a href="#how-it-works" class="index-item" data-index="how-it-works"><span class="index-label">Process</span><div class="index-dot"></div></a>
      <a href="#safety" class="index-item" data-index="safety"><span class="index-label">Safety</span><div class="index-dot"></div></a>
      <a href="#get-started" class="index-item" data-index="get-started"><span class="index-label">Begin</span><div class="index-dot"></div></a>
    </div>

    <!-- Floating 3D Assets -->
    <img src="/sarvam_3d_new.png" class="floating-3d-asset asset-book" alt="3D Book">
    <img src="/sarvam_3d_new.png" class="floating-3d-asset asset-card" alt="3D Card">
    <img src="/sarvam_3d_new.png" class="floating-3d-asset asset-vial" alt="3D Vial">

    <section id="hero" class="hero" style="background:transparent;"><div class="container">
      <div class="hero-content" style="position:relative; z-index:10; padding: 4rem 2rem;">
        <div class="hero-glass-core-panel reveal-panel">
          <div style="margin-bottom:2rem;display:inline-block;">
            <div class="hero-logo-box floating hero-glow-effect" style="background:transparent; border:none; box-shadow:none;">
              <img src="/logo.png" alt="Sarvam Logo" style="width:120px;display:block">
            </div>
          </div>
          
          <h1 class="reveal appear-1">
            SARVAM
          </h1>
          <p class="reveal appear-2">
            A secure, digital identity for your medical history. Access emergency data instantly and clinical records with a single OTP.
          </p>
          
          <!-- Healthcare Micro-Status Badges -->
          <div class="hero-badges-row reveal appear-3" style="margin-bottom:0;">
            <div class="health-badge glass-card-dark" style="padding: 0.75rem 1.5rem;">
              ${icon('verified_user')} Verified Identity
            </div>
            <div class="health-badge glass-card-dark" style="padding: 0.75rem 1.5rem;">
              ${icon('emergency_share')} Emergency Ready
            </div>
            <div class="health-badge glass-card-dark" style="padding: 0.75rem 1.5rem;">
              ${icon('cloud_done')} Secure Cloud
            </div>

              <section>
                <div class="hero-buttons reveal appear-4" style="margin-top:3.5rem; gap:1.5rem; display:flex; justify-content:center;">
                <button class="btn btn-hud-primary btn-lg" onclick="handlePatientClick()">${icon('person')} I'm a Patient</button>
                <a href="#/beds" style="background-color: #b41d1dff !important;" class="btn btn-hud-secondary btn-lg">${icon('emergency', 'text-secondary')} Find ICU/Beds</a>
                <a href="#/doctor-login" style="background-color: #0d60cdff !important;" class="btn btn-hud-outline btn-lg">${icon('stethoscope')} I'm a Doctor</a>
                </div>
              </section>
          </div>
        </div>

      
      </div>
    </div></section>

    <section id="how-it-works" class="section scroll-reveal" style="background:transparent; position:relative; z-index:10;"><div class="container">
      <h2 class="section-title text-center" style="text-shadow: 0 4px 20px rgba(0,0,0,0.5);">How it Works</h2>
      <p class="section-subtitle text-center" style="opacity:0.8;">Three simple steps to bridge emergency care and your medical history.</p>
      <div class="steps-grid">
        <div class="step-card glass-card-dark"><span class="step-number" style="color:white">1</span><div class="step-icon">${icon('app_registration')}</div><h3>Register</h3><p>Fill out your medical profile to get your unique QR card.</p></div>
        <div class="step-card glass-card-dark"><span class="step-number" style="color:white">2</span><div class="step-icon">${icon('qr_code_2')}</div><h3>Carry</h3><p>Keep your digital QR on your phone or carry a printed card.</p></div>
        <div class="step-card glass-card-dark"><span class="step-number" style="color:white">3</span><div class="step-icon">${icon('verified_user')}</div><h3>Access</h3><p>Doctors scan for instant emergency info. Full history requires OTP.</p></div>
      </div>
    </div></section>

    <section id="safety" class="section scroll-reveal" style="background:transparent; position:relative; z-index:10;"><div class="container">
      <h2 class="section-title text-center" style="text-shadow: 0 4px 20px rgba(0,0,0,0.5);">Built for Safety</h2>
      <p class="section-subtitle text-center" style="opacity:0.8;">Security and speed when it matters most.</p>
      <div class="features-grid">
        <div class="feature-card glass-card-dark"><div class="feature-icon emergency">${icon('emergency')}</div><h3>Emergency Data at Speed</h3><p>Blood group, conditions, and allergies instantly accessible to first responders.</p></div>
        <div class="feature-card glass-card-dark"><div class="feature-icon security">${icon('encrypted')}</div><h3>OTP-Protected Records</h3><p>Clinical data locked behind patient-approved OTP verification.</p></div>
        <div class="feature-card glass-card-dark"><div class="feature-icon universal">${icon('language')}</div><h3>Universal Access</h3><p>Works across hospitals, clinics, and emergency services.</p></div>
      </div>
    </div></section>

    <section id="get-started" class="section scroll-reveal" style="background:transparent;"><div class="container text-center">
      <div class="glass-card-dark" style="max-width:900px; margin:0 auto; padding:4rem;">
        <h2 class="section-title">Ready to Get Started?</h2>
        <p class="section-subtitle">Create your Health QR in under 2 minutes.</p>
        <div style="display:flex;gap:1.5rem;justify-content:center;flex-wrap:wrap;margin-top:2rem;">
          <a href="#/register" class="btn btn-hud-primary btn-lg">${icon('person_add')} Register Now</a>
          <a href="#/doctor-login" class="btn btn-hud-outline btn-lg">${icon('stethoscope')} Doctor Portal</a>
          <a href="#/super-admin-login" class="btn btn-hud-outline btn-lg">${icon('shield_person')} Super Admin</a>
          <a href="#/hospital-head-login" class="btn btn-hud-outline btn-lg">${icon('domain')} Hospital Head</a>
        </div>
      </div>
    </div></section>

    <footer class="footer" style="padding: 4rem 0; background: transparent; border-top: 1px solid rgba(255,255,255,0.05);">
      <div class="container">
        <div class="footer-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 3rem; margin-bottom: 3rem;">
          <div class="footer-brand">
            <h3 style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;font-size:1.5rem">
              <img src="/logo.png" alt="Sarvam" class="brand-logo" style="width:2rem;height:2rem"> 
              <span class="brand-text">SARVAM</span>
            </h3>
            <p style="color:var(--on-surface-variant);line-height:1.6">Your secure digital identity for medical history. Instant access to emergency data and clinical records.</p>
          </div>
          
          <div class="footer-links-col">
            <h4 style="margin-bottom:1.25rem;font-size:1.1rem;color:var(--on-surface)">Quick Links</h4>
            <div style="display:flex;flex-direction:column;gap:0.75rem">
              <a href="#/beds" style="color:var(--on-surface-variant)">Find Beds</a>
              <a href="#/about" style="color:var(--on-surface-variant)">About Us</a>
              <a href="#/privacy" style="color:var(--on-surface-variant)">Privacy Policy</a>
              <a href="#/terms" style="color:var(--on-surface-variant)">Terms of Service</a>
            </div>
          </div>

          <div class="footer-contact">
            <h4 style="margin-bottom:1.25rem;font-size:1.1rem;color:var(--on-surface)">Contact Us</h4>
            <div style="display:flex;flex-direction:column;gap:1rem">
              <a href="https://maps.google.com/?q=Survey+No.+137,+Doddakamanahalli,+Begur+Hobli,+Bengaluru+South+-+560076" target="_blank" rel="noopener noreferrer" style="display:flex;gap:0.5rem;color:var(--on-surface-variant);align-items:flex-start;text-decoration:none">
                 <span class="material-symbols-outlined" style="color:var(--primary);font-size:1.25rem">location_on</span>
                 <span>Survey No. 137, Doddakamanahalli, <br>Begur Hobli, Bengaluru South - 560076</span>
              </a>
              <a href="tel:+918799622618" style="display:flex;gap:0.5rem;color:var(--on-surface-variant);align-items:center;text-decoration:none">
                 <span class="material-symbols-outlined" style="color:var(--primary);font-size:1.25rem">phone_iphone</span>
                 <span>+91 87996 22618</span>
              </a>
              <a href="mailto:healthsarvam@gmail.com" style="display:flex;gap:0.5rem;color:var(--on-surface-variant);align-items:center;text-decoration:none">
                 <span class="material-symbols-outlined" style="color:var(--primary);font-size:1.25rem">mail</span>
                 <span>healthsarvam@gmail.com</span>
              </a>
            </div>
          </div>
        </div>
        
        <div class="footer-bottom" style="text-align:center;padding-top:2rem;border-top:1px solid var(--outline-variant);color:white;font-size:0.9rem">
          &copy; 2026 SARVAM. All rights reserved.
        </div>
      </div>
    </footer>
  </div>`;

  // --- RE-INITIALIZE INTERACTIVE LOGIC AFTER RENDER ---
  setTimeout(() => {
    const b1 = document.getElementById('blob1');
    const b2 = document.getElementById('blob2');
    const grid = document.querySelector('.geo-grid');
    const assets = document.querySelectorAll('.floating-3d-asset');

    if (b1 && b2) {
      if (window._parallaxHandler) {
        window.removeEventListener('mousemove', window._parallaxHandler);
      }

      let ticking = false;
      let mouseX = 0;
      let mouseY = 0;

      window._parallaxHandler = (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        if (!ticking) {
          window.requestAnimationFrame(() => {
            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            b1.style.transform = `translate(${mouseX / 15}px, ${mouseY / 15}px)`;
            b2.style.transform = `translate(${-mouseX / 20}px, ${-mouseY / 20}px)`;
            if (grid) grid.style.transform = `translate(${mouseX / 60}px, ${mouseY / 60}px)`;

            // Asset Parallax
            assets.forEach((asset, i) => {
              const depth = (i + 1) * 30;
              const moveX = (mouseX - centerX) / depth;
              const moveY = (mouseY - centerY) / depth;
              asset.style.transform = `translate(${moveX}px, ${moveY}px)`;
            });
            ticking = false;
          });
          ticking = true;
        }
      };

      window.addEventListener('mousemove', window._parallaxHandler);
    }

    // Modern Sidebar Index & Section Reveal Observer
    const indexItems = document.querySelectorAll('.index-item');
    const observerOptions = { threshold: 0.1, rootMargin: '-10% 0px -40% 0px' };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Highlight Sidebar Index
          const id = entry.target.id;
          if (id) {
            indexItems.forEach(item => {
              item.classList.toggle('active', item.dataset.index === id);
            });
          }

          // Reveal Animation
          entry.target.classList.add('visible');
        }
      });
    }, observerOptions);

    document.querySelectorAll('.scroll-reveal, section[id]').forEach(el => observer.observe(el));
  }, 0);
}

// Session-aware patient redirect
function handlePatientClick() {
  if (APP.state.patient) {
    navigate('/patient-dashboard');
  } else {
    navigate('/patient-login');
  }
}

// ============================================================
// PATIENT REGISTRATION (with email + password)
// ============================================================
const ALLERGIES = ['NSAIDs', 'Penicillin', 'Latex', 'Sulfa Drugs', 'Aspirin', 'Ibuprofen', 'Codeine', 'Morphine'];
const CONDITIONS = ['Asthma', 'Diabetes', 'Epilepsy', 'Hypertension', 'Heart Disease', 'Thyroid', 'Arthritis', 'COPD'];

function renderRegistrationChoice(app, verifiedEmail) {
  // If not verified email, enforce email verification first generically
  if (!verifiedEmail) {
    return renderRegistrationEmailVerification(app, null);
  }

  app.innerHTML = `${navbar()}
  <div class="page-enter container" style="padding:8rem 0">
    <div style="text-align:center;margin-bottom:3.5rem">
      <h1 style="font-size:2.5rem;margin-bottom:1rem;letter-spacing:-0.03em">Welcome to Sarvam</h1>
      <p class="text-muted" style="font-size:1.125rem">Choose how you want to use the platform today.</p>
    </div>
    
    <div class="choice-container">
      <a href="javascript:void(0)" onclick="renderPatientRegistration(document.getElementById('app'), '${verifiedEmail}')" class="selection-card">
        <div class="selection-icon">${icon('person')}</div>
        <h2>I'm a Patient</h2>
        <p>Create your universal Health QR profile, store medical history, and access emergency services.</p>
        <div class="btn btn-primary">Register as Patient</div>
      </a>
      
      <a href="javascript:void(0)" onclick="renderDoctorRegistration(document.getElementById('app'), '${verifiedEmail}')" class="selection-card">
        <div class="selection-icon">${icon('stethoscope')}</div>
        <h2>I'm a Doctor</h2>
        <p>Register your clinic/hospital practice, provide consultations, and access patient records securely.</p>
        <div class="btn btn-secondary">Register as Doctor</div>
      </a>
    </div>

    <div style="text-align:center;margin-top:4rem">
      <p class="text-muted">Already have an account? 
        <a href="#/patient-login" style="color:var(--primary);font-weight:600">Login here</a>
      </p>
    </div>
  </div>`;
}

// ============================================================
// PRE-REGISTRATION EMAIL VERIFICATION
// ============================================================
function renderRegistrationEmailVerification(app, role) {
  let pendingEmail = '';
  let countdownTimer = null;
  let devOtp = null;

  const showEmailStep = () => {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    app.innerHTML = `${navbar()}
    <div class="page-enter">
      <div class="login-card">
        <div style="text-align:center;margin-bottom:1.5rem">
          <div style="width:3.5rem;height:3.5rem;border-radius:50%;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:1.75rem">${icon('mark_email_read')}</div>
          <h2>Verify Your Email</h2><p>Please confirm your email before registering your ${role || 'new'} account</p>
        </div>
        <div class="form-group"><label class="form-label">Email Address</label><input class="form-input" id="reg-verify-email" type="email" placeholder="you@example.com"></div>
        <button class="btn btn-primary btn-block mb-2" id="reg-verify-send-btn">${icon('send')} Send Verification Code</button>
        <p class="text-center text-muted" style="font-size:0.875rem"><a href="#/register">Go back</a></p>
      </div>
    </div>`;

    document.getElementById('reg-verify-send-btn').onclick = async () => {
      const email = document.getElementById('reg-verify-email').value.trim();
      if (!email) { showToast('Enter your email address', 'error'); return; }
      const btn = document.getElementById('reg-verify-send-btn');
      btn.disabled = true; btn.innerHTML = `<span class="ir-pulse-dot"></span> Sending...`;
      try {
        const data = await api('/api/auth/register-send-otp', {
          method: 'POST', body: { email, role }
        });
        showToast(data.email_sent ? `Code sent to ${email}` : 'Dev mode: OTP shown below', data.email_sent ? 'success' : 'info');
        showOtpStep(email, data.dev_otp || null);
      } catch (e) {
        btn.disabled = false; btn.innerHTML = `${icon('send')} Send Verification Code`;
      }
    };
  };

  const showOtpStep = (email, dOtp) => {
    devOtp = dOtp;
    pendingEmail = email;
    app.innerHTML = `${navbar()}
    <div class="page-enter">
      <div class="login-card">
        <div style="text-align:center;margin-bottom:1.5rem">
          <div style="width:3.5rem;height:3.5rem;border-radius:50%;background:var(--success-light);color:var(--success);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:1.75rem">${icon('mark_email_read')}</div>
          <h2>Enter Verification Code</h2>
          <p>A 6-digit code was sent to <strong>${email}</strong></p>
        </div>

        <div class="ir-field-wrap" style="margin-bottom:1rem">
          <label class="ir-label">${icon('dialpad')} 6-Digit Verification Code</label>
          <div class="ir-otp-row" id="login-otp-row">
            ${[0, 1, 2, 3, 4, 5].map(i => `<input class="ir-otp-box" id="lotp-${i}" type="text" maxlength="1" inputmode="numeric" pattern="[0-9]">`).join('')}
          </div>
        </div>
        <div class="ir-ttl" style="margin-bottom:1rem" id="login-ttl">${icon('schedule')} Code expires in <span id="login-ttl-count">05:00</span></div>
        <button class="btn btn-primary btn-block mb-2" id="reg-otp-verify-btn">${icon('verified_user')} Verify Email</button>
        <button class="btn btn-outline btn-block mb-2" id="login-resend-btn" disabled>Resend Code (wait 2:00)</button>
        <button class="btn btn-text btn-block text-muted" id="login-back-btn" style="font-size:0.875rem">${icon('arrow_back')} Change Email</button>
      </div>
    </div>`;

    // Wire up OTP inputs
    const boxes = Array.from({ length: 6 }, (_, i) => document.getElementById(`lotp-${i}`));
    boxes[0].focus();
    boxes.forEach((box, i) => {
      box.oninput = e => {
        const v = e.target.value.replace(/\D/g, ''); box.value = v;
        if (v && i < 5) boxes[i + 1].focus();
        if (boxes.every(b => b.value)) document.getElementById('reg-otp-verify-btn')?.click();
      };
      box.onkeydown = e => {
        if (e.key === 'Backspace' && !box.value && i > 0) { boxes[i - 1].focus(); boxes[i - 1].value = ''; }
        if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
        if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus();
      };
      box.onpaste = e => {
        const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
        paste.split('').forEach((ch, j) => { if (boxes[j]) boxes[j].value = ch; });
        e.preventDefault();
        if (boxes.every(b => b.value)) setTimeout(() => document.getElementById('reg-otp-verify-btn')?.click(), 100);
      };
    });

    // Countdown & Resend
    let remaining = 5 * 60;
    let resendWait = 120; // 2 minutes
    const ttlEl = document.getElementById('login-ttl-count');
    const resendBtn = document.getElementById('login-resend-btn');

    countdownTimer = setInterval(() => {
      remaining--;

      // Resend Timer Logic
      if (resendWait > 0) {
        resendWait--;
        if (resendWait <= 0 && resendBtn) {
          resendBtn.disabled = false;
          resendBtn.innerHTML = `${icon('refresh')} Resend Code`;
          resendBtn.onclick = async () => {
            resendBtn.disabled = true;
            resendBtn.innerHTML = `<span class="ir-pulse-dot"></span> Sending...`;
            try {
              const data = await api('/api/auth/register-send-otp', { method: 'POST', body: { email, role } });
              if (countdownTimer) clearInterval(countdownTimer);
              showToast(data.email_sent ? 'New code sent!' : 'Dev mode: OTP refreshed', 'success');
              showOtpStep(email, data.dev_otp || null); // Re-render to reset everything
            } catch (e) {
              resendBtn.disabled = false;
              resendBtn.innerHTML = `${icon('refresh')} Resend Code`;
            }
          };
        } else if (resendBtn) {
          const m = String(Math.floor(resendWait / 60));
          const s = String(resendWait % 60).padStart(2, '0');
          resendBtn.textContent = `Resend Code (wait ${m}:${s})`;
        }
      }

      if (remaining <= 0) {
        clearInterval(countdownTimer);
        if (ttlEl) ttlEl.textContent = '00:00 (expired)';
        const vBtn = document.getElementById('reg-otp-verify-btn');
        if (vBtn) vBtn.disabled = true;
        return;
      }
      const m = String(Math.floor(remaining / 60)).padStart(2, '0');
      const s = String(remaining % 60).padStart(2, '0');
      if (ttlEl) ttlEl.textContent = `${m}:${s}`;
    }, 1000);



    document.getElementById('login-back-btn').onclick = () => {
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
      showEmailStep();
    };

    document.getElementById('reg-otp-verify-btn').onclick = async () => {
      const otp = boxes.map(b => b.value).join('');
      if (otp.length !== 6) { showToast('Enter all 6 digits', 'error'); return; }
      const btn = document.getElementById('reg-otp-verify-btn');
      btn.disabled = true; btn.innerHTML = `<span class="ir-pulse-dot"></span> Verifying...`;
      try {
        const data = await api('/api/auth/register-verify-otp', { method: 'POST', body: { email: pendingEmail, otp } });
        if (countdownTimer) clearInterval(countdownTimer);
        showToast('Email verified!', 'success');
        if (role === 'patient') {
          renderPatientRegistration(app, data.verified_email);
        } else if (role === 'doctor') {
          renderDoctorRegistration(app, data.verified_email);
        } else {
          renderRegistrationChoice(app, data.verified_email);
        }
      } catch (e) {
        btn.disabled = false; btn.innerHTML = `${icon('verified_user')} Verify Email`;
        boxes.forEach(b => { b.classList.add('ir-otp-error'); setTimeout(() => b.classList.remove('ir-otp-error'), 600); });
      }
    };
  };

  showEmailStep();
}

function renderPatientRegistration(app, verifiedEmail) {
  app.innerHTML = `${navbar()}
  <div class="page-enter container" style="padding-top:8rem;padding-bottom:3rem">
    <div class="form-container" id="reg-form-wrap">
      <h1 style="font-size:1.75rem;margin-bottom:0.25rem">${icon('person_add')} Patient Registration</h1>
      <p class="text-muted mb-4">Create your Sarvam Health identity.</p>
      <form id="reg-form">
        <div class="form-section">
          <div class="form-section-title"><div class="icon">${icon('badge')}</div> Personal Identity</div>
          <div class="photo-upload">
            <div class="photo-preview" id="photo-preview">${icon('photo_camera')}</div>
            <div><label class="btn btn-outline btn-sm" for="photo-input">${icon('upload')} Upload Photo</label>
            <input type="file" id="photo-input" accept="image/*" hidden><p class="text-muted" style="font-size:0.8rem;margin-top:0.5rem">JPG or PNG. Max 5MB.</p></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Full Name *</label><input class="form-input" name="name" required placeholder="John Doe"></div>
            <div class="form-group"><label class="form-label">Date of Birth *</label><input class="form-input" name="dob" type="date" required></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Gender</label>
              <select class="form-select" name="gender"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div>
            <div class="form-group"><label class="form-label">Phone Number *</label><input class="form-input" name="phone" type="tel" required placeholder="+91 98765 43210"></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Email *</label><input class="form-input" name="email" type="email" required placeholder="patient@example.com" value="${verifiedEmail || ''}" ${verifiedEmail ? 'readonly style="opacity:0.7"' : ''}></div>
            <div class="form-group"><label class="form-label">Blood Group *</label>
              <select class="form-select" name="blood_group" required><option value="">Select</option>
              ${['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => `<option>${b}</option>`).join('')}</select></div>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Password *</label><input class="form-input" name="password" type="password" required placeholder="Min 6 characters" minlength="6"></div>
            <div class="form-group"><label class="form-label">Address</label><input class="form-input" name="address" placeholder="Your address"></div>
          </div>
        </div>
        <div class="form-section">
          <div class="form-section-title"><div class="icon" style="background:var(--tertiary-light);color:var(--tertiary)">${icon('contact_phone')}</div> Emergency Contact</div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Contact Name</label><input class="form-input" name="emergency_contact_name" placeholder="Jane Doe"></div>
            <div class="form-group"><label class="form-label">Relationship</label>
              <select class="form-select" name="emergency_contact_relationship"><option>Spouse</option><option>Parent</option><option>Sibling</option><option>Child</option><option>Friend</option><option>Other</option></select></div>
          </div>
          <div class="form-group"><label class="form-label">Contact Phone</label><input class="form-input" name="emergency_contact_phone" type="tel" placeholder="+91 98765 43210"></div>
        </div>
        <div class="form-section">
          <div class="form-section-title"><div class="icon" style="background:var(--tertiary-light);color:var(--tertiary)">${icon('medical_information')}</div> Medical Record</div>
          <label class="form-label">Allergies</label>
          <div class="checkbox-grid mb-3">${ALLERGIES.map(a => `<label class="checkbox-item"><input type="checkbox" name="allergies" value="${a}"><span>${a}</span></label>`).join('')}</div>
          <label class="form-label">Chronic Conditions</label>
          <div class="checkbox-grid mb-3">${CONDITIONS.map(c => `<label class="checkbox-item"><input type="checkbox" name="chronic_conditions" value="${c}"><span>${c}</span></label>`).join('')}</div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Immunization Status</label>
              <select class="form-select" name="immunization_status"><option>Up to Date</option><option>Partially Vaccinated</option><option>Not Updated</option></select></div>
            <div class="form-group"><label class="form-label">Organ Donor</label>
              <select class="form-select" name="organ_donor_status"><option>No</option><option>Yes</option></select></div>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-lg btn-block">${icon('qr_code_2')} Create My Sarvam ID</button>
      </form>
    </div>
    <div id="qr-result" class="hidden"></div>
  </div>`;

  document.getElementById('photo-input').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => document.getElementById('photo-preview').innerHTML = `<img src="${ev.target.result}">`;
    r.readAsDataURL(f);
  };
  document.querySelectorAll('.checkbox-item input').forEach(cb => {
    cb.onchange = () => cb.closest('.checkbox-item').classList.toggle('checked', cb.checked);
  });

  document.getElementById('reg-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const photoFile = document.getElementById('photo-input').files[0];
    if (photoFile) fd.set('photo', photoFile);
    const allergies = [...document.querySelectorAll('input[name="allergies"]:checked')].map(c => c.value);
    const conditions = [...document.querySelectorAll('input[name="chronic_conditions"]:checked')].map(c => c.value);
    fd.delete('allergies'); fd.delete('chronic_conditions');
    allergies.forEach(a => fd.append('allergies', a));
    conditions.forEach(c => fd.append('chronic_conditions', c));
    try {
      const data = await fetch('/api/patients/register', { method: 'POST', body: fd }).then(r => r.json());
      if (data.error) { showToast(data.error, 'error'); return; }
      showToast('Registration successful!', 'success');
      document.getElementById('reg-form-wrap').classList.add('hidden');
      document.getElementById('qr-result').classList.remove('hidden');
      document.getElementById('qr-result').innerHTML = `
        <div class="qr-result">
          <div style="width:4rem;height:4rem;border-radius:50%;background:var(--success-light);color:var(--success);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:2rem">${icon('check_circle')}</div>
          <h2>Registration Successful!</h2>
          <p class="text-muted mb-3">Your universal medical identity has been created.</p>
          <div class="qr-image"><img src="${data.patient.qr_code_url}" alt="QR Code" id="qr-img"></div>
          <div class="patient-hash">${icon('fingerprint')} ${data.patient.id}</div>
          <p style="margin-bottom:1.5rem"><strong>${data.patient.name}</strong> - ${data.patient.blood_group} - ${data.patient.phone}</p>
          <div class="qr-actions">
            <button class="btn btn-primary" onclick="downloadQR()">${icon('download')} Download QR</button>
            <button class="btn btn-secondary" onclick="window.print()">${icon('print')} Print Card</button>
            <a href="#/patient-login" class="btn btn-outline">${icon('login')} Go to Login</a>
          </div>
        </div>`;
    } catch (err) { }
  };
}

function downloadQR() {
  const img = document.getElementById('qr-img');
  if (!img) return;
  const a = document.createElement('a'); a.href = img.src; a.download = 'health-qr-card.png'; a.click();
}

// ============================================================
// DOCTOR REGISTRATION
// ============================================================
function renderDoctorRegistration(app, verifiedEmail) {
  app.innerHTML = `${navbar()}
  <div class="page-enter container" style="padding-top:8rem;padding-bottom:4rem">
    <div class="form-container">
      <h1 style="font-size:1.75rem;margin-bottom:0.25rem">${icon('stethoscope')} Doctor Registration</h1>
      <p class="text-muted mb-4">Join our network of clinical professionals.</p>
      
      <form id="doc-reg-form">
        <div class="form-section">
          <div class="form-section-title"><div class="icon">${icon('id_card')}</div> Professional Details</div>
          
          <div class="photo-upload">
            <div class="photo-preview" id="doc-photo-preview">${icon('add_a_photo')}</div>
            <div>
              <label class="btn btn-outline btn-sm" for="doc-photo-input">${icon('upload')} Profile Photo</label>
              <input type="file" id="doc-photo-input" accept="image/*" hidden>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group"><label class="form-label">Full Name *</label><input class="form-input" name="name" required placeholder="Dr. Jane Smith"></div>
            <div class="form-group"><label class="form-label">Email *</label><input class="form-input" name="email" type="email" required placeholder="doctor@hospital.com" value="${verifiedEmail || ''}" ${verifiedEmail ? 'readonly style="opacity:0.7"' : ''}></div>
          </div>

          <div class="form-row">
            <div class="form-group"><label class="form-label">Specialization *</label>
              <select class="form-select" name="specialization" id="doc-spec" required onchange="document.getElementById('doc-spec-other-wrap').style.display = this.value==='Other'?'block':'none'">
                <option value="">Select Specialization</option>
                <option>General Physician</option><option>Cardiologist</option><option>Neurologist</option>
                <option>Pediatrician</option><option>Orthopedic Surgeon</option><option>Dermatologist</option>
                <option>Oncologist</option><option>Psychiatrist</option><option>ENT Specialist</option>
                <option>Ophthalmologist</option><option>Other</option>
              </select>
            </div>
            <div class="form-group"><label class="form-label">License Number *</label><input class="form-input" name="license_number" required placeholder="MCI-12345"></div>
          </div>

          <div id="doc-spec-other-wrap" style="display:none;margin-top:-0.5rem;margin-bottom:1rem">
            <label class="form-label">Custom Specialization *</label>
            <input class="form-input" id="doc-spec-other" placeholder="e.g., Radiologist, Pathologist...">
          </div>

          <div class="form-row">
            <div id="hospital-select-group" class="form-group">
              <label class="form-label">Workplace (Hospital/Clinic) *</label>
              <select class="form-select" id="doc-hospital-id" name="hospital_id" required>
                <option value="">Select Hospital</option>
              </select>
              <input type="hidden" name="hospital" id="doc-hospital-name">
            </div>
            <div class="form-group"><label class="form-label">Phone Number *</label><input class="form-input" name="phone" type="tel" required placeholder="+91 ..."></div>
          </div>
          
          <div class="form-row">
            <div class="form-group"><label class="form-label">Password *</label><input class="form-input" name="password" type="password" required minlength="6"></div>
            <div class="form-group"><label class="form-label">Experience (Years)</label><input class="form-input" name="experience_years" type="number" min="0"></div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title"><div class="icon" style="background:var(--primary-light);color:var(--primary)">${icon('verified')}</div> Verification Documents</div>
          <p class="text-muted mb-3" style="font-size:0.875rem">Please upload your valid medical degree or practice certificate (JPG or PDF).</p>
          <div class="form-group">
            <label class="form-label">Medical Certificate *</label>
            <div class="file-upload-zone" id="cert-upload-zone">
              <input type="file" id="doc-cert-input" name="certificate" accept="image/*,.pdf" required hidden>
              <label for="doc-cert-input" style="cursor:pointer;display:block;padding:1.5rem;border:2px dashed var(--outline-variant);border-radius:var(--radius-lg);text-align:center">
                <div id="cert-status">
                  <span class="material-symbols-outlined" style="font-size:2rem;color:var(--primary);margin-bottom:0.5rem">upload_file</span>
                  <p style="margin:0;font-weight:600">Click to upload certificate</p>
                  <p class="text-muted" style="margin:0.25rem 0 0;font-size:0.75rem">Maximum file size: 5MB</p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div class="form-section">
          <div class="form-section-title"><div class="icon" style="background:var(--secondary-light);color:var(--secondary)">${icon('schedule')}</div> Availability</div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Start Time</label><input class="form-input" name="available_start" type="time" value="09:00"></div>
            <div class="form-group"><label class="form-label">End Time</label><input class="form-input" name="available_end" type="time" value="17:00"></div>
          </div>
          <div class="form-group">
            <label class="form-label">Consultation Fee (&#8377;)</label>
            <input class="form-input" name="consultation_fee" type="number" step="100" value="500">
          </div>
        </div>

        <button type="submit" class="btn btn-secondary btn-lg btn-block">${icon('how_to_reg')} Complete Registration</button>
      </form>
    </div>
  </div>`;

  // Fetch hospitals
  fetch('/api/hospitals/list').then(r => r.json()).then(data => {
    const select = document.getElementById('doc-hospital-id');
    data.hospitals.forEach(h => {
      select.innerHTML += `<option value="${h.id}">${h.name} (${h.type || 'Hospital'}) - ${h.city}</option>`;
    });
    select.onchange = () => {
      const opt = select.options[select.selectedIndex];
      document.getElementById('doc-hospital-name').value = opt.text.split(' (')[0];
    };
  });

  // Photo preview
  document.getElementById('doc-photo-input').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => document.getElementById('doc-photo-preview').innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover">`;
    r.readAsDataURL(f);
  };

  document.getElementById('doc-cert-input').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const status = document.getElementById('cert-status');
    status.innerHTML = `<span class="material-symbols-outlined" style="font-size:2rem;color:var(--success);margin-bottom:0.5rem">check_circle</span>
      <p style="margin:0;font-weight:600;color:var(--success)">File Selected: ${f.name}</p>
      <p class="text-muted" style="margin:0.25rem 0 0;font-size:0.75rem">${(f.size / 1024 / 1024).toFixed(2)} MB</p>`;
  };

  document.getElementById('doc-reg-form').onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const photoFile = document.getElementById('doc-photo-input').files[0];
    const certFile = document.getElementById('doc-cert-input').files[0];
    if (photoFile) fd.set('photo', photoFile);
    if (certFile) fd.set('certificate', certFile);

    // Handle 'Other' specialization
    if (fd.get('specialization') === 'Other') {
      const custom = document.getElementById('doc-spec-other').value.trim();
      if (!custom) { showToast('Please enter your specialization', 'error'); return; }
      fd.set('specialization', custom);
    }

    try {
      const data = await fetch('/api/doctors/register', { method: 'POST', body: fd }).then(r => r.json());
      if (data.error) throw new Error(data.error);
      showToast('Doctor registration successful!', 'success');
      navigate('/doctor-login');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };
}

// ============================================================
// DEVICE TOKEN HELPERS (Login Verification)
// ============================================================
function getDeviceToken(role) { return localStorage.getItem('sarvam_device_token_' + role) || ''; }
function setDeviceToken(role, token) { if (token) localStorage.setItem('sarvam_device_token_' + role, token); }
// ============================================================
// PATIENT LOGIN (Email + Password + New-Device OTP Verification)
// ============================================================
function renderPatientLogin(app) {
  if (APP.state.patient && APP.state.patient.id) { navigate('/patient-dashboard'); return; }

  let pendingEmail = '';
  let countdownTimer = null;
  let devOtp = null;

  const showCredStep = () => {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    const card = document.getElementById('login-card-inner');
    if (!card) return;
    card.innerHTML = `
      <div style="text-align:center;margin-bottom:1.5rem">
        <div style="width:3.5rem;height:3.5rem;border-radius:50%;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:1.75rem">${icon('person')}</div>
        <h2>Patient Login</h2><p>Enter your registered email and password</p>
      </div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="login-email" type="email" placeholder="patient@example.com"></div>
      <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="login-pass" type="password" placeholder="Your password"></div>
      <div style="text-align:right;margin-top:-0.5rem;margin-bottom:1.5rem">
        <a href="#/forgot-password?from=patient" style="font-size:0.8125rem;color:var(--primary);font-weight:600">Forgot Password?</a>
      </div>
      <button class="btn btn-primary btn-block mb-2" id="login-btn">${icon('login')} Login</button>
      <p class="text-center text-muted" style="font-size:0.875rem">New patient? <a href="#/register">Register here</a></p>`;

    document.getElementById('login-btn').onclick = doLogin;
    document.getElementById('login-pass').onkeydown = e => { if (e.key === 'Enter') doLogin(); };
  };

  const showOtpStep = (email, userName, dOtp) => {
    devOtp = dOtp;
    pendingEmail = email;
    const card = document.getElementById('login-card-inner');
    if (!card) return;
    card.innerHTML = `
      <div style="text-align:center;margin-bottom:1.5rem">
        <div style="width:3.5rem;height:3.5rem;border-radius:50%;background:var(--success-light);color:var(--success);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:1.75rem">${icon('mark_email_read')}</div>
        <h2>Verify Your Identity</h2>
        <p>A 6-digit code was sent to <strong>${email}</strong></p>
      </div>

      <div class="ir-field-wrap" style="margin-bottom:1rem">
        <label class="ir-label">${icon('dialpad')} 6-Digit Verification Code</label>
        <div class="ir-otp-row" id="login-otp-row">
          ${[0, 1, 2, 3, 4, 5].map(i => `<input class="ir-otp-box" id="lotp-${i}" type="text" maxlength="1" inputmode="numeric" pattern="[0-9]">`).join('')}
        </div>
      </div>
      <div class="ir-ttl" style="margin-bottom:1rem" id="login-ttl">${icon('schedule')} Code expires in <span id="login-ttl-count">05:00</span></div>
      <button class="btn btn-primary btn-block mb-2" id="login-otp-verify-btn">${icon('verified_user')} Verify & Login</button>
      <button class="btn btn-text btn-block text-muted" id="login-back-btn" style="font-size:0.875rem">${icon('arrow_back')} Back to Login</button>`;

    // Wire up OTP inputs
    const boxes = Array.from({ length: 6 }, (_, i) => document.getElementById(`lotp-${i}`));
    boxes[0].focus();
    boxes.forEach((box, i) => {
      box.oninput = e => {
        const v = e.target.value.replace(/\D/g, ''); box.value = v;
        if (v && i < 5) boxes[i + 1].focus();
        if (boxes.every(b => b.value)) document.getElementById('login-otp-verify-btn')?.click();
      };
      box.onkeydown = e => {
        if (e.key === 'Backspace' && !box.value && i > 0) { boxes[i - 1].focus(); boxes[i - 1].value = ''; }
        if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
        if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus();
      };
      box.onpaste = e => {
        const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
        paste.split('').forEach((ch, j) => { if (boxes[j]) boxes[j].value = ch; });
        e.preventDefault();
        if (boxes.every(b => b.value)) setTimeout(() => document.getElementById('login-otp-verify-btn')?.click(), 100);
      };
    });

    // Countdown
    let remaining = 5 * 60;
    const ttlEl = document.getElementById('login-ttl-count');
    countdownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        if (ttlEl) ttlEl.textContent = '00:00 (expired)';
        const vBtn = document.getElementById('login-otp-verify-btn');
        if (vBtn) vBtn.disabled = true;
        return;
      }
      const m = String(Math.floor(remaining / 60)).padStart(2, '0');
      const s = String(remaining % 60).padStart(2, '0');
      if (ttlEl) ttlEl.textContent = `${m}:${s}`;
    }, 1000);



    document.getElementById('login-back-btn').onclick = () => {
      if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
      showCredStep();
    };

    document.getElementById('login-otp-verify-btn').onclick = async () => {
      const otp = boxes.map(b => b.value).join('');
      if (otp.length !== 6) { showToast('Enter all 6 digits', 'error'); return; }
      const btn = document.getElementById('login-otp-verify-btn');
      btn.disabled = true; btn.innerHTML = `<span class="ir-pulse-dot"></span> Verifying...`;
      try {
        const data = await api('/api/auth/login-verify-otp', { method: 'POST', body: { email: pendingEmail, role: 'patient', otp } });
        setDeviceToken('patient', data.device_token);
        APP.state.patient = data.patient;
        saveSession('uhqr_patient', data.patient);
        if (countdownTimer) clearInterval(countdownTimer);
        showToast('Login successful!', 'success');
        navigate('/patient-dashboard');
      } catch (e) {
        btn.disabled = false; btn.innerHTML = `${icon('verified_user')} Verify & Login`;
        boxes.forEach(b => { b.classList.add('ir-otp-error'); setTimeout(() => b.classList.remove('ir-otp-error'), 600); });
      }
    };
  };

  app.innerHTML = `${navbar()}
  <div class="page-enter">
    <div class="login-card">
      <div id="login-card-inner"></div>
    </div>
  </div>`;

  showCredStep();

  async function doLogin() {
    const email = document.getElementById('login-email')?.value.trim();
    const password = document.getElementById('login-pass')?.value;
    if (!email || !password) { showToast('Enter email and password', 'error'); return; }
    const btn = document.getElementById('login-btn');
    btn.disabled = true; btn.innerHTML = `<span class="ir-pulse-dot"></span> Signing in...`;
    try {
      const data = await api('/api/patients/login-password', {
        method: 'POST', body: { email, password },
        headers: { 'X-Device-Token': getDeviceToken('patient') }
      });
      if (data.requires_verification) {
        showToast(data.email_sent ? `Code sent to ${email}` : 'Dev mode: OTP shown below', data.email_sent ? 'success' : 'info');
        showOtpStep(email, data.user_name, data.dev_otp || null);
      } else {
        setDeviceToken('patient', data.device_token);
        APP.state.patient = data.patient;
        saveSession('uhqr_patient', data.patient);
        showToast('Login successful!', 'success');
        navigate('/patient-dashboard');
      }
    } catch (e) {
      btn.disabled = false; btn.innerHTML = `${icon('login')} Login`;
    }
  }
}


// ============================================================
// IDENTITY RESTORATION - Premium Forgot Password Flow
// ============================================================
function renderForgotPassword(app) {
  let step = 1;
  let email = '';
  let otp = '';
  let detectedRole = '';
  let devOtp = null;   // persisted across renders
  let countdownTimer = null;

  const roleLoginMap = {
    patient: '/patient-login',
    doctor: '/doctor-login',
    admin: '/admin-login',
    super_admin: '/super-admin-login',
    hospital_head: '/hospital-head-login'
  };

  const stepIcons = { 1: 'mail_lock', 2: 'pin', 3: 'lock_reset' };
  const stepTitles = { 1: 'Identity Restoration', 2: 'Verify OTP', 3: 'Set New Password' };
  const stepSubs = {
    1: 'Enter your registered email address to begin',
    2: `A secure code was dispatched to <strong>${email || 'your inbox'}</strong>`,
    3: 'Create a new strong password for your account'
  };

  const renderStep = () => {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }

    app.innerHTML = `${navbar()}
    <div class="page-enter" style="min-height:80vh;display:flex;align-items:center;justify-content:center;padding:2rem 1rem">
      <div class="ir-card">
        <!-- Progress bar -->
        <div class="ir-progress">
          ${[1, 2, 3].map(s => `<div class="ir-step ${s < step ? 'done' : s === step ? 'active' : ''}">
            <div class="ir-step-dot">${s < step ? icon('check') : s}</div>
            <span>${s === 1 ? 'Email' : s === 2 ? 'Verify' : 'Reset'}</span>
          </div>`).join('<div class="ir-step-line"></div>')}
        </div>

        <!-- Icon + header -->
        <div class="ir-header">
          <div class="ir-icon-wrap">
            <span class="material-symbols-outlined ir-icon">${stepIcons[step]}</span>
            <div class="ir-icon-ring"></div>
          </div>
          <h2 class="ir-title">${stepTitles[step]}</h2>
          <p class="ir-sub">${stepSubs[step]}</p>
        </div>

        <!-- Step bodies -->
        ${step === 1 ? `
        <div class="ir-body" id="ir-body">
          <div class="ir-field-wrap">
            <label class="ir-label">${icon('alternate_email')} Email Address</label>
            <input class="ir-input" id="fp-email" type="email" placeholder="name@example.com" value="${email}" autocomplete="email" spellcheck="false">
            <div class="ir-input-glow"></div>
          </div>
          <button class="ir-btn ir-btn-primary" id="fp-send-btn">
            ${icon('send')} Send Recovery Code
          </button>
          <p class="ir-hint">${icon('shield')} Code expires in <strong>3 minutes</strong> after dispatch</p>
        </div>
        ` : step === 2 ? `
        <div class="ir-body" id="ir-body">

          <div class="ir-field-wrap">
            <label class="ir-label">${icon('dialpad')} 6-Digit Code</label>
            <div class="ir-otp-row" id="otp-row">
              ${[0, 1, 2, 3, 4, 5].map(i => `<input class="ir-otp-box" id="otp-${i}" type="text" maxlength="1" inputmode="numeric" pattern="[0-9]" autocomplete="one-time-code">`).join('')}
            </div>
          </div>
          <div class="ir-ttl" id="ir-ttl">[Time] Code expires in <span id="ttl-count">03:00</span></div>
          <button class="ir-btn ir-btn-primary" id="fp-verify-btn">
            ${icon('verified_user')} Verify & Continue
          </button>
          <button class="ir-btn ir-btn-ghost" id="fp-resend-btn">
            ${icon('refresh')} Resend OTP
          </button>
        </div>
        ` : `
        <div class="ir-body" id="ir-body">
          <div class="ir-field-wrap">
            <label class="ir-label">${icon('lock')} New Password</label>
            <input class="ir-input" id="fp-pass" type="password" placeholder="Min. 6 characters">
            <div class="ir-strength-bar" id="strength-bar"><div id="strength-fill"></div></div>
          </div>
          <div class="ir-field-wrap">
            <label class="ir-label">${icon('lock_clock')} Confirm Password</label>
            <input class="ir-input" id="fp-pass-conf" type="password" placeholder="Repeat your new password">
          </div>
          <button class="ir-btn ir-btn-primary" id="fp-reset-btn">
            ${icon('lock_open')} Restore Identity
          </button>
        </div>
        `}

        <div style="text-align:center;margin-top:1.5rem">
          <button class="btn btn-text text-muted" id="fp-back-btn" style="font-size:0.8125rem">
            ${icon('arrow_back')} Back to Login
          </button>
        </div>
      </div>
    </div>`;

    document.getElementById('fp-back-btn').onclick = () => {
      const from = getRoute().params.from;
      navigate(roleLoginMap[from] || '/patient-login');
    };

    // -- Step 1: Send OTP -------------------------------------
    if (step === 1) {
      const emailInput = document.getElementById('fp-email');
      const sendBtn = document.getElementById('fp-send-btn');

      // Glow on valid email
      emailInput.oninput = () => {
        const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value);
        emailInput.classList.toggle('ir-input-valid', valid);
      };
      emailInput.focus();

      sendBtn.onclick = async () => {
        email = emailInput.value.trim();
        if (!email) return showToast('Enter your email address', 'error');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('Enter a valid email', 'error');

        // Pulse loading state
        sendBtn.disabled = true;
        sendBtn.innerHTML = `<span class="ir-pulse-dot"></span> Dispatching...`;

        try {
          const data = await api('/api/auth/password-reset/request', { method: 'POST', body: { email } });
          detectedRole = data.role || 'patient';

          if (data.email_sent) {
            devOtp = null;
            showToast(`${icon('mail')} OTP dispatched to your inbox`, 'success');
          } else if (data.dev_otp) {
            devOtp = data.dev_otp;  // persist for the step-2 banner
            showToast('SMTP not configured - dev OTP shown below', 'info');
          } else {
            showToast('OTP sent - check server logs', 'info');
          }

          step = 2;
          stepSubs[2] = `A secure code was dispatched to <strong>${email}</strong>`;
          renderStep();

          // Auto-fill dev OTP into boxes after render
          if (devOtp) {
            const boxes = Array.from({ length: 6 }, (_, i) => document.getElementById(`otp-${i}`));
            devOtp.split('').forEach((ch, i) => { if (boxes[i]) boxes[i].value = ch; });
          }
        } catch (e) {
          sendBtn.disabled = false;
          sendBtn.innerHTML = `${icon('send')} Send Recovery Code`;
        }
      };

      emailInput.onkeydown = e => { if (e.key === 'Enter') sendBtn.click(); };
    }

    // -- Step 2: Verify OTP -----------------------------------
    if (step === 2) {
      // Segmented OTP inputs
      const boxes = Array.from({ length: 6 }, (_, i) => document.getElementById(`otp-${i}`));
      boxes[0].focus();

      boxes.forEach((box, i) => {
        box.oninput = e => {
          const v = e.target.value.replace(/\D/g, '');
          box.value = v;
          if (v && i < 5) boxes[i + 1].focus();
          if (boxes.every(b => b.value)) document.getElementById('fp-verify-btn')?.click();
        };
        box.onkeydown = e => {
          if (e.key === 'Backspace' && !box.value && i > 0) { boxes[i - 1].focus(); boxes[i - 1].value = ''; }
          if (e.key === 'ArrowLeft' && i > 0) boxes[i - 1].focus();
          if (e.key === 'ArrowRight' && i < 5) boxes[i + 1].focus();
        };
        box.onpaste = e => {
          const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
          paste.split('').forEach((ch, j) => { if (boxes[j]) boxes[j].value = ch; });
          const nextEmpty = boxes.findIndex(b => !b.value);
          (nextEmpty >= 0 ? boxes[nextEmpty] : boxes[5]).focus();
          e.preventDefault();
        };
      });

      // 3-minute countdown
      let remaining = 3 * 60;
      const ttlEl = document.getElementById('ttl-count');
      countdownTimer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
          clearInterval(countdownTimer);
          if (ttlEl) ttlEl.textContent = '00:00 (expired)';
          document.getElementById('fp-verify-btn').disabled = true;
          return;
        }
        const m = String(Math.floor(remaining / 60)).padStart(2, '0');
        const s = String(remaining % 60).padStart(2, '0');
        if (ttlEl) ttlEl.textContent = `${m}:${s}`;
      }, 1000);

      document.getElementById('fp-verify-btn').onclick = async () => {
        otp = boxes.map(b => b.value).join('');
        if (otp.length !== 6) { boxes[0].focus(); return showToast('Enter all 6 digits', 'error'); }

        const verifyBtn = document.getElementById('fp-verify-btn');
        verifyBtn.disabled = true;
        verifyBtn.innerHTML = `<span class="ir-pulse-dot"></span> Verifying...`;

        try {
          const data = await api('/api/auth/password-reset/verify', { method: 'POST', body: { email, otp } });
          detectedRole = data.role || detectedRole;
          clearInterval(countdownTimer);
          step = 3;
          renderStep();
        } catch (e) {
          verifyBtn.disabled = false;
          verifyBtn.innerHTML = `${icon('verified_user')} Verify & Continue`;
          boxes.forEach(b => b.classList.add('ir-otp-error'));
          setTimeout(() => boxes.forEach(b => b.classList.remove('ir-otp-error')), 600);
        }
      };

      document.getElementById('fp-resend-btn').onclick = async () => {
        const resendBtn = document.getElementById('fp-resend-btn');
        resendBtn.disabled = true;
        resendBtn.innerHTML = `<span class="ir-pulse-dot"></span> Resending...`;
        try {
          const data = await api('/api/auth/password-reset/request', { method: 'POST', body: { email } });
          if (data.dev_otp) {
            devOtp = data.dev_otp;
            showToast('New code generated', 'info');
          } else {
            devOtp = null;
            showToast('New code dispatched!', 'success');
          }
          step = 2; renderStep();
          // Auto-fill new dev OTP
          if (devOtp) {
            const boxes = Array.from({ length: 6 }, (_, i) => document.getElementById(`otp-${i}`));
            devOtp.split('').forEach((ch, i) => { if (boxes[i]) boxes[i].value = ch; });
          }
        } catch (e) {
          resendBtn.disabled = false;
          resendBtn.innerHTML = `${icon('refresh')} Resend OTP`;
        }
      };
    }

    // -- Step 3: Reset Password -------------------------------
    if (step === 3) {
      const passInput = document.getElementById('fp-pass');
      const strengthFill = document.getElementById('strength-fill');

      passInput.oninput = () => {
        const v = passInput.value;
        let score = 0;
        if (v.length >= 6) score++;
        if (v.length >= 10) score++;
        if (/[A-Z]/.test(v)) score++;
        if (/[0-9]/.test(v)) score++;
        if (/[^A-Za-z0-9]/.test(v)) score++;
        const pct = (score / 5) * 100;
        strengthFill.style.width = `${pct}%`;
        strengthFill.style.background = score <= 2 ? '#ef4444' : score <= 3 ? '#f59e0b' : '#22c55e';
      };

      document.getElementById('fp-reset-btn').onclick = async () => {
        const newPassword = document.getElementById('fp-pass').value;
        const conf = document.getElementById('fp-pass-conf').value;
        if (!newPassword || newPassword.length < 6) return showToast('Password must be at least 6 characters', 'error');
        if (newPassword !== conf) return showToast('Passwords do not match', 'error');

        const resetBtn = document.getElementById('fp-reset-btn');
        resetBtn.disabled = true;
        resetBtn.innerHTML = `<span class="ir-pulse-dot"></span> Restoring...`;

        try {
          await api('/api/auth/password-reset/update', { method: 'POST', body: { email, otp, newPassword } });
          showToast(`${icon('check_circle')} Password restored! Please login.`, 'success');
          const loginRoute = roleLoginMap[detectedRole] || '/patient-login';
          setTimeout(() => navigate(loginRoute), 1200);
        } catch (e) {
          resetBtn.disabled = false;
          resetBtn.innerHTML = `${icon('lock_open')} Restore Identity`;
        }
      };
    }
  };

  renderStep();
}




// ============================================================
// PATIENT DASHBOARD - Tab-based layout matching reference
// ============================================================
function renderPatientDashboard(app) {
  const p = APP.state.patient;
  if (!p) { navigate('/patient-login'); return; }
  const mh = p.medical_history || {};
  const ec = (p.emergency_contacts || [])[0] || {};
  const ins = p.insurance || {};

  app.innerHTML = `${navbar()}
  <div class="page-enter container" style="padding:8rem 0 3rem">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem">
      <div><h1 style="font-size:1.75rem">Patient Dashboard</h1><p class="text-muted">Manage your health profile and QR card</p></div>
      <button data-action="logout" data-target="/" data-role="patient" class="btn btn-outline btn-sm">${icon('logout')} Logout</button>

    </div>

    <!-- Hero QR Card -->
    <div class="dash-hero-card">
      <div class="dash-hero-qr">
        <div class="qr-card-mini">
          <img src="${p.qr_code_url}" alt="QR" class="qr-mini-img">
          <p class="qr-mini-id">${p.id}</p>
          <p class="qr-mini-name">${p.name}</p>
          <div style="display:flex;gap:0.375rem;justify-content:center;margin-top:0.75rem;flex-wrap:wrap">
            <button class="btn btn-outline btn-sm" onclick="downloadQRDash()">${icon('download')} Download</button>
            <button class="btn btn-outline btn-sm" onclick="shareQR()">${icon('share')} Share</button>
          </div>
        </div>
      </div>
      <div class="dash-hero-info">
        <p style="display:flex;align-items:center;gap:0.5rem;font-size:0.875rem;opacity:0.9">${icon('qr_code_2')} Health QR Card</p>
        <h2 style="font-size:1.75rem;margin:0.5rem 0">${p.name}</h2>
        <p style="font-size:0.95rem;opacity:0.85;margin-bottom:0.75rem">UHID-${p.id}</p>
        <span class="badge" style="background:rgba(255,255,255,0.2);color:#fff;font-size:0.95rem;padding:0.4rem 1rem">${icon('bloodtype')} ${p.blood_group}</span>
      </div>
    </div>

    <!-- Tab Navigation -->
    <div class="dash-tabs" id="dash-tabs">
      <button class="dash-tab active" data-tab="profile">${icon('person')} Profile</button>
      <button class="dash-tab" data-tab="appointments">${icon('calendar_month')} Appointments</button>
      <button class="dash-tab" data-tab="medical">${icon('vital_signs')} Medical</button>
      <button class="dash-tab" data-tab="emergency">${icon('contact_phone')} Emergency</button>
      <button class="dash-tab" data-tab="insurance">${icon('shield')} Insurance</button>
      <button class="dash-tab" data-tab="reports">${icon('science')} Health Reports</button>
      <button class="dash-tab" data-tab="visits">${icon('history')} Doctor Visits</button>
      <button class="dash-tab" data-tab="ai">${icon('smart_toy')} AI Assistant</button>
    </div>

    <!-- Tab Content -->
    <div id="dash-tab-content"></div>
  </div>`;

  const showTab = tabId => {
    document.querySelectorAll('.dash-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    const c = document.getElementById('dash-tab-content');
    if (tabId === 'profile') c.innerHTML = tabProfile(p);
    else if (tabId === 'appointments') { c.innerHTML = tabAppointments(); autoDetectCityThenLoadDoctors(); }
    else if (tabId === 'medical') { c.innerHTML = '<div class="spinner"></div>'; loadMedicalTab(p, c); }
    else if (tabId === 'emergency') c.innerHTML = tabEmergency(ec);
    else if (tabId === 'insurance') c.innerHTML = tabInsurance(ins, p);
    else if (tabId === 'reports') { c.innerHTML = tabHealthReports(p); loadHealthReports(); }
    else if (tabId === 'visits') { c.innerHTML = '<div class="spinner"></div>'; loadVisitHistory(p); }
    else if (tabId === 'ai') { c.innerHTML = tabAI(); initAIChat(); }
    bindSaveHandlers();
  };

  document.querySelectorAll('.dash-tab').forEach(btn => { btn.onclick = () => showTab(btn.dataset.tab); });
  showTab('profile');
}

function downloadQRDash() {
  const p = APP.state.patient;
  if (!p || !p.qr_code_url) return;
  const a = document.createElement('a'); a.href = p.qr_code_url; a.download = 'health-qr-card.png'; a.click();
}
function shareQR() {
  const p = APP.state.patient;
  if (navigator.share) {
    navigator.share({ title: 'My Health QR', text: `UHID: ${p.id}`, url: window.location.origin + `/#/patient/${p.id}` });
  } else {
    navigator.clipboard.writeText(window.location.origin + `/#/patient/${p.id}`);
    showToast('Link copied to clipboard!', 'success');
  }
}

async function loadVisitHistory(p) {
  const c = document.getElementById('dash-tab-content');
  if (!c) return;
  try {
    const data = await api(`/api/patients/${p.id}/visit-history`);
    const visits = data.visits || [];

    const layerIcon = l => {
      if (l && l.includes('Emergency')) return icon('emergency');
      if (l && l.includes('Clinical')) return icon('clinical_notes');
      return icon('visibility');
    };
    const layerColor = l => {
      if (l && l.includes('Emergency')) return 'var(--tertiary)';
      if (l && l.includes('Clinical')) return 'var(--primary)';
      return 'var(--outline)';
    };
    const formatTime = ts => {
      if (!ts) return '';
      const d = new Date(ts);
      return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    c.innerHTML = `
    <div class="card" style="padding:2rem">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem">
        <h3 style="display:flex;align-items:center;gap:0.5rem;margin:0">${icon('history')} Doctor Visit History</h3>
        <span style="font-size:0.8125rem;color:var(--outline);background:var(--surface-variant);padding:0.25rem 0.75rem;border-radius:99px">${visits.length} visit${visits.length !== 1 ? 's' : ''} recorded</span>
      </div>
      ${visits.length === 0 ? `
      <div style="text-align:center;padding:3rem 1rem;color:var(--outline)">
        <span class="material-symbols-outlined" style="font-size:3rem">history_toggle_off</span>
        <p style="margin-top:0.75rem;font-size:0.9375rem">No doctor visits recorded yet.</p>
        <p style="font-size:0.8125rem">When a doctor scans your QR code, it will appear here.</p>
      </div>` : `
      <div style="display:flex;flex-direction:column;gap:0.875rem">
        ${visits.map(v => `
        <div style="display:flex;align-items:flex-start;gap:1rem;padding:1rem 1.25rem;border-radius:0.875rem;background:var(--surface-container-low);border-left:3px solid ${layerColor(v.layer_accessed)};">
          <div style="width:2.5rem;height:2.5rem;border-radius:50%;background:var(--surface-container-high);color:${layerColor(v.layer_accessed)};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            ${layerIcon(v.layer_accessed)}
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem">
              <strong style="font-size:0.9375rem">Dr. ${v.accessor_name || 'Unknown'}</strong>
              <span style="font-size:0.75rem;color:var(--outline)">${formatTime(v.timestamp)}</span>
            </div>
            <div style="margin-top:0.25rem;display:flex;flex-wrap:wrap;gap:0.5rem;align-items:center">
              ${v.specialization ? `<span style="font-size:0.8125rem;background:var(--surface-container);padding:0.125rem 0.625rem;border-radius:99px;color:var(--on-surface-variant)">${v.specialization}</span>` : ''}
              ${v.hospital ? `<span style="font-size:0.8125rem;color:var(--on-surface-variant)">${icon('local_hospital')} ${v.hospital}</span>` : ''}
            </div>
            <div style="margin-top:0.375rem;font-size:0.8125rem;color:${layerColor(v.layer_accessed)};display:flex;align-items:center;gap:0.25rem">
              ${layerIcon(v.layer_accessed)} ${v.layer_accessed || 'Emergency Access'} - ${v.purpose || 'QR Scan'}
            </div>
          </div>
        </div>`).join('')}
      </div>`}
    </div>`;
  } catch (e) {
    c.innerHTML = `<div class="card" style="padding:2rem;text-align:center"><p class="text-muted">Could not load visit history.</p></div>`;
  }
}

function tabProfile(p) {
  return `<div class="card" style="padding:2rem">
    <div class="photo-upload-section" style="display:flex;align-items:center;gap:2rem;margin-bottom:2.5rem;padding-bottom:2rem;border-bottom:1px solid var(--surface-container-high)">
      <div class="photo-preview-wrapper" style="position:relative">
        <div id="pf-photo-preview" class="photo-preview" style="width:120px;height:120px;border-radius:50%;background:var(--surface-container-high);display:flex;align-items:center;justify-content:center;overflow:hidden;border:4px solid #fff;box-shadow:var(--shadow-md)">
          ${p.photo ? `<img src="${p.photo}" style="width:100%;height:100%;object-fit:cover">` : icon('person', 'style="font-size:4rem;color:var(--outline)"')}
        </div>
        <label for="pf-photo-input" style="position:absolute;bottom:0;right:0;width:36px;height:36px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;border:3px solid #fff;box-shadow:var(--shadow-sm)">
          ${icon('photo_camera', 'style="font-size:1.25rem"')}
        </label>
        <input type="file" id="pf-photo-input" accept="image/*" hidden>
      </div>
      <div>
        <h3 style="margin:0 0 0.5rem">Profile Photo</h3>
        <p class="text-muted" style="font-size:0.875rem;max-width:300px">Add a photo to help doctors identify you easily in case of emergencies.</p>
        <label for="pf-photo-input" class="btn btn-outline btn-sm" style="margin-top:0.75rem;cursor:pointer">Change Photo</label>
      </div>
    </div>

    <h3 style="margin-bottom:1.5rem;display:flex;align-items:center;gap:0.5rem">${icon('person')} Personal Information</h3>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Full Name *</label><input class="form-input" id="pf-name" value="${p.name || ''}"></div>
      <div class="form-group"><label class="form-label">Date of Birth</label><input class="form-input" id="pf-dob" type="date" value="${p.dob || ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Gender</label>
        <select class="form-select" id="pf-gender"><option value="">Select</option>${['Male', 'Female', 'Other'].map(g => `<option ${p.gender === g ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Phone Number *</label><input class="form-input" id="pf-phone" value="${p.phone || ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="pf-email" value="${p.email || ''}"></div>
      <div class="form-group"><label class="form-label">Blood Group *</label>
        <select class="form-select" id="pf-blood">${['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => `<option ${p.blood_group === b ? 'selected' : ''}>${b}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label class="form-label">Address</label><input class="form-input" id="pf-address" value="${p.address || ''}"></div>
    <button class="btn btn-primary mt-2" id="save-profile-btn">${icon('save')} Save Changes</button>
  </div>`;
}

async function loadMedicalTab(p, c) {
  try {
    const data = await api(`/api/patients/${p.id}/clinical?accessor_id=${p.id}&accessor_name=${encodeURIComponent(p.name)}&accessor_type=patient`);
    const mh = {
      allergies: data.allergies || [],
      chronic_conditions: data.chronic_conditions || [],
      immunization_status: data.immunization_status,
      organ_donor_status: data.organ_donor_status
    };
    // Update local session so other tabs stay in sync
    if (APP.state.patient) {
      APP.state.patient.medical_history = mh;
      saveSession('uhqr_patient', APP.state.patient);
    }
    c.innerHTML = `
    <div class="card mb-3" style="padding:2rem">
      <h3 style="margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem">${icon('warning', 'text-tertiary')} Allergies</h3>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem">${mh.allergies.length ? mh.allergies.map(a => `<span class="badge badge-allergy">${icon('report')} ${a}</span>`).join('') : '<p class="text-muted" style="font-style:italic">No allergies added</p>'}</div>
    </div>
    <div class="card mb-3" style="padding:2rem">
      <h3 style="margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem">${icon('vital_signs')} Chronic Conditions</h3>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem">${mh.chronic_conditions.length ? mh.chronic_conditions.map(c => `<span class="badge badge-condition">${c}</span>`).join('') : '<p class="text-muted" style="font-style:italic">No conditions added</p>'}</div>
    </div>
    <div class="card" style="padding:2rem">
      <h3 style="margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem">${icon('vaccines')} Immunizations</h3>
      <span class="badge ${mh.immunization_status === 'Up to Date' ? 'badge-success' : 'badge-info'}">${mh.immunization_status || 'No immunizations added'}</span>
      <p class="text-muted mt-2" style="font-size:0.875rem">Organ donor: ${mh.organ_donor_status || 'No'}</p>
    </div>`;
  } catch (e) {
    c.innerHTML = '<div class="card" style="padding:2rem"><p class="text-muted">Could not load medical data.</p></div>';
  }
}

function tabEmergency(ec) {
  return `<div class="card" style="padding:2rem">
    <h3 style="margin-bottom:1.5rem;display:flex;align-items:center;gap:0.5rem">${icon('contact_phone')} Emergency Contact</h3>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Contact Name</label><input class="form-input" id="ec-name" value="${ec.name || ''}"></div>
      <div class="form-group"><label class="form-label">Relationship</label>
        <select class="form-select" id="ec-rel">${['Spouse', 'Parent', 'Sibling', 'Child', 'Friend', 'Other'].map(r => `<option ${ec.relationship === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
    </div>
    <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="ec-phone" value="${ec.phone || ''}"></div>
    <button class="btn btn-primary mt-2" id="save-emergency-btn">${icon('save')} Save Emergency Contact</button>
  </div>`;
}

function tabPrescriptions(rxs) {
  return `<h3 style="margin-bottom:1rem">${icon('medication')} Prescription History</h3>
    ${rxs.length ? rxs.map(rx => `<div class="prescription-card">
      <div class="prescription-header"><div><h4>${rx.doctor_name || 'Doctor'}</h4><p class="text-muted" style="font-size:0.8125rem">${rx.hospital || ''}</p></div>
      <span class="badge badge-info">${fmtDate(rx.date)}</span></div>
      <ul class="medication-list">${(rx.medications || []).map(m => `<li>${m.name || m} ${m.dosage ? '- ' + m.dosage : ''} ${m.frequency ? '(' + m.frequency + ')' : ''}</li>`).join('')}</ul>
      ${rx.notes ? `<p class="text-muted mt-2" style="font-size:0.875rem">${icon('notes')} ${rx.notes}</p>` : ''}
      ${rx.lab_report ? `<a href="${rx.lab_report}" download class="btn btn-outline btn-sm mt-2">${icon('lab_profile')} Lab Report</a>` : ''}
    </div>`).join('') : '<div class="card text-center" style="padding:3rem"><p class="text-muted">No prescriptions yet</p></div>'}`;
}

function tabInsurance(ins, p) {
  return `<div class="card mb-3" style="padding:2rem">
    <h3 style="margin-bottom:1.5rem;display:flex;align-items:center;gap:0.5rem">${icon('shield')} Insurance & Government ID</h3>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Insurance Provider</label><input class="form-input" id="ins-provider" value="${ins.provider || ''}" placeholder="e.g., Star Health"></div>
      <div class="form-group"><label class="form-label">Policy Number</label><input class="form-input" id="ins-policy" value="${ins.policy_number || ''}" placeholder="Policy number"></div>
    </div>
  </div>
  <div class="card" style="padding:2rem;background:var(--warning-light);border-radius:var(--radius-xl)">
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem">
      <div style="width:2.5rem;height:2.5rem;border-radius:var(--radius-md);background:var(--warning);color:#fff;display:flex;align-items:center;justify-content:center">${icon('shield')}</div>
      <div><strong>ABHA Integration</strong><p class="text-muted" style="font-size:0.8125rem">Ayushman Bharat Health Account</p></div>
    </div>
    <div class="form-group"><label class="form-label">ABHA ID</label><input class="form-input" id="ins-abha" value="${ins.abha_id || p.abha_id || ''}" placeholder="XX-XXXX-XXXX-XXXX" style="background:#fff"></div>
    <button class="btn btn-primary mt-2" id="save-insurance-btn">${icon('save')} Save Insurance</button>
  </div>`;
}

function tabAI() {
  return `<div class="ai-chat-container">
    <div class="ai-chat-header">
      <div class="ai-chat-header-info">
        <div class="ai-avatar">${icon('smart_toy')}</div>
        <div><h3>Universal Health AI</h3><span class="ai-status">${icon('circle')} Online</span></div>
      </div>
    </div>
    <div class="ai-chat-disclaimer">
      ${icon('info')} I am an AI assistant. Consult a doctor for medical advice.
    </div>
    <div class="ai-chat-messages" id="ai-messages">
      <div class="ai-message bot">
        <div class="ai-message-avatar">${icon('smart_toy')}</div>
        <div class="ai-message-content">
          <p>Hello! I'm the Universal Health AI Assistant. I can explain medical terms, help you understand your reports, or provide general wellness tips.</p>
        </div>
      </div>
    </div>
    <div class="ai-quick-actions">
      <button class="ai-quick-btn" onclick="sendAI('Help me understand my immunizations')">${icon('vaccines')} Immunizations</button>
      <button class="ai-quick-btn" onclick="sendAI('Tips for my chronic conditions')">${icon('vital_signs')} Conditions</button>
      <button class="ai-quick-btn" onclick="sendAI('Provide a healthy diet plan')">${icon('restaurant')} Diet Tips</button>
    </div>
    <div class="ai-chat-input-area">
      <div class="ai-input-row">
        <input type="text" class="ai-input" id="ai-input" placeholder="Type your health question...">
        <button class="ai-send-btn" id="ai-send-btn">${icon('send')}</button>
      </div>
    </div>
  </div>`;
}

let aiChatHistory = [];

function initAIChat() {
  const btn = document.getElementById('ai-send-btn');
  const input = document.getElementById('ai-input');

  if (!btn || !input) return;

  window.sendAI = async (text) => {
    const msg = text || input.value.trim();
    if (!msg) return;
    input.value = '';

    const messagesDiv = document.getElementById('ai-messages');
    messagesDiv.innerHTML += `<div class="ai-message user"><div class="ai-message-content"><p>${msg.replace(/</g, '&lt;')}</p></div></div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    const typingId = 'typing-' + Date.now();
    messagesDiv.innerHTML += `<div class="ai-message bot" id="${typingId}">
      <div class="ai-message-avatar">${icon('smart_toy')}</div>
      <div class="ai-message-content ai-typing-indicator">
        <div class="typing-dots"><span></span><span></span><span></span></div>
      </div>
    </div>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    aiChatHistory.push({ role: 'user', content: msg });

    try {
      const res = await api('/api/ai/chat', {
        method: 'POST',
        body: { messages: aiChatHistory, userId: APP.state.patient.id, role: 'patient' }
      });
      document.getElementById(typingId)?.remove();

      let botMsg = res.message.content.replace(/\n/g, '<br>');
      botMsg = botMsg.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>'); // Bold rendering

      aiChatHistory.push(res.message);

      messagesDiv.innerHTML += `<div class="ai-message bot">
        <div class="ai-message-avatar">${icon('smart_toy')}</div>
        <div class="ai-message-content"><p>${botMsg}</p></div>
      </div>`;
      messagesDiv.scrollTop = messagesDiv.scrollHeight;

    } catch (err) {
      document.getElementById(typingId)?.remove();
      messagesDiv.innerHTML += `<div class="ai-message bot">
        <div class="ai-message-avatar" style="background:var(--danger)">${icon('error')}</div>
        <div class="ai-message-content" style="background:#ffebee;color:#c62828">
          <p>Connection error. Note: AI config might be missing. Ensure OPENAI_API_KEY is active in .env</p>
        </div>
      </div>`;
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
  };

  btn.onclick = () => window.sendAI();
  input.onkeypress = (e) => { if (e.key === 'Enter') window.sendAI(); };
}

function tabSecurity(logs) {
  return `<h3 style="margin-bottom:1rem">${icon('verified_user')} Access & Audit Log</h3>
    <div class="card">${logs.length ? logs.map(l => `<div class="log-entry">
      <div class="log-icon ${l.accessor_type || 'doctor'}">${icon(l.accessor_type === 'admin' ? 'admin_panel_settings' : 'stethoscope')}</div>
      <div class="log-details"><h4>${l.accessor_name || 'Unknown'} accessed ${l.layer_accessed || 'records'}</h4><p>${l.purpose || ''}</p></div>
      <span class="log-time">${fmtDate(l.timestamp)}</span>
    </div>`).join('') : '<p class="text-muted text-center" style="padding:2rem">No access logs yet</p>'}</div>`;
}

function bindSaveHandlers() {
  const p = APP.state.patient;
  let currentPhotoBase64 = p.photo;

  // Photo change logic
  const photoInput = document.getElementById('pf-photo-input');
  if (photoInput) photoInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (re) => {
        currentPhotoBase64 = re.target.result;
        const preview = document.getElementById('pf-photo-preview');
        preview.innerHTML = `<img src="${currentPhotoBase64}" style="width:100%;height:100%;object-fit:cover">`;
      };
      reader.readAsDataURL(file);
    }
  };

  const profileBtn = document.getElementById('save-profile-btn');
  if (profileBtn) profileBtn.onclick = async () => {
    const body = {
      name: document.getElementById('pf-name').value, dob: document.getElementById('pf-dob').value,
      phone: document.getElementById('pf-phone').value, blood_group: document.getElementById('pf-blood').value,
      gender: document.getElementById('pf-gender').value, address: document.getElementById('pf-address').value,
      email: document.getElementById('pf-email').value,
      photo: currentPhotoBase64,
      allergies: p.medical_history?.allergies || [], chronic_conditions: p.medical_history?.chronic_conditions || [],
      immunization_status: p.medical_history?.immunization_status, organ_donor_status: p.medical_history?.organ_donor_status
    };
    try {
      await api(`/api/patients/${p.id}`, { method: 'PUT', body });
      Object.assign(p, { name: body.name, dob: body.dob, phone: body.phone, blood_group: body.blood_group, gender: body.gender, address: body.address, email: body.email, photo: body.photo });
      saveSession('uhqr_patient', p);
      showToast('Profile updated!', 'success');
    } catch (e) { }
  };

  const emergencyBtn = document.getElementById('save-emergency-btn');
  if (emergencyBtn) emergencyBtn.onclick = async () => {
    const p = APP.state.patient;
    try {
      await api(`/api/patients/${p.id}`, {
        method: 'PUT', body: {
          name: p.name, dob: p.dob, phone: p.phone, blood_group: p.blood_group, gender: p.gender, address: p.address, email: p.email,
          allergies: p.medical_history?.allergies || [], chronic_conditions: p.medical_history?.chronic_conditions || [],
          emergency_contact_name: document.getElementById('ec-name').value,
          emergency_contact_relationship: document.getElementById('ec-rel').value,
          emergency_contact_phone: document.getElementById('ec-phone').value
        }
      });
      p.emergency_contacts = [{ name: document.getElementById('ec-name').value, relationship: document.getElementById('ec-rel').value, phone: document.getElementById('ec-phone').value }];
      saveSession('uhqr_patient', p);
      showToast('Emergency contact saved!', 'success');
    } catch (e) { }
  };

  const insuranceBtn = document.getElementById('save-insurance-btn');
  if (insuranceBtn) insuranceBtn.onclick = async () => {
    const p = APP.state.patient;
    try {
      await api(`/api/patients/${p.id}`, {
        method: 'PUT', body: {
          name: p.name, dob: p.dob, phone: p.phone, blood_group: p.blood_group, gender: p.gender, address: p.address, email: p.email,
          allergies: p.medical_history?.allergies || [], chronic_conditions: p.medical_history?.chronic_conditions || [],
          insurance_provider: document.getElementById('ins-provider').value,
          policy_number: document.getElementById('ins-policy').value,
          abha_id: document.getElementById('ins-abha').value
        }
      });
      p.insurance = { provider: document.getElementById('ins-provider').value, policy_number: document.getElementById('ins-policy').value, abha_id: document.getElementById('ins-abha').value };
      saveSession('uhqr_patient', p);
      showToast('Insurance saved!', 'success');
    } catch (e) { }
  };
}

// ============================================================
// APPOINTMENTS TAB - Find Hospitals & Book Appointment
// ============================================================
function tabAppointments() {
  return `
  <div class="card mb-3" style="padding:1.75rem 2rem">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1.25rem">
      <div>
        <h3 style="margin:0;display:flex;align-items:center;gap:0.5rem;font-size:1.1rem">${icon('local_hospital')} Hospital Discovery</h3>
        <p style="margin:0.25rem 0 0;font-size:0.8125rem;color:var(--on-surface-variant)">Find hospitals in your city, sorted by proximity</p>
      </div>
      <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
        <div id="prox-city-badge-wrap"></div>
        <div class="prox-ripple-wrap" id="prox-btn-wrap">
          <button class="prox-pulse-btn" id="prox-nearby-btn">
            <span class="prox-dot"></span>
            Nearby
          </button>
        </div>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:0.75rem;margin-bottom:1.25rem;align-items:center">
      <input class="form-input" id="prox-search-input" placeholder="Search hospital by name or city\u2026" style="flex:1;min-width:200px;max-width:420px">
      <button class="btn btn-outline btn-sm" id="prox-reset-btn" style="display:none">${icon('refresh')} Show All</button>
    </div>
    <div id="prox-status-bar" style="margin-bottom:0.75rem"></div>
    <div id="hospitals-list-wrap">
      <div class="spinner" style="margin:2rem auto"></div>
    </div>
  </div>

  <div class="card mb-3" style="padding:1.75rem 2rem">
    <h3 style="margin-bottom:1.25rem;display:flex;align-items:center;gap:0.5rem;font-size:1.05rem">${icon('stethoscope')} Find a Doctor &amp; Book Appointment</h3>
    <div style="display:flex;flex-wrap:wrap;gap:0.75rem;margin-bottom:1.25rem">
      <input class="form-input" id="doctor-search" placeholder="Search by doctor, specialization\u2026" style="flex:1;min-width:200px">
      <button class="btn btn-outline" id="nearby-btn" style="white-space:nowrap">${icon('my_location')} My Location</button>
    </div>
    <div id="loc-hint" style="font-size:0.75rem;color:var(--outline);margin-top:-0.75rem;margin-bottom:1.25rem;display:none;align-items:center;gap:0.35rem;background:rgba(var(--primary-rgb),0.1);padding:0.75rem;border-radius:12px;border:1px solid rgba(var(--primary-rgb),0.2)">
      ${icon('info', 'icon-sm')} Not in <span id="hint-city" style="font-weight:700"></span>? 
      <a href="javascript:void(0)" onclick="manualCityOverride()" style="color:var(--primary);font-weight:600;text-decoration:underline;margin-left:0.25rem">Enter City Manually</a>
    </div>
    <div id="doctors-list"><div class="spinner"></div></div>
  </div>

  <div class="card" style="padding:1.75rem 2rem">
    <h3 style="margin-bottom:1.25rem;display:flex;align-items:center;gap:0.5rem">${icon('event_note')} My Appointment Status</h3>
    <div id="patient-apt-list"><div class="spinner"></div></div>
  </div>
  <div id="booking-modal" class="hidden"></div>`;
}


async function loadPatientAppointments() {
  const p = APP.state.patient;
  if (!p) return;
  const listEl = document.getElementById('patient-apt-list');
  if (!listEl) return;
  try {
    const data = await api(`/api/appointments/${p.id}`);
    const apts = data.appointments || [];
    if (!apts.length) {
      listEl.innerHTML = '<p class="text-muted text-center" style="padding:2rem">No appointments yet.</p>';
      return;
    }
    listEl.innerHTML = apts.map(a => `
      <div class="apt-card apt-request-card" id="apt-card-${a.id}" style="border-left:4px solid ${a.status === 'confirmed' ? 'var(--success)' : a.status === 'cancelled' ? 'var(--tertiary)' : 'var(--warning)'}">
        <div class="apt-card-header">
          <div style="display:flex;align-items:center;gap:0.5rem">
            ${icon('medical_services')} <strong>Dr. ${a.doctor_name}</strong>
          </div>
          <span class="apt-status-badge ${a.status.toLowerCase()}">${a.status.charAt(0).toUpperCase() + a.status.slice(1)}</span>
        </div>
        <div class="apt-card-details">
          <span>${icon('calendar_month')} ${fmtDate(a.date)}</span>
          <span>${icon('schedule')} ${a.time_slot || '-'}</span>
        </div>
        ${a.hospital ? `<p class="text-muted" style="font-size:0.8125rem;margin-top:0.25rem">${icon('location_on')} ${a.hospital}</p>` : ''}
      </div>
    `).join('');
  } catch (e) {
    listEl.innerHTML = '<p class="text-muted text-center">Failed to load appointments.</p>';
  }
}

function initPatientSSE() {
  const p = APP.state.patient;
  if (!p || APP.state.patientSSERunning) return;
  APP.state.patientSSERunning = true;
  const ev = new EventSource(`/api/sse/patient/${p.id}`);
  ev.addEventListener('appointment_update', (e) => {
    const data = JSON.parse(e.data);
    const apt = data.appointment;
    showToast(`Appointment with Dr. ${apt.doctor_name} is now ${apt.status}!`, apt.status === 'confirmed' ? 'success' : 'info');
    loadPatientAppointments();
  });
}

let userLocation = null;
let userCity = null; // City from reverse geocode when My Location is clicked

// ============================================================
// WEIGHTLESS PROXIMITY INTELLIGENCE - Glassmorphism Hospital Discovery
// ============================================================
let proxState = {
  userLat: null, userLng: null,
  userCity: null,
  isProxMode: false
};

function proxHospBedChips(h) {
  const chips = [];
  const addChip = (label, avail, total) => {
    if (!total) return;
    const cls = avail === 0 ? 'full' : avail / total <= 0.25 ? 'low' : 'ok';
    const ico = cls === 'full' ? '\u{1F534}' : cls === 'low' ? '\u{1F7E1}' : '\u{1F7E2}';
    chips.push(`<span class="prox-bed-chip ${cls}">${ico} ${label}: ${avail}/${total}</span>`);
  };
  addChip('ICU', h.icu_available, h.icu_total);
  addChip('ER', h.emergency_available, h.emergency_total);
  addChip('General', h.general_available, h.general_total);
  return chips.length ? `<div class="prox-bed-row">${chips.join('')}</div>` : '';
}

function renderProxCard(h, idx, isFirst) {
  const distanceMetric = h.distance_km != null
    ? `<div class="spatial-offset-metric">
        ${icon('near_me', 'icon-xs')} ${h.distance_km.toFixed(2)} km
       </div>`
    : `<div class="spatial-offset-metric" style="color:var(--outline);text-shadow:none;background:rgba(0,0,0,0.05);border-color:transparent">
        ${icon('location_searching', 'icon-xs')} unknown
       </div>`;

  const typeClass = (h.type || 'Hospital').toLowerCase() === 'clinic' ? 'clinic' : 'hospital';
  const driftDelay = `${(idx * 0.06).toFixed(2)}s`;

  return `
  <div class="prox-hosp-card zero-g-crystallize ${isFirst ? 'closest' : ''}" style="--drift-delay:${driftDelay};animation-delay:${driftDelay}">
    <div class="prox-card-header">
      <div class="prox-card-icon">${icon('local_hospital')}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1.5rem">
          <div class="prox-card-name">${h.name}</div>
          ${isFirst ? '<span class="prox-nearest-tag">\u2605 Closest Resonance</span>' : ''}
        </div>
        <div class="prox-card-meta">
          <div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">
            <span>${icon('location_city', 'icon-xs')} ${h.city || 'Locked Node'}</span>
            <span class="prox-type-badge ${typeClass}">${h.type || 'Facility'}</span>
            ${distanceMetric}
          </div>
        </div>
      </div>
    </div>
    ${proxHospBedChips(h)}
    <div class="prox-card-meta" style="margin-top:0.75rem;border-top:1px solid var(--surface-container-highest);padding-top:0.75rem">
        ${icon('location_on')} <span style="font-size:0.75rem">${h.address || 'Address not listed'}</span>
    </div>
  </div>`;
}

function proxDriftAlert(city) {
  const msg = city
    ? `No hospitals found in <strong>${city}</strong>. Try a nearby city or expand your search.`
    : 'No hospitals registered yet in the system.';
  return `
  <div class="prox-drift-alert">
    <div class="prox-drift-orb">${icon('location_off')}</div>
    <div class="prox-drift-title">No hospitals found</div>
    <div class="prox-drift-sub">${msg}</div>
    ${city ? `<button class="prox-drift-pill" onclick="proxWidenSearch()">${icon('radar')} Search Wider Radius</button>` : ''}
  </div>`;
}

function proxStatusBar(count, city, isProxMode) {
  const bar = document.getElementById('prox-status-bar');
  if (!bar) return;
  if (count === 0) { bar.innerHTML = ''; return; }
  const cityBadge = city
    ? `<span class="prox-city-badge"><span class="prox-city-dot"></span>${city}</span>`
    : '';
  bar.innerHTML = `<div style="display:flex;align-items:center;gap:0.625rem;flex-wrap:wrap">
    ${cityBadge}
    <span style="font-size:0.78rem;color:var(--on-surface-variant)">${count} hospital${count !== 1 ? 's' : ''}${isProxMode ? ', sorted by proximity' : ''}</span>
  </div>`;
}

window.proxWidenSearch = () => {
  proxState.userCity = null;
  const b = document.getElementById('prox-city-badge-wrap');
  if (b) b.innerHTML = '';
  loadProxHospitals();
};

async function loadProxHospitals(opts = {}) {
  const wrap = document.getElementById('hospitals-list-wrap');
  if (!wrap) return;

  // Zero-G Evaporation of existing nodes
  const existing = wrap.firstElementChild;
  if (existing) {
    existing.classList.add('zero-g-evaporate');
    await new Promise(r => setTimeout(r, 400));
  }
  wrap.innerHTML = '<div class="spinner" style="margin:2.5rem auto"></div>';

  try {
    let url = '/api/hospitals/proximity?';
    if (proxState.userLat && proxState.userLng) {
      url += `lat=${proxState.userLat}&lng=${proxState.userLng}&`;
    }
    // ALWAYS send city if locked, regardless of GPS status (Strict City-Node Protocol)
    if (proxState.userCity && !opts.widenSearch) {
      url += `city=${encodeURIComponent(proxState.userCity)}&`;
    }
    if (opts.search) url += `search=${encodeURIComponent(opts.search)}&`;

    const data = await api(url);
    const hospitals = data.hospitals || [];
    const isProxMode = !!(proxState.userLat && proxState.userLng);

    proxStatusBar(hospitals.length, proxState.userCity, isProxMode);
    const resetBtn = document.getElementById('prox-reset-btn');
    if (resetBtn) resetBtn.style.display = (proxState.isProxMode || proxState.userCity) ? '' : 'none';

    if (!hospitals.length) {
      wrap.innerHTML = `<div class="zero-g-crystallize">${proxDriftAlert(proxState.userCity)}</div>`;
      return;
    }
    wrap.innerHTML = `<div class="prox-cards-grid zero-g-crystallize">${hospitals.map((h, i) => renderProxCard(h, i, i === 0 && isProxMode)).join('')
      }</div>`;
  } catch (e) {
    wrap.innerHTML = '<p class="text-muted text-center" style="padding:2rem">Failed to load hospitals.</p>';
  }
}

// -- City-Node Isolation: Auto-detect city via IP, then load doctors --
window.manualCityOverride = (cityName) => {
  const newCity = cityName || prompt("Enter your city name:", userCity || "");
  if (newCity && newCity.trim()) {
    userCity = newCity.trim();
    proxState.userCity = userCity; // sync hospital discovery too

    // Update the nearby button label
    const nearbyBtn = document.getElementById('nearby-btn');
    if (nearbyBtn) {
      nearbyBtn.innerHTML = `${icon('my_location')} ${userCity} [-]`;
      nearbyBtn.style.borderColor = 'var(--success)';
      nearbyBtn.style.color = 'var(--success)';
      nearbyBtn._cityLocked = true;
    }

    // Hide hint and reload
    const locHint = document.getElementById('loc-hint');
    if (locHint) locHint.style.display = 'none';

    showToast(`City locked: ${userCity} - showing local doctors`, 'success');
    loadNearbyDoctors(document.getElementById('doctor-search')?.value || '');
    loadProxHospitals();
  }
};

async function autoDetectCityThenLoadDoctors(searchQuery = '') {
  // If city already detected (e.g. from "My Location" button or prior call), skip detection
  if (!userCity) {
    try {
      const gR = await fetch('https://ipapi.co/json/');
      const gD = await gR.json();
      const detectedCity = gD.city || gD.region || null;
      if (detectedCity) {
        userCity = detectedCity;
        // Subtle city-lock notification
        showToast(`${icon('location_city')} City detected: ${userCity} - showing local doctors`, 'info');
        // Also update the nearby button label if visible
        const nearbyBtn = document.getElementById('nearby-btn');
        if (nearbyBtn && !nearbyBtn._cityLocked) {
          nearbyBtn.classList.add('nearby-pulse-trigger');
          nearbyBtn.innerHTML = `${icon('my_location', 'city-match-pulse')} ${userCity}`;
          nearbyBtn.style.borderColor = 'var(--resonance-cyan)';
          nearbyBtn.style.color = 'var(--resonance-cyan)';

          // Resonance Handshake - remove pulse after 2s
          setTimeout(() => nearbyBtn.classList.remove('nearby-pulse-trigger'), 2000);

          // Show the GPS hint
          const locHint = document.getElementById('loc-hint');
          const hintCity = document.getElementById('hint-city');
          if (locHint && hintCity) {
            hintCity.textContent = userCity;
            locHint.style.display = 'flex';
          }
        }
      }
    } catch (_) {
      // Silent fail - IP detection unavailable, show all doctors
    }
  }
  loadNearbyDoctors(searchQuery);
}

async function loadNearbyDoctors(searchQuery = '') {
  const listEl = document.getElementById('doctors-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="spinner"></div>';

  let url = '/api/doctors/nearby?';
  if (userLocation) url += `lat=${userLocation.lat}&lng=${userLocation.lng}&radius=30&`;
  if (userCity) url += `city=${encodeURIComponent(userCity)}&`;
  if (searchQuery) url += `search=${encodeURIComponent(searchQuery)}&`;

  try {
    const data = await api(url);
    const docs = data.doctors || [];
    loadPatientAppointments();
    if (!docs.length) {
      listEl.innerHTML = `<div class="text-center" style="padding:4rem 2rem;opacity:0.6">
        <div style="font-size:3.5rem;margin-bottom:1.5rem;animation:proxBreathe 3s ease-in-out infinite">${icon('search_off')}</div>
        <p class="text-muted" style="font-weight:600;font-size:1.1rem">No healthcare nodes found in this city-node</p>
        <p class="text-muted" style="font-size:0.85rem;margin-top:0.5rem">Adjust your location search or try another city.</p>
      </div>`;
    } else {
      // Manifest the results with Zero-G Crystallization
      listEl.classList.add('zero-g-crystallize');
      listEl.innerHTML = docs.map((d, i) => renderDoctorCard(d, i)).join('');

      // Wire handshake buttons
      document.querySelectorAll('.book-apt-btn').forEach(btn => {
        btn.onclick = () => openBookingModal(btn.dataset.docId, btn.dataset.docName, btn.dataset.docSpecialization, btn.dataset.docHospital, btn.dataset.docFee, btn.dataset.docDays);
      });
    }
  } catch (e) {
    listEl.innerHTML = '<p class="text-muted text-center" style="padding:2rem">Failed to load doctors</p>';
  }

  // Wire doctor search
  const searchInput = document.getElementById('doctor-search');
  if (searchInput && !searchInput._bound) {
    searchInput._bound = true;
    searchInput.onkeyup = debounce(() => loadNearbyDoctors(searchInput.value.trim()), 400);
  }

  // -- Wire "My Location" button - City-Node Isolation Protocol --
  const nearbyBtn = document.getElementById('nearby-btn');
  if (nearbyBtn && !nearbyBtn._bound) {
    nearbyBtn._bound = true;

    nearbyBtn.onclick = async () => {
      const si = document.getElementById('doctor-search');
      const curQuery = si ? si.value.trim() : '';
      if (nearbyBtn._cityLocked) {
        nearbyBtn._cityLocked = false;
        userLocation = null;
        nearbyBtn.innerHTML = `${icon('my_location')} ${userCity ? userCity + ' (auto)' : 'My Location'}`;
        nearbyBtn.style.borderColor = userCity ? 'var(--primary)' : '';
        nearbyBtn.style.color = userCity ? 'var(--primary)' : '';
        const el = document.getElementById('doctors-list');
        if (el) { el.classList.remove('hosp-list-evaporate'); el.classList.add('hosp-crystallize'); }

        // Hide the GPS hint when user resets or uses GPS
        const locHint = document.getElementById('loc-hint');
        if (locHint) locHint.style.display = 'none';

        loadNearbyDoctors(curQuery);
        return;
      }
      // Spatial Pulse ripple
      const locHint = document.getElementById('loc-hint');
      if (locHint) locHint.style.display = 'none';
      nearbyBtn.innerHTML = icon('hourglass_empty') + ' Seeking...';
      nearbyBtn.style.setProperty('--prox-ripple-active', '1');
      // Add inline ripple rings on the button
      const btnWrap = nearbyBtn.parentElement;
      if (btnWrap) {
        for (let i = 0; i < 3; i++) {
          const ring = document.createElement('div');
          ring.style.cssText = `position:absolute;top:50%;left:50%;border-radius:50%;border:1.5px solid rgba(0,92,173,0.5);width:8px;height:8px;margin:-4px 0 0 -4px;animation:proxRippleExpand 1.8s cubic-bezier(0,0.9,0.57,1) ${i * 0.3}s forwards;pointer-events:none`;
          btnWrap.style.position = 'relative';
          btnWrap.appendChild(ring);
          setTimeout(() => ring.remove(), 2200);
        }
      }

      if (!navigator.geolocation) {
        nearbyBtn.innerHTML = icon('my_location') + ' My Location';
        showToast('Geolocation not supported', 'error');
        return;
      }

      navigator.geolocation.getCurrentPosition(async pos => {
        userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };

        // Reverse geocode for city detection (overrides IP detection if available)
        try {
          const gR = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`);
          const gD = await gR.json();
          const addr = gD.address || {};
          let detected = addr.city || addr.town || addr.village || addr.suburb || addr.municipality || addr.county || null;

          // Bengaluru/Bangalore Synonym Mapping
          if (detected && (detected.toLowerCase().includes('bengaluru') || detected.toLowerCase().includes('bangalore'))) {
            detected = 'Bangalore';
          }
          userCity = detected || userCity || null;
        } catch (_) { }

        nearbyBtn.innerHTML = `${icon('my_location')} ${userCity || 'Nearby'} [-]`;
        nearbyBtn.style.borderColor = 'var(--success)';
        nearbyBtn.style.color = 'var(--success)';
        nearbyBtn._cityLocked = true;

        // Update hint if it's still wrong
        const hintCity = document.getElementById('hint-city');
        const locHint = document.getElementById('loc-hint');
        if (locHint && hintCity) {
          hintCity.textContent = userCity;
          locHint.style.display = 'flex';
        }

        showToast(`City locked: ${userCity || 'your area'} - showing local doctors`, 'success');

        // Evaporate existing list
        const docListEl = document.getElementById('doctors-list');
        if (docListEl) {
          docListEl.classList.add('hosp-list-evaporate');
          await new Promise(r => setTimeout(r, 360));
        }

        // Reload with GPS coords for distance sort
        loadNearbyDoctors(curQuery);
      }, () => {
        nearbyBtn.innerHTML = icon('my_location') + ' My Location';
        showToast('Location access denied', 'error');
      });
    };
  }

  // -- Wire Proximity Pulse Nearby button for hospitals --
  const proxBtn = document.getElementById('prox-nearby-btn');
  if (proxBtn && !proxBtn._bound) {
    proxBtn._bound = true;
    proxBtn.onclick = async () => {
      if (proxState.isProxMode) {
        proxState.isProxMode = false; proxState.userLat = null; proxState.userLng = null; proxState.userCity = null;
        proxBtn.classList.remove('active');
        proxBtn.innerHTML = '<span class="prox-dot"></span> Nearby';
        const bw = document.getElementById('prox-city-badge-wrap'); if (bw) bw.innerHTML = '';
        const rb = document.getElementById('prox-reset-btn'); if (rb) rb.style.display = 'none';
        loadProxHospitals();
        return;
      }
      proxBtn.innerHTML = '<span class="prox-dot"></span> Seeking\u2026'; proxBtn.classList.add('scanning');
      // Ripple effect
      const bw = document.getElementById('prox-btn-wrap');
      if (bw) { for (let i = 0; i < 3; i++) { const r = document.createElement('div'); r.className = 'prox-ripple'; bw.appendChild(r); } setTimeout(() => bw.querySelectorAll('.prox-ripple').forEach(r => r.remove()), 2100); }

      if (!navigator.geolocation) {
        showToast('Geolocation not supported', 'error');
        proxBtn.classList.remove('scanning'); proxBtn.innerHTML = '<span class="prox-dot"></span> Nearby'; return;
      }
      navigator.geolocation.getCurrentPosition(async pos => {
        proxState.userLat = pos.coords.latitude; proxState.userLng = pos.coords.longitude; proxState.isProxMode = true;
        // Reverse geocode via Nominatim
        try {
          const geoR = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${proxState.userLat}&lon=${proxState.userLng}&format=json`);
          const geoD = await geoR.json();
          const addr = geoD.address || {};
          proxState.userCity = addr.city || addr.town || addr.village || addr.county || null;
        } catch (_) { proxState.userCity = null; }
        proxBtn.classList.remove('scanning'); proxBtn.classList.add('active');
        proxBtn.innerHTML = '<span class="prox-dot"></span> Nearby \u2713';
        const bwrap = document.getElementById('prox-city-badge-wrap');
        if (bwrap && proxState.userCity) bwrap.innerHTML = `<span class="prox-city-badge"><span class="prox-city-dot"></span>${proxState.userCity}</span>`;
        showToast(`City locked: ${proxState.userCity || 'your area'}`, 'success');
        loadProxHospitals();
      }, () => { proxBtn.classList.remove('scanning'); proxBtn.innerHTML = '<span class="prox-dot"></span> Nearby'; showToast('Location access denied', 'error'); });
    };
  }
  // Wire hospital search input
  const proxSearch = document.getElementById('prox-search-input');
  if (proxSearch && !proxSearch._bound) {
    proxSearch._bound = true;
    proxSearch.oninput = debounce(() => loadProxHospitals({ search: proxSearch.value.trim() }), 350);
  }
  // Wire reset button
  const resetBtn = document.getElementById('prox-reset-btn');
  if (resetBtn && !resetBtn._bound) {
    resetBtn._bound = true;
    resetBtn.onclick = () => {
      proxState.isProxMode = false; proxState.userLat = null; proxState.userLng = null; proxState.userCity = null;
      if (proxBtn) { proxBtn.classList.remove('active', 'scanning'); proxBtn.innerHTML = '<span class="prox-dot"></span> Nearby'; }
      const bw2 = document.getElementById('prox-city-badge-wrap'); if (bw2) bw2.innerHTML = '';
      resetBtn.style.display = 'none';
      if (proxSearch) proxSearch.value = '';
      loadProxHospitals();
    };
  }
  // Initial hospital load
  loadProxHospitals();
}

function renderDoctorCard(d, idx) {
  const initial = (d.name || 'D')[0].toUpperCase();
  const days = d.available_days || 'Mon,Tue,Wed,Thu,Fri';
  const shortDays = days.split(',').slice(0, 3).join(', ') + (days.split(',').length > 3 ? '...' : '');

  // Spatial Offset Badge - The Geographic Handshake
  const isClose = d.distance_km != null && d.distance_km <= 5;
  const distanceBadge = d.distance_km != null
    ? `<div class="doctor-proximity-badge spatial-offset-metric" style="${isClose ? 'box-shadow: 0 0 12px var(--resonance-glow)' : 'opacity:0.9'}">
        ${icon('near_me', 'icon-xs')} ${d.distance_km.toFixed(1)} km
       </div>`
    : '';

  const driftDelay = `${(idx * 0.05).toFixed(2)}s`;

  return `<div class="doctor-card zero-g-crystallize" style="--drift-delay:${driftDelay};animation-delay:${driftDelay}">
    <div class="doctor-card-left">
      <div class="doctor-avatar" style="background:linear-gradient(135deg,var(--primary),#3949AB);box-shadow:0 8px 16px -4px rgba(var(--primary-rgb),0.2)">
        ${d.profile_photo ? `<img src="${d.profile_photo}" style="width:100%;height:100%;object-fit:cover">` : initial}
      </div>
      <div class="doctor-info">
        <h4 style="font-size:1.15rem;font-weight:800;color:var(--on-surface)">${d.name}</h4>
        <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin:0.5rem 0">
          ${d.specialization ? `<span class="badge" style="background:var(--primary-light);color:var(--primary);font-size:0.75rem;padding:0.25rem 0.6rem">${icon('stethoscope', 'icon-xs')} ${d.specialization}</span>` : ''}
          ${d.experience_years ? `<span class="badge" style="background:var(--secondary-light);color:var(--secondary);font-size:0.75rem;padding:0.25rem 0.6rem">${icon('workspace_premium', 'icon-xs')} ${d.experience_years} yrs</span>` : ''}
        </div>
        <p class="text-muted" style="font-size:0.85rem;display:flex;align-items:center;gap:0.35rem;margin-bottom:0.4rem">
            ${icon('location_city', 'icon-xs')} ${d.hospital || 'Independent Practice'}
        </p>
        <p class="text-muted" style="font-size:0.75rem;opacity:0.87">
            ${icon('schedule', 'icon-xs')} Available ${shortDays} (${d.available_start || '09:00'} - ${d.available_end || '17:00'})
        </p>
      </div>
    </div>
    <div class="doctor-card-right" style="border-left: 1px solid var(--surface-container-highest);padding-left:1.5rem;display:flex;flex-direction:column;justify-content:center;gap:0.75rem;align-items:center;min-width:120px">
      ${distanceBadge}
      <div class="doctor-fee" style="text-align:center">
        <span style="font-size:1.4rem;font-weight:900;color:var(--success);display:block">&#8377;${d.consultation_fee || 500}</span>
        <span class="text-muted" style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.02em">per consult</span>
      </div>
      <button class="btn btn-primary btn-sm book-apt-btn" style="width:100%;justify-content:center"
        data-doc-id="${d.id}" data-doc-name="${d.name}"
        data-doc-specialization="${d.specialization || ''}" data-doc-hospital="${d.hospital || ''}"
        data-doc-fee="${d.consultation_fee || 500}"
        data-doc-days="${d.available_days || 'Mon,Tue,Wed,Thu,Fri'}">
        ${icon('calendar_month')} Book</button>
    </div>
  </div>`;
}

function openBookingModal(docId, docName, spec, hospital, fee, availableDays) {
  const modal = document.getElementById('booking-modal');
  if (!modal) return;
  modal.classList.remove('hidden');
  const today = new Date().toISOString().split('T')[0];
  modal.innerHTML = `<div class="booking-overlay" onclick="closeBookingModal()">
    <div class="booking-content" onclick="event.stopPropagation()">
      <button class="booking-close" onclick="closeBookingModal()">${icon('close')}</button>
      <h3 style="margin-bottom:1rem">${icon('calendar_month')} Book Appointment</h3>
      <div style="display:flex;align-items:center;gap:1rem;padding:1rem;background:var(--surface-container-low);border-radius:var(--radius-md);margin-bottom:1.25rem">
        <div class="doctor-avatar" style="background:linear-gradient(135deg,#5C6BC0,#3949AB);width:3rem;height:3rem;font-size:1.25rem">${(docName || 'D')[0]}</div>
        <div><h4 style="font-size:1rem">${docName}</h4><p class="text-muted" style="font-size:0.8125rem">${spec ? spec + ' - ' : ''}${hospital}</p></div>
        <div style="margin-left:auto;text-align:right"><span style="font-weight:700;color:var(--success)">&#8377; ${fee}</span></div>
      </div>
      <div class="form-group"><label class="form-label">Preferred Date *</label><input class="form-input" type="date" id="apt-date" min="${today}" value="${today}"></div>
      <div class="form-group"><label class="form-label">Available Slots</label>
        <div id="slot-grid" class="slot-grid"></div>
      </div>
      <div class="form-group"><label class="form-label">Notes (optional)</label><textarea class="form-input" id="apt-notes" rows="2" placeholder="Describe your symptoms..."></textarea></div>
      <button class="btn btn-primary btn-block" id="confirm-apt-btn">${icon('check_circle')} Confirm Booking</button>
    </div>
  </div>`;

  document.getElementById('confirm-apt-btn').onclick = async () => {
    const p = APP.state.patient;
    const date = document.getElementById('apt-date').value;
    const timeSlot = document.querySelector('.slot-btn.selected')?.dataset.time;
    const notes = document.getElementById('apt-notes').value;
    if (!date) { showToast('Select a date', 'error'); return; }
    if (!timeSlot) { showToast('Please select a time slot', 'error'); return; }
    try {
      const btn = document.getElementById('confirm-apt-btn');
      btn.disabled = true;
      btn.innerHTML = icon('hourglass_empty') + ' Booking...';
      await api('/api/appointments', {
        method: 'POST', body: {
          patient_id: p.id, doctor_id: docId, patient_name: p.name, doctor_name: docName, date, time_slot: timeSlot, notes
        }
      });
      showToast('Request sent to doctor!', 'success');
      closeBookingModal();
      loadPatientAppointments();
    } catch (e) {
      document.getElementById('confirm-apt-btn').disabled = false;
      document.getElementById('confirm-apt-btn').innerHTML = icon('check_circle') + ' Confirm Booking';
    }
  };

  // --- NEW: Temporal Pruning Logic ---
  const getSlotTimestamp = (dateStr, timeStr) => {
    const [h12, mm_ampm] = timeStr.split(':');
    const [mm, ampm] = mm_ampm.split(' ');
    let h = parseInt(h12);
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const d = new Date(dateStr);
    d.setHours(h, parseInt(mm), 0, 0);
    return d.getTime();
  };

  const temporalPruning = () => {
    const now = Date.now();
    const buffer = 15 * 60 * 1000;
    const slots = document.querySelectorAll('.slot-btn:not(.evaporating)');
    slots.forEach(slot => {
      const ts = parseInt(slot.dataset.timestamp);
      if (ts < now + buffer) {
        slot.classList.add('evaporating');
        setTimeout(() => slot.remove(), 600);
      }
    });
  };

  if (window.bookingInterval) clearInterval(window.bookingInterval);
  window.bookingInterval = setInterval(temporalPruning, 30000);

  // Date change handler to refresh slots
  const dateInput = document.getElementById('apt-date');
  const refreshSlots = async () => {
    const slotGrid = document.getElementById('slot-grid');
    if (!slotGrid) return;
    slotGrid.innerHTML = '<div class="spinner" style="grid-column: 1/-1"></div>';
    try {
      // Local resonance check before API call
      const selectedDate = new Date(dateInput.value);
      const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'short' });
      const available = (availableDays || 'Mon,Tue,Wed,Thu,Fri').toLowerCase().includes(dayName.toLowerCase());

      if (!available) {
        slotGrid.innerHTML = `
          <div class="resonance-alert" style="grid-column: 1/-1; padding: 1.5rem; text-align: center; border: 1px dashed var(--error); border-radius: 12px; background: rgba(var(--error-rgb),0.05)">
            ${icon('event_busy', 'icon-lg', 'color:var(--error)')}
            <p style="color:var(--error); font-weight:700; margin-top:0.5rem">Doctor is not available on ${dayName}s</p>
            <p class="text-muted" style="font-size:0.75rem; margin-top:0.25rem">Please select a different date (e.g. Mon-Fri)</p>
          </div>`;
        return;
      }

      const data = await api(`/api/appointments/slots/${docId}/${dateInput.value}`);
      const now = Date.now();
      const buffer = 15 * 60 * 1000;

      const filteredSlots = data.slots
        .map(s => ({ ...s, timestamp: getSlotTimestamp(dateInput.value, s.time) }))
        .filter(s => s.timestamp > now + buffer);

      if (filteredSlots.length === 0) {
        slotGrid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1; padding: 1rem; text-align: center;">No slots available for this period.</p>';
        return;
      }

      slotGrid.innerHTML = filteredSlots.map(s => `
        <div class="slot-btn ${s.locked ? 'locked' : ''}" data-time="${s.time}" data-timestamp="${s.timestamp}">
          ${s.time}
        </div>
      `).join('');

      // Bind slot clicks
      document.querySelectorAll('.slot-btn:not(.locked)').forEach(btn => {
        btn.onclick = () => {
          document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        };
      });
    } catch (e) {
      slotGrid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1">Failed to load slots</p>';
    }
  };
  dateInput.onchange = refreshSlots;
  refreshSlots();
}

function closeBookingModal() {
  if (window.bookingInterval) {
    clearInterval(window.bookingInterval);
    window.bookingInterval = null;
  }
  const m = document.getElementById('booking-modal');
  if (m) { m.classList.add('hidden'); m.innerHTML = ''; }
}

function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function tabAI() {
  const p = APP.state.patient || {};
  const quickActions = [
    { label: 'Fever', icon: 'thermostat', msg: 'I have a fever' },
    { label: 'Headache', icon: 'neurology', msg: 'I have a headache' },
    { label: 'Cold & Cough', icon: 'sick', msg: 'I have cold and cough' },
    { label: 'Stomach', icon: 'digestive', msg: 'Stomach pain and acidity' },
    { label: 'BMI', icon: 'monitor_weight', msg: 'Calculate my BMI' },
    { label: 'Sleep', icon: 'bedtime', msg: 'I have trouble sleeping' },
    { label: 'Stress', icon: 'self_improvement', msg: 'I feel stressed and anxious' },
    { label: 'Nutrition', icon: 'restaurant', msg: 'Healthy diet tips' },
  ];

  return `<div class="ai-chat-container">
    <div class="ai-chat-header">
      <div class="ai-chat-header-info">
        <div class="ai-avatar">${icon('smart_toy')}</div>
        <div>
          <h3>AI Health Assistant</h3>
          <span class="ai-status">${icon('circle')} Online - Ask me anything about health</span>
        </div>
      </div>
    </div>

    <div class="ai-chat-disclaimer">
      ${icon('info')} I am an AI assistant, not a doctor. For emergencies or serious concerns, consult a healthcare professional.
    </div>

    <div class="ai-chat-messages" id="ai-messages">
      <div class="ai-message bot">
        <div class="ai-message-avatar">${icon('smart_toy')}</div>
        <div class="ai-message-content">
          <p>Hello${p.name ? ' ' + p.name : ''}!  I'm your AI Health & Wellness Assistant.</p>
          <p>I can help you with:</p>
          <ul>
            <li> <strong>Symptom assessment</strong> - describe what you're feeling</li>
            <li> <strong>Medication info</strong> - dosage and safety guidance</li>
            <li> <strong>Nutrition advice</strong> - diet plans and healthy eating</li>
            <li> <strong>Fitness tips</strong> - exercise and activity guidance</li>
            <li> <strong>Mental wellness</strong> - stress and sleep management</li>
            <li> <strong>BMI Calculator</strong> - just say "BMI" with height & weight</li>
          </ul>
          <p>What health concern can I help you with today?</p>
        </div>
      </div>
    </div>

    <div class="ai-quick-actions" id="ai-quick-actions">
      ${quickActions.map(q => `<button class="ai-quick-btn" data-msg="${q.msg}">${icon(q.icon)} ${q.label}</button>`).join('')}
    </div>

    <div class="ai-chat-input-area">
      <div class="ai-typing-indicator hidden" id="ai-typing">
        <div class="ai-message bot" style="padding:0.5rem 0">
          <div class="ai-message-avatar" style="width:1.75rem;height:1.75rem;font-size:0.75rem">${icon('smart_toy')}</div>
          <div class="ai-message-content">
            <div class="typing-dots"><span></span><span></span><span></span></div>
          </div>
        </div>
      </div>
      <div class="ai-input-row">
        <input class="ai-input" id="ai-input" placeholder="Describe your symptoms or ask a health question..." autocomplete="off">
        <button class="ai-send-btn" id="ai-send">${icon('send')}</button>
      </div>
    </div>
  </div>`;
}

function initAIChat() {
  const input = document.getElementById('ai-input');
  const sendBtn = document.getElementById('ai-send');
  const messagesEl = document.getElementById('ai-messages');
  if (!input || !sendBtn) return;

  const patientId = APP.state.patient?.id || '';

  // Quick action buttons
  document.querySelectorAll('.ai-quick-btn').forEach(btn => {
    btn.onclick = () => {
      sendAIMessage(btn.dataset.msg, patientId);
    };
  });

  const sendMessage = () => {
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    sendAIMessage(msg, patientId);
  };

  sendBtn.onclick = sendMessage;
  input.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
}

async function sendAIMessage(message, patientId) {
  const messagesEl = document.getElementById('ai-messages');
  const typingEl = document.getElementById('ai-typing');
  const quickActions = document.getElementById('ai-quick-actions');

  // Hide quick actions after first message
  if (quickActions) quickActions.style.display = 'none';

  // Add user message
  const userHtml = `<div class="ai-message user">
    <div class="ai-message-content"><p>${escapeHtml(message)}</p></div>
  </div>`;
  messagesEl.insertAdjacentHTML('beforeend', userHtml);
  scrollToChatBottom();

  // Show typing indicator
  if (typingEl) typingEl.classList.remove('hidden');
  scrollToChatBottom();

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        messages: [{ role: 'user', content: message }], 
        userId: patientId, 
        role: 'patient',
        stream: true 
      })
    });

    if (!response.ok) throw new Error('API connection failed');

    // Hide typing
    if (typingEl) typingEl.classList.add('hidden');

    const botMsgId = 'bot-' + Date.now();
    const botHtml = `<div class="ai-message bot" id="${botMsgId}">
      <div class="ai-message-avatar">${icon('smart_toy')}</div>
      <div class="ai-message-content"></div>
    </div>`;
    messagesEl.insertAdjacentHTML('beforeend', botHtml);
    const contentEl = document.getElementById(botMsgId).querySelector('.ai-message-content');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullReply = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      fullReply += chunk;
      
      // Update UI with formatted reply
      contentEl.innerHTML = formatAIReply(fullReply);
      scrollToChatBottom();
    }
  } catch (e) {
    console.error('AI Error:', e);
    if (typingEl) typingEl.classList.add('hidden');
    const errorHtml = `<div class="ai-message bot">
      <div class="ai-message-avatar">${icon('smart_toy')}</div>
      <div class="ai-message-content"><p>I'm sorry, I couldn't process your request. Please try again.</p></div>
    </div>`;
    messagesEl.insertAdjacentHTML('beforeend', errorHtml);
  }

  if (typingEl) typingEl.classList.add('hidden');
  scrollToChatBottom();
}

function scrollToChatBottom() {
  const messagesEl = document.getElementById('ai-messages');
  if (messagesEl) setTimeout(() => messagesEl.scrollTop = messagesEl.scrollHeight, 50);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatAIReply(text) {
  // Step 1: Decode HTML entities that the model may have output literally
  // (e.g. &lt;strong&gt; → <strong>)
  let cleanText = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Step 2: Convert HTML tags to Markdown equivalents before escaping
  cleanText = cleanText
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p[^>]*>/gi, '')
    .replace(/<\/?strong>|<\/?b>/gi, '**')
    .replace(/<\/?em>|<\/?i>/gi, '*')
    .replace(/<li>/gi, '\n- ')
    .replace(/<\/li>/gi, '')
    .replace(/<\/?ul>|<\/?ol>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, '\n**')
    .replace(/<\/h[1-6]>/gi, '**\n')
    .replace(/<[^>]*>/g, '');
  
  let html = escapeHtml(cleanText);

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // Tables
  html = html.replace(/\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/g, (match, headerRow, bodyRows) => {
    const headers = headerRow.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const rows = bodyRows.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    return `<table class="ai-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Lists
  html = html.replace(/^\s*(\*|-)\s+(.+)$/gm, '<li>$2</li>');
  html = html.replace(/(?:<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);

  // Numbered lists
  html = html.replace(/^\s*(\d+)\.\s+(.+)$/gm, '<li>$2</li>');
  html = html.replace(/(?:<li>.*<\/li>\n?)+/g, (m) => m.includes('<ul>') ? m : `<ol>${m}</ol>`);

  // Paragraphs (double newlines)
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph if not already structured
  if (!html.startsWith('<')) html = '<p>' + html + '</p>';

  // Emoji markers for sections
  html = html.replace(/(⚠|---|🏥|💊|🩺|📋|❗)/g, '<span class="ai-emoji">$1</span>');

  return html;
}

// ============================================================
// HEALTH REPORTS TAB (Analyzer & History)
// ============================================================
function tabHealthReports(p) {
  return `<div class="card" style="padding:2rem">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem">
      <h3 style="display:flex;align-items:center;gap:0.5rem;margin:0">${icon('science')} Health Report Analyzer</h3>
      <button class="btn btn-primary btn-sm" onclick="showReportUpload()">${icon('upload_file')} Upload New Report</button>
    </div>
    
    <div id="reports-view-area">
      <div id="reports-list-container"><div class="spinner"></div></div>
    </div>
  </div>`;
}

function showReportUpload() {
  const container = document.getElementById('reports-view-area');
  if (!container) return;

  container.innerHTML = `
    <div class="upload-container" id="report-upload-box" style="border: 2px dashed var(--outline-variant); border-radius: var(--radius-xl); padding: 3rem 1.5rem; text-align: center; background: var(--surface-container-low); transition: all 0.2s ease">
      <div class="upload-icon" style="font-size: 3rem; color: var(--primary); margin-bottom: 1rem">${icon('cloud_upload')}</div>
      <h4 style="margin-bottom:0.5rem">Upload Medical Report</h4>
      <p class="text-muted mb-3" style="font-size:0.875rem">Supported: PDF, JPG, or PNG (Max 15MB)</p>
      
      <div class="form-row" style="max-width:400px;margin:0 auto 1.5rem;text-align:left">
        <div class="form-group"><label class="form-label">Report Type</label>
          <select class="form-select" id="report-type">
            <option>Complete Blood Count (CBC)</option>
            <option>Liver Function Test (LFT)</option>
            <option>Kidney Function Test (KFT)</option>
            <option>Lipid Profile</option>
            <option>Thyroid Profile</option>
            <option>General/Other</option>
          </select>
        </div>
      </div>
      
      <input type="file" id="report-file-input" accept="application/pdf,image/*" hidden>
      <label for="report-file-input" class="btn btn-outline" style="cursor:pointer">${icon('attach_file')} Browse Files</label>
      <p id="file-name-display" style="margin-top:1rem;font-weight:600;color:var(--primary);word-break:break-all"></p>
      
      <div style="margin-top:2rem;display:flex;gap:1rem;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="loadHealthReports()">${icon('arrow_back')} Back to History</button>
        <button class="btn btn-primary" id="analyze-report-btn" disabled>${icon('auto_awesome')} Analyze Report</button>
      </div>
    </div>
  `;

  const fileInput = document.getElementById('report-file-input');
  const analyzeBtn = document.getElementById('analyze-report-btn');
  const nameDisplay = document.getElementById('file-name-display');
  const uploadBox = document.getElementById('report-upload-box');

  let selectedFile = null;

  fileInput.onchange = (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
      nameDisplay.textContent = selectedFile.name;
      analyzeBtn.disabled = false;
      uploadBox.style.borderColor = 'var(--primary)';
      uploadBox.style.background = 'var(--surface)';
    } else {
      nameDisplay.textContent = '';
      analyzeBtn.disabled = true;
      uploadBox.style.borderColor = 'var(--outline-variant)';
      uploadBox.style.background = 'var(--surface-container-low)';
    }
  };

  analyzeBtn.onclick = async () => {
    if (!selectedFile) return;

    const p = APP.state.patient;
    const type = document.getElementById('report-type').value;

    // Show loading
    container.innerHTML = `<div class="text-center" style="padding:4rem 2rem; background: var(--surface-container-lowest); border-radius: var(--radius-xl); box-shadow: 0 4px 24px rgba(0,0,0,0.02)">
      <div class="spinner" style="width:3.5rem;height:3.5rem;border-width:4px;margin-bottom:1.5rem;border-color:var(--surface-container-high);border-top-color:var(--primary)"></div>
      <h3 style="color:var(--on-surface)">Analyzing Report</h3>
      <p class="text-muted" style="max-width:300px;margin: 0.5rem auto 0">Extracting clinical values and running cross-reference via Universal Health AI...</p>
      <div style="margin-top:1.5rem"><span class="badge" style="background:#e3f2fd;color:#1565c0">${icon('psychology')} AI Processing</span></div>
    </div>`;

    const sendToAPI = async (base64Str) => {
      try {
        const res = await api('/api/patients/' + p.id + '/analyze-report', {
          method: 'POST',
          body: {
            base64_image: base64Str,
            report_type: type,
            age: p.dob ? Math.floor((Date.now() - new Date(p.dob)) / 31557600000) : null,
            gender: p.gender || 'Unknown'
          }
        });
        renderReportResults(res.analysis);
      } catch (err) {
        showToast('Analysis failed. The AI might be currently unavailable.', 'error');
        loadHealthReports();
      }
    };

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Str = e.target.result;
      sendToAPI(base64Str);
    };

    if (selectedFile.type === 'application/pdf') {
      try {
        const fileData = await selectedFile.arrayBuffer();
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
        const pdf = await pdfjsLib.getDocument({ data: fileData }).promise;
        const page = await pdf.getPage(1); // MVP: Just the first page
        const viewport = page.getViewport({ scale: 2.0 }); // High res
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        sendToAPI(dataUrl);
      } catch (e) {
        console.error(e);
        showToast('Failed to parse PDF', 'error');
        loadHealthReports();
      }
    } else {
      reader.readAsDataURL(selectedFile);
    }
  };
}

async function loadHealthReports() {
  const container = document.getElementById('reports-view-area');
  if (!container) return;
  const p = APP.state.patient;

  container.innerHTML = '<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner"></div></div>';

  try {
    const res = await api('/api/patients/' + p.id + '/lab-reports');
    const reports = res.reports || [];

    if (reports.length === 0) {
      container.innerHTML = `<div class="text-center" style="padding:4rem 2rem;background:var(--surface-container-low);border-radius:var(--radius-xl)">
        <div style="font-size:3.5rem;color:var(--outline-variant);margin-bottom:1rem">${icon('inventory_2')}</div>
        <h4 style="color:var(--on-surface-variant)">No Reports Found</h4>
        <p class="text-muted mb-4" style="max-width:300px;margin:1rem auto">Upload your first lab report to get a simplified, plain-English breakdown of your results.</p>
        <button class="btn btn-outline" onclick="showReportUpload()">${icon('add')} Add First Report</button>
      </div>`;
      return;
    }

    let htmlCards = '';
    reports.forEach(r => {
      let summary = "Analysis complete";
      try {
        const data = JSON.parse(r.analysis_json);
        summary = data.summary || summary;
      } catch (e) { }

      const safeJson = r.analysis_json.replace(/'/g, "&#39;").replace(/"/g, "&quot;");

      htmlCards += `<div class="report-card" onclick="viewPastReport(this.dataset.json)" data-json="${safeJson}" style="background:var(--surface-container-lowest);padding:1.5rem;border-radius:var(--radius-lg);cursor:pointer;border:1px solid var(--surface-container-high);transition:all 0.2s;display:flex;align-items:flex-start;gap:1rem">
        <div class="report-icon" style="background:#e3f2fd;color:var(--primary);width:3rem;height:3rem;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          ${icon('assignment')}
        </div>
        <div class="report-info" style="flex:1">
          <h4 style="margin:0 0 0.25rem;font-size:1rem">${r.report_type || 'Lab Report'}</h4>
          <span class="text-muted" style="font-size:0.75rem;display:flex;align-items:center;gap:0.25rem;margin-bottom:0.75rem">${icon('calendar_month')} ${fmtDate(r.created_at)}</span>
          <p class="text-muted" style="font-size:0.875rem;margin:0;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${summary}</p>
        </div>
        <div class="report-action" style="color:var(--primary)">${icon('chevron_right')}</div>
      </div>`;
    });

    container.innerHTML = `<div class="report-history-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(300px, 1fr));gap:1.25rem;">${htmlCards}</div>`;

  } catch (e) {
    container.innerHTML = '<p class="text-danger text-center" style="padding:2rem">Failed to load reports history.</p>';
  }
}

window.viewPastReport = function (jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    renderReportResults(data);
  } catch (e) { showToast('Error reading report format', 'error'); }
}

function renderReportResults(data) {
  const container = document.getElementById('reports-view-area');
  if (!container) return;

  const parameters = data.parameters || [];

  let paramHtml = '';
  parameters.forEach(p => {
    let badgeClass = 'var(--success)';
    let badgeBg = '#e6f4ea';
    let badgeIcon = 'check_circle';

    if (p.status && p.status.toLowerCase().includes('border')) {
      badgeClass = 'var(--warning)'; badgeBg = '#fff8e1'; badgeIcon = 'warning';
    } else if (p.status && p.status.toLowerCase().includes('abnormal')) {
      badgeClass = 'var(--tertiary)'; badgeBg = '#ffebee'; badgeIcon = 'error';
    }

    paramHtml += `<div class="parameter-card" style="background:var(--surface-container-lowest);border-radius:var(--radius-lg);padding:1.25rem;border:1px solid var(--surface-container-high)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.75rem;flex-wrap:wrap;gap:0.5rem">
        <div>
          <div style="font-weight:700;font-size:1.1rem;color:var(--on-surface);margin-bottom:0.25rem">${p.name}</div>
          <div style="font-size:0.8125rem;color:var(--on-surface-variant)">Reference Range: ${p.normal_range || 'N/A'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:1.25rem;font-weight:800;color:var(--on-surface)">${p.value} <span style="font-size:0.875rem;font-weight:500;color:var(--outline)">${p.unit || ''}</span></div>
          <div style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.2rem 0.6rem;background:${badgeBg};color:${badgeClass};border-radius:2rem;font-size:0.75rem;font-weight:600;margin-top:0.25rem">
            ${icon(badgeIcon)} ${p.status}
          </div>
        </div>
      </div>
      <p style="margin:0;font-size:0.9rem;color:var(--on-surface-variant);line-height:1.5;background:var(--surface-container-low);padding:0.75rem;border-radius:var(--radius-md)">
        ${p.explanation || 'No explanation provided.'}
      </p>
    </div>`;
  });

  container.innerHTML = `
    <div class="results-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2rem;flex-wrap:wrap;gap:1rem;border-bottom:1px solid var(--surface-container-high);padding-bottom:1rem">
      <h3 style="margin:0;display:flex;align-items:center;gap:0.5rem;color:var(--primary)">${icon('analytics')} Analysis Results</h3>
      <button class="btn btn-outline btn-sm" onclick="loadHealthReports()">${icon('arrow_back')} Back to History</button>
    </div>
    
    <div class="results-summary-card" style="background:linear-gradient(135deg, #f7faff 0%, #eef5ff 100%);padding:1.75rem;border-radius:var(--radius-xl);margin-bottom:2.5rem;border:1px solid #dcebfe">
      <h4 style="color:var(--primary);margin-bottom:0.75rem;display:flex;align-items:center;gap:0.5rem">${icon('psychology')} AI Summary</h4>
      <p style="font-size:1rem;line-height:1.6;margin-bottom:1.5rem;color:var(--on-surface)">${data.summary || 'Overview not available.'}</p>
      
      <div style="background:#ffffff;padding:1.25rem;border-radius:var(--radius-lg);box-shadow:0 2px 12px rgba(0,0,0,0.03);border-left:4px solid var(--tertiary)">
        <h5 style="margin-bottom:0.5rem;color:var(--tertiary);display:flex;align-items:center;gap:0.5rem;font-size:0.95rem">${icon('tips_and_updates')} Recommendation</h5>
        <p style="font-size:0.95rem;margin:0;line-height:1.5;color:var(--on-surface-variant)">${data.recommendations || 'Please consult your doctor for medical advice.'}</p>
      </div>
    </div>
    
    <h4 style="margin-bottom:1.25rem;display:flex;align-items:center;gap:0.5rem">${icon('list_alt')} Detailed Parameters</h4>
    <div class="parameters-list" style="display:flex;flex-direction:column;gap:1rem">
      ${paramHtml}
    </div>
    
    <div class="text-center" style="margin-top:3rem;padding-top:1.5rem;border-top:1px solid var(--surface-container-high)">
      <p style="font-size:0.8125rem;color:var(--outline);max-width:500px;margin:0 auto;line-height:1.5">
        ${icon('info')} <strong>Disclaimer:</strong> This analysis is generated by an AI model and is intended for informational purposes only. It does not constitute a medical diagnosis. Always review your results with a qualified healthcare professional.
      </p>
    </div>
  `;
}

// ============================================================
// ANONYMOUS MENTAL HEALTH SUPPORT
// ============================================================

function renderMHNav() {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light_mode' : 'dark_mode';
  return `<nav class="navbar theme-mental-health"><div class="navbar-inner">
    <a href="#/mental-health" class="navbar-brand" style="color:var(--primary)"><div class="brand-icon">${icon('self_improvement')}</div>Wellness Space</a>
    <div class="navbar-links">
      <button data-action="navigate" data-target="#/" class="btn btn-text">${icon('arrow_back')} Exit to Main</button>
    </div>
  </div></nav>`;
}

function renderMHLanding(app) {
  app.innerHTML = `
    <div class="theme-mental-health" style="min-height:100vh;padding-bottom:4rem">
      ${renderMHNav()}
      <div class="container" style="padding-top:2rem">
        <div class="text-center" style="margin-bottom:4rem">
          <h1 style="color:var(--primary);font-size:3rem;margin-bottom:1rem;font-weight:800">You are not alone.</h1>
          <p style="font-size:1.25rem;color:var(--on-surface-variant);max-width:600px;margin:0 auto">A safe, anonymous space to check in with yourself, find peace, and talk without judgment. No names required.</p>
        </div>
        
        <div style="background:var(--tertiary-light);padding:1.5rem;border-radius:var(--radius-lg);margin-bottom:3rem;border:1px solid rgba(238, 155, 88, 0.2);display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap">
          <div style="background:var(--tertiary);color:#fff;width:3rem;height:3rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">${icon('support_agent')}</div>
          <div style="flex:1">
            <h3 style="margin:0 0 0.25rem;color:var(--tertiary)">In Immediate Crisis?</h3>
            <p style="margin:0;color:var(--on-surface-variant);font-size:0.95rem">Free, confidential support is available 24/7. Call Vandrevala Foundation: <strong>1860-2662-345</strong> or iCall: <strong>9152987821</strong></p>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:2rem">
          <div class="mh-card" onclick="navigate('/mental-health/tracker')">
            <div class="mh-card-icon" style="background:var(--primary-light);color:var(--primary)">${icon('mood')}</div>
            <div>
              <h3>Daily Mood Tracker</h3>
              <p>Check in daily and see how your feelings trend over time.</p>
            </div>
          </div>
          <div class="mh-card" onclick="navigate('/mental-health/chat')">
            <div class="mh-card-icon" style="background:var(--secondary-container);color:var(--on-secondary-container)">${icon('forum')}</div>
            <div>
              <h3>Anonymous Chat</h3>
              <p>Talk to our compassionate AI companion. It's safe and entirely private.</p>
            </div>
          </div>
          <div class="mh-card" onclick="navigate('/mental-health/assessment')">
            <div class="mh-card-icon" style="background:#fce4ec;color:#e91e63">${icon('assignment')}</div>
            <div>
              <h3>Self-Assessments</h3>
              <p>Take clinically backed quizzes for Anxiety, Depression, and Burnout.</p>
            </div>
          </div>
          <div class="mh-card" onclick="navigate('/mental-health/resources')">
            <div class="mh-card-icon" style="background:#e3f2fd;color:#2196f3">${icon('spa')}</div>
            <div>
              <h3>Self-Help Resources</h3>
              <p>Guided breathing, meditations, and articles to help you recenter.</p>
            </div>
          </div>
        </div>
        
        <div class="text-center" style="margin-top:4rem">
          <button class="btn btn-outline" onclick="navigate('/mental-health/therapists')">${icon('search')} Find a Human Therapist</button>
        </div>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// MOOD TRACKER
// ------------------------------------------------------------
function getMoods() {
  try { return JSON.parse(localStorage.getItem('uhqr_mh_moods')) || []; } catch (e) { return []; }
}
function saveMood(score, note) {
  const m = getMoods();
  m.push({ date: new Date().toISOString(), score, note });
  localStorage.setItem('uhqr_mh_moods', JSON.stringify(m));
  showToast('Mood saved successfully!', 'success');
  navigate('/mental-health');
}

function renderMHTracker(app) {
  let selectedScore = null;
  const emojis = [
    { s: 1, e: '', l: 'Awful' }, { s: 2, e: '', l: 'Meh' },
    { s: 3, e: '', l: 'Okay' }, { s: 4, e: '', l: 'Good' }, { s: 5, e: '', l: 'Great' }
  ];

  app.innerHTML = `
    <div class="theme-mental-health" style="min-height:100vh">
      ${renderMHNav()}
      <div class="container form-container" style="padding-top:3rem;max-width:700px">
        <button class="btn btn-text" onclick="history.back()">${icon('arrow_back')} Back</button>
        <h2 style="color:var(--primary);margin:1.5rem 0 0.5rem">How are you feeling today?</h2>
        <p style="color:var(--on-surface-variant);margin-bottom:2rem">This data is stored purely on your device.</p>
        
        <div style="background:var(--surface-container-lowest);padding:2rem;border-radius:var(--radius-xl);box-shadow:0 4px 20px rgba(0,0,0,0.03);border:1px solid var(--surface-container-high)">
          <div class="mood-selector" id="moodSelector">
            ${emojis.map(e => `
              <button class="mood-btn" data-score="${e.s}" title="${e.l}">
                ${e.e}
                <div style="font-size:0.75rem;margin-top:0.5rem;color:var(--on-surface-variant);font-weight:600">${e.l}</div>
              </button>
            `).join('')}
          </div>
          
          <div style="margin-top:2rem">
            <label class="form-label">What's making you feel this way? (Optional)</label>
            <textarea id="moodNote" class="form-control" rows="3" placeholder="Write whatever is on your mind..."></textarea>
          </div>
          
          <button id="saveMoodBtn" class="btn btn-primary" style="width:100%;margin-top:1.5rem;justify-content:center" disabled>Save Check-in</button>
        </div>
        
        <div style="margin-top:3rem">
          <h3 style="color:var(--primary)">Your Weekly Trend</h3>
          <canvas id="moodChart" style="background:#fff;padding:1rem;border-radius:var(--radius-lg);border:1px solid var(--surface-container-high);margin-top:1rem;height:250px"></canvas>
        </div>
      </div>
    </div>
  `;

  const btns = document.querySelectorAll('.mood-btn');
  const saveBtn = document.getElementById('saveMoodBtn');
  btns.forEach(b => {
    b.onclick = () => {
      btns.forEach(btn => btn.classList.remove('active'));
      b.classList.add('active');
      selectedScore = parseInt(b.dataset.score);
      saveBtn.disabled = false;
    }
  });

  saveBtn.onclick = () => saveMood(selectedScore, document.getElementById('moodNote').value);

  // Render Chart
  setTimeout(() => {
    const moods = getMoods().slice(-7);
    if (moods.length > 0) {
      new Chart(document.getElementById('moodChart').getContext('2d'), {
        type: 'line',
        data: {
          labels: moods.map(m => new Date(m.date).toLocaleDateString('en-US', { weekday: 'short' })),
          datasets: [{
            label: 'Mood Level',
            data: moods.map(m => m.score),
            borderColor: '#8a88cd',
            backgroundColor: 'rgba(138, 136, 205, 0.1)',
            fill: true,
            tension: 0.4,
            borderWidth: 3
          }]
        },
        options: {
          scales: { y: { min: 1, max: 5, ticks: { stepSize: 1 } } }
        }
      });
    }
  }, 100);
}

// ------------------------------------------------------------
// CHAT BOT
// ------------------------------------------------------------
function generateAlias() {
  const adjs = ['Gentle', 'Calm', 'Brave', 'Quiet', 'Bright', 'Soft'];
  const nouns = ['Panda', 'River', 'Lotus', 'Cloud', 'Breeze', 'Dawn'];
  return adjs[Math.floor(Math.random() * adjs.length)] + ' ' + nouns[Math.floor(Math.random() * nouns.length)];
}

function renderMHChat(app) {
  let messages = [];
  const alias = generateAlias();

  app.innerHTML = `
    <div class="theme-mental-health" style="min-height:100vh">
      ${renderMHNav()}
      <div class="container form-container" style="padding-top:2rem;max-width:800px;margin-bottom:2rem">
        <button class="btn btn-text" onclick="history.back()">${icon('arrow_back')} Leave Chat</button>
        <div style="display:flex;justify-content:space-between;align-items:center;margin:1rem 0">
          <div>
            <h2 style="color:var(--primary);margin:0">Anonymous Support Space</h2>
            <p style="color:var(--on-surface-variant);margin:0;font-size:0.9rem">You joined as <strong>${alias}</strong>. History is cleared when you leave.</p>
          </div>
          <div style="background:var(--tertiary-light);color:var(--tertiary);padding:0.5rem 1rem;border-radius:2rem;font-size:0.875rem;font-weight:700">Completely Private</div>
        </div>
        
        <div class="mh-chat-container">
          <div id="mhChatWindow" style="flex:1;overflow-y:auto;padding:1.5rem;display:flex;flex-direction:column;gap:1rem;background:var(--surface-container-low)">
            <div class="ai-message bot">
              <div class="ai-avatar">${icon('spa', 'text-white')}</div>
              <div class="ai-message-content">Hello ${alias}. I'm here to listen. This is a safe space with no judgment. How are you feeling right now?</div>
            </div>
          </div>
          <div style="padding:1rem;background:var(--surface-container-lowest);border-top:1px solid var(--surface-container-high);display:flex;gap:0.75rem">
            <input type="text" id="mhChatInput" class="form-control" placeholder="Type what's on your mind..." onkeypress="if(event.key==='Enter') window.sendMHChat()">
            <button class="btn btn-primary" onclick="window.sendMHChat()" style="border-radius:var(--radius-full);width:3rem;height:3rem;padding:0;display:flex;align-items:center;justify-content:center">${icon('send')}</button>
          </div>
        </div>
      </div>
    </div>
  `;

  window.sendMHChat = async () => {
    const input = document.getElementById('mhChatInput');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    const win = document.getElementById('mhChatWindow');
    win.innerHTML += `
      <div class="ai-message user">
        <div class="ai-message-content" style="background:var(--secondary-container);color:var(--on-secondary-container)">${msg.replace(/</g, "&lt;")}</div>
      </div>
    `;
    win.scrollTop = win.scrollHeight;

    messages.push({ role: 'user', content: msg });

    const loadingId = 'load-' + Date.now();
    win.innerHTML += `
      <div class="ai-message bot" id="${loadingId}">
        <div class="ai-avatar">${icon('spa', 'text-white')}</div>
        <div class="ai-message-content" style="opacity:0.6">Typing softly...</div>
      </div>
    `;
    win.scrollTop = win.scrollHeight;

    try {
      const response = await fetch('/api/mental-health/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, stream: true })
      });

      if (!response.ok) throw new Error('API connection failed');

      // Remove loading indicator
      const loader = document.getElementById(loadingId);
      if (loader) loader.remove();

      const botMsgId = 'bot-' + Date.now();
      win.innerHTML += `
        <div class="ai-message bot" id="${botMsgId}">
          <div class="ai-avatar">${icon('spa', 'text-white')}</div>
          <div class="ai-message-content"></div>
        </div>
      `;
      const contentEl = document.getElementById(botMsgId).querySelector('.ai-message-content');
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullReply = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullReply += chunk;
        // Use the same formatter as the health chat to strip HTML and render Markdown
        contentEl.innerHTML = formatAIReply(fullReply);
        win.scrollTop = win.scrollHeight;
      }

      messages.push({ role: 'assistant', content: fullReply });
    } catch (e) {
      console.error('Chat Error:', e);
      const loader = document.getElementById(loadingId);
      if (loader) loader.remove();
      showToast('Neural link interrupted. Please try again.', 'error');
    }
  };
}

// ------------------------------------------------------------
// ASSESSMENTS
// ------------------------------------------------------------
function renderMHAssessment(app) {
  app.innerHTML = `
    <div class="theme-mental-health" style="min-height:100vh">
      ${renderMHNav()}
      <div class="container form-container" style="padding-top:2rem;max-width:800px;margin-bottom:4rem">
        <button class="btn btn-text" onclick="history.back()">${icon('arrow_back')} Back</button>
        <h2 style="color:var(--primary);margin:1rem 0 0.5rem">Self-Assessments</h2>
        <p style="color:var(--on-surface-variant);margin-bottom:2rem">Standardized screenings to help you understand what you are experiencing. These do not replace diagnosis.</p>

        <div style="display:flex;flex-direction:column;gap:1.5rem">
          <div style="background:var(--surface-container-lowest);border:1px solid var(--surface-container-high);border-radius:var(--radius-xl);padding:1.5rem;display:flex;flex-wrap:wrap;align-items:center;gap:1.5rem">
            <div style="background:#e3f2fd;color:#1976d2;width:3.5rem;height:3.5rem;border-radius:var(--radius-full);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">${icon('psychology')}</div>
            <div style="flex:1">
              <h3 style="margin:0 0 0.25rem;color:var(--on-surface)">Depression Test (PHQ-9)</h3>
              <p style="margin:0;color:var(--on-surface-variant);font-size:0.9rem">Assess symptoms of depression and their severity.</p>
            </div>
            <button class="btn btn-outline" onclick="startMHQuiz('PHQ-9')">Start Quiz</button>
          </div>
          
          <div style="background:var(--surface-container-lowest);border:1px solid var(--surface-container-high);border-radius:var(--radius-xl);padding:1.5rem;display:flex;flex-wrap:wrap;align-items:center;gap:1.5rem">
            <div style="background:#fff3e0;color:#f57c00;width:3.5rem;height:3.5rem;border-radius:var(--radius-full);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">${icon('priority_high')}</div>
            <div style="flex:1">
              <h3 style="margin:0 0 0.25rem;color:var(--on-surface)">Anxiety Test (GAD-7)</h3>
              <p style="margin:0;color:var(--on-surface-variant);font-size:0.9rem">Evaluate levels of generalized anxiety disorder.</p>
            </div>
            <button class="btn btn-outline" onclick="startMHQuiz('GAD-7')">Start Quiz</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.startMHQuiz = (type) => {
  const qs = type === 'PHQ-9' ? [
    "Little interest or pleasure in doing things?",
    "Feeling down, depressed, or hopeless?",
    "Trouble falling or staying asleep, or sleeping too much?",
    "Feeling tired or having little energy?",
    "Poor appetite or overeating?"
  ] : [
    "Feeling nervous, anxious or on edge?",
    "Not being able to stop or control worrying?",
    "Worrying too much about different things?",
    "Trouble relaxing?",
    "Being so restless that it is hard to sit still?"
  ];

  let html = `
    <div class="theme-mental-health" style="min-height:100vh">
      ${renderMHNav()}
      <div class="container form-container" style="padding-top:2rem;max-width:700px;margin-bottom:4rem">
        <button class="btn btn-text" onclick="renderMHAssessment(document.getElementById('app'))">${icon('arrow_back')} Exit Quiz</button>
        <h2 style="color:var(--primary);margin:1rem 0 0.5rem">${type} Screening</h2>
        <p style="color:var(--on-surface-variant);margin-bottom:2rem">Over the last 2 weeks, how often have you been bothered by the following problems?</p>
        
        <form id="quizForm" onsubmit="event.preventDefault(); submitMHQuiz('${type}')" style="display:flex;flex-direction:column;gap:1.5rem">
  `;

  qs.forEach((q, i) => {
    html += `
      <div style="background:var(--surface-container-lowest);padding:1.5rem;border-radius:var(--radius-lg);border:1px solid var(--surface-container-high)">
        <p style="font-weight:600;margin:0 0 1rem;color:var(--on-surface)">${i + 1}. ${q}</p>
        <div style="display:flex;flex-wrap:wrap;gap:1rem">
          <label style="flex:1;display:flex;align-items:center;gap:0.5rem;cursor:pointer"><input type="radio" name="q${i}" value="0" required> Not at all</label>
          <label style="flex:1;display:flex;align-items:center;gap:0.5rem;cursor:pointer"><input type="radio" name="q${i}" value="1"> Several days</label>
          <label style="flex:1;display:flex;align-items:center;gap:0.5rem;cursor:pointer"><input type="radio" name="q${i}" value="2"> More than half</label>
          <label style="flex:1;display:flex;align-items:center;gap:0.5rem;cursor:pointer"><input type="radio" name="q${i}" value="3"> Nearly everyday</label>
        </div>
      </div>
    `;
  });

  html += `
          <button type="submit" class="btn btn-primary" style="padding:1rem">Submit Assessment</button>
        </form>
      </div>
    </div>
  `;
  document.getElementById('app').innerHTML = html;
};

window.submitMHQuiz = (type) => {
  const form = document.getElementById('quizForm');
  const data = new FormData(form);
  let total = 0;
  for (let v of data.values()) total += parseInt(v);

  let severity = 'Minimal';
  if (total >= 10) severity = 'Moderate';
  if (total >= 15) severity = 'Severe';

  document.getElementById('app').innerHTML = `
    <div class="theme-mental-health" style="min-height:100vh">
      ${renderMHNav()}
      <div class="container form-container" style="padding-top:4rem;max-width:600px;text-align:center">
        <div style="background:var(--primary-light);color:var(--primary);width:5rem;height:5rem;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2.5rem;margin:0 auto 1.5rem">${icon('fact_check')}</div>
        <h2 style="color:var(--primary);margin:0 0 1rem">Your ${type} Score</h2>
        <div style="font-size:4rem;font-weight:800;color:var(--on-surface);line-height:1">${total}</div>
        <div style="font-size:1.5rem;color:var(--on-surface-variant);font-weight:600;margin-top:0.5rem">${severity} Severity</div>
        
        <div style="background:var(--tertiary-light);padding:1.5rem;border-radius:var(--radius-lg);margin-top:3rem;text-align:left;border-left:4px solid var(--tertiary)">
          <h4 style="margin:0 0 0.5rem;color:var(--tertiary)">What this means</h4>
          <p style="margin:0;color:var(--on-surface-variant)">This score indicates a ${severity.toLowerCase()} level of symptoms. If you are struggling to cope, we strongly recommend reaching out to a professional therapist.</p>
        </div>
        
        <div style="display:flex;gap:1rem;margin-top:3rem;justify-content:center">
          <button class="btn btn-outline" onclick="navigate('/mental-health')">Done</button>
          <button class="btn btn-primary" onclick="navigate('/mental-health/therapists')">Find Help Now</button>
        </div>
      </div>
    </div>
  `;
};

// ------------------------------------------------------------
// RESOURCES AND EXERCISES
// ------------------------------------------------------------
function renderMHResources(app) {
  app.innerHTML = `
    <div class="theme-mental-health" style="min-height:100vh">
      ${renderMHNav()}
      <div class="container form-container" style="padding-top:2rem;max-width:900px;margin-bottom:4rem">
        <button class="btn btn-text" onclick="history.back()">${icon('arrow_back')} Back</button>
        <h2 style="color:var(--primary);margin:1rem 0 2rem">Self-Help Resources</h2>

        <h3 style="color:var(--on-surface)">Guided Breathing</h3>
        <div style="background:linear-gradient(135deg, var(--secondary-container), #e8f5fb);border-radius:var(--radius-2xl);padding:3rem 1rem;display:flex;flex-direction:column;align-items:center;margin-bottom:3rem">
          <p style="text-align:center;color:var(--on-secondary-container);margin-bottom:2rem;font-weight:600">Follow the circle. Breathe in as it expands, out as it shrinks.</p>
          <div class="breathe-circle-container">
            <div class="breathe-circle"></div>
            <div class="breathe-text">Breathe</div>
          </div>
        </div>
        
        <h3 style="color:var(--on-surface)">Curated Articles</h3>
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(250px, 1fr));gap:1.5rem;margin-bottom:3rem">
           <div style="background:var(--surface-container-lowest);border:1px solid var(--surface-container-high);border-radius:var(--radius-lg);padding:1.25rem">
            <h4 style="margin:0 0 0.5rem;color:var(--primary)">Understanding Burnout</h4>
            <p style="margin:0;color:var(--on-surface-variant);font-size:0.9rem">Learn the signs of physical and emotional exhaustion.</p>
           </div>
           <div style="background:var(--surface-container-lowest);border:1px solid var(--surface-container-high);border-radius:var(--radius-lg);padding:1.25rem">
            <h4 style="margin:0 0 0.5rem;color:var(--primary)">Sleep Hygiene 101</h4>
            <p style="margin:0;color:var(--on-surface-variant);font-size:0.9rem">5 proven ways to drastically improve your sleep quality tonight.</p>
           </div>
           <div style="background:var(--surface-container-lowest);border:1px solid var(--surface-container-high);border-radius:var(--radius-lg);padding:1.25rem">
            <h4 style="margin:0 0 0.5rem;color:var(--primary)">Grounding Techniques</h4>
            <p style="margin:0;color:var(--on-surface-variant);font-size:0.9rem">How to use the 5-4-3-2-1 method during panic attacks.</p>
           </div>
        </div>
      </div>
    </div>
  `;
}

// ------------------------------------------------------------
// FIND A THERAPIST
// ------------------------------------------------------------
function renderMHTherapists(app) {
  const tList = [
    { name: 'Dr. Aditi Sharma', spec: 'Clinical Psychologist', exp: '10 Yrs', rat: '4.9' },
    { name: 'Dr. Rahul Mehta', spec: 'CBT Therapist', exp: '8 Yrs', rat: '4.8' },
    { name: 'Ms. Sneha Rao', spec: 'Trauma Specialist', exp: '12 Yrs', rat: '5.0' }
  ];

  app.innerHTML = `
    <div class="theme-mental-health" style="min-height:100vh">
      ${renderMHNav()}
      <div class="container" style="padding-top:2rem;max-width:900px;margin-bottom:4rem">
        <button class="btn btn-text" onclick="history.back()">${icon('arrow_back')} Back</button>
        <h2 style="color:var(--primary);margin:1rem 0 2rem">Connect with a Professional</h2>
        
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:1.5rem">
          ${tList.map(t => `
            <div style="background:var(--surface-container-lowest);border:1px solid var(--surface-container-high);border-radius:var(--radius-xl);padding:1.5rem;display:flex;flex-direction:column;gap:1.25rem;box-shadow:0 4px 12px rgba(0,0,0,0.02)">
              <div style="display:flex;gap:1rem;align-items:center">
                <div style="width:4rem;height:4rem;background:var(--primary-light);border-radius:50%;color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:2rem">${icon('person')}</div>
                <div>
                  <h3 style="margin:0 0 0.25rem;color:var(--on-surface);font-size:1.1rem">${t.name}</h3>
                  <div style="color:var(--on-surface-variant);font-size:0.9rem">${t.spec}</div>
                </div>
              </div>
              <div style="display:flex;justify-content:space-between;border-top:1px solid var(--surface-container-highest);padding-top:1rem;font-size:0.875rem">
                <div style="display:flex;align-items:center;gap:0.25rem;color:var(--on-surface-variant)">${icon('work', 'text-sm')} ${t.exp} Exp</div>
                <div style="display:flex;align-items:center;gap:0.25rem;color:#fbc02d">${icon('star', 'text-sm')} ${t.rat}</div>
              </div>
              <button class="btn btn-primary" style="width:100%;justify-content:center">Book Free Consultation</button>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// SARVAM WORKFLOW (Quantum Scan & Drift)
// ============================================================
/**
 * triggerQuantumScan - Orchestrates the high-fidelity scanning handshake
 */
async function triggerQuantumScan(patientId) {
  const doc = APP.state.doctor;
  if (!doc || !doc.id) {
    showToast('Login as Doctor to perform Quantum Scan', 'error');
    navigate(`/patient/${patientId}`);
    return;
  }

  // 1. Visual Pre-Handshake (Scanner success state)
  const scannerEl = document.querySelector('.quantum-scanner-overlay');
  if (scannerEl) {
    scannerEl.classList.add('haptic-pulse');
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  }

  showToast(`<div class="micro-spinner"></div> Initializing Quantum Handshake...`, 'info');

  try {
    // 2. Perform Backend Dual-Save
    const res = await api('/api/sarvam/quantum-scan', {
      method: 'POST',
      body: {
        patientId,
        doctorId: doc.id,
        hospitalId: doc.hospital_id
      }
    });

    if (res.success) {
      showToast(`${icon('verified')} Handshake Success! Archiving to ${doc.hospital || 'Hospital'}`, 'success');

      // 3. Navigate to Patient Access (Visual Drift handled by SSE/Dashboard)
      navigate(`/patient/${patientId}?quantum_sync=true`);
    }
  } catch (err) {
    console.error('Quantum Scan Failed:', err);
    showToast('Handshake failed. Using emergency fallback.', 'warning');
    navigate(`/patient/${patientId}`);
  }
}

// ------------------------------------------------------------
// SSE (Real-Time Handshaking)
// ------------------------------------------------------------
function initDoctorSSE() {
  const doc = APP.state.doctor;
  if (!doc || APP.state.doctorSSERunning) return;

  console.log(' Initializing Doctor Quantum Link:', doc.id);
  const source = new EventSource(`/api/sse/doctor/${doc.id}`);
  APP.state.doctorSSERunning = true;

  source.addEventListener('quantum_scan_success', (e) => {
    const data = JSON.parse(e.data);
    console.log('* Quantum Handshake Verified:', data);

    // Trigger the Weightless Migration effect
    showMigrationCard(data.patient);

    // Refresh specific parts of dashboard if we are on it
    if (window.location.hash === '#/doctor-dashboard') {
      const activeTab = document.querySelector('.doc-dash-tab.active')?.dataset.tab;
      const doc = APP.state.doctor;
      if (activeTab === 'archives') {
        loadDocArchives(doc);
      } else {
        loadDocDashboard(doc);
      }
    }
  });

  source.onerror = () => {
    console.error('Doctor SSE Link severed. Reconnecting...');
    APP.state.doctorSSERunning = false;
    source.close();
    setTimeout(initDoctorSSE, 5000);
  };
}

function initPatientSSE() {
  const p = APP.state.patient;
  if (!p || APP.state.patientSSERunning) return;

  console.log(' Initializing Patient Identity Link:', p.id);
  const source = new EventSource(`/api/sse/patient/${p.id}`);
  APP.state.patientSSERunning = true;

  source.addEventListener('access_grant', (e) => {
    const data = JSON.parse(e.data);
    showToast(`${icon('verified')} Identity shared with ${data.accessor_name}`, 'success');
  });

  source.onerror = () => {
    APP.state.patientSSERunning = false;
    source.close();
    setTimeout(initPatientSSE, 5000);
  };
}

/**
 * showMigrationCard - The 'SARVAM' Weightless Migration Effect
 * Animates a patient card 'drifting' into the workspace.
 */
function showMigrationCard(patient) {
  const container = document.body;
  const card = document.createElement('div');
  card.className = 'drifting-card glass-morphism p-4 rounded-2xl shadow-float fixed bottom-8 right-8 z-50 bg-white/10 backdrop-blur-xl border border-white/20';
  card.style.width = '320px';
  card.style.display = 'flex';
  card.style.alignItems = 'center';
  card.style.gap = '1rem';

  card.innerHTML = `
    <div style="width:3.5rem;height:3.5rem;background:var(--primary-gradient);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:1.25rem shadow-lg">
      ${patient.name.charAt(0)}
    </div>
    <div style="flex:1">
      <h4 style="margin:0;color:white;font-size:1rem">${patient.name}</h4>
      <p style="margin:0;color:white/60;font-size:0.7rem;font-weight:700;letter-spacing:0.1em">IDENTITY ARCHIVED</p>
    </div>
    <div class="success-glow">${icon('verified')}</div>
    <div class="stream-particles"></div>
  `;

  container.appendChild(card);

  // Haptic Feedback for the migration
  if (navigator.vibrate) navigator.vibrate(50);

  // Auto-remove after animation
  setTimeout(() => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(-20px) scale(0.95)';
    card.style.transition = 'all 0.5s ease-in';
    setTimeout(() => card.remove(), 500);
  }, 4000);
}

// ============================================================
// INFORMATIONAL PAGES (Privacy, Terms, HIPAA)
// ============================================================

function renderInfoPage(app, title, iconName, sections) {
  app.innerHTML = `${navbar()}
  <div class="page-enter info-page">
    <section class="info-hero">
      <div class="info-hero-glow"></div>
      <div class="container" style="position:relative;z-index:2">
        <div class="info-icon-container stagger-entry">
          ${icon(iconName)}
        </div>
        <h1 class="info-title stagger-entry" style="animation-delay:0.1s">${title}</h1>
        <p class="stagger-entry" style="animation-delay:0.2s;max-width:600px;margin:0 auto;color:var(--on-surface-variant);font-size:1.1rem">
          Ensuring your medical identity remains secure, clinical, and universal.
        </p>
      </div>
    </section>

    <div class="container">
      <div class="info-grid">
        ${sections.map((s, i) => `
          <div class="info-section-card stagger-entry" style="animation-delay:${0.3 + i * 0.1}s">
            <h2 style="color:var(--primary);margin-bottom:1rem">
              ${icon(s.icon || 'arrow_right_alt', 'text-primary')} ${s.heading}
            </h2>
            <p>${s.text}</p>
          </div>
        `).join('')}
      </div>

      <div class="info-footer stagger-entry" style="animation-delay:${0.3 + sections.length * 0.1}s">
        <a href="#/" class="btn btn-primary btn-lg">
          ${icon('home')} Return to Sarvam Hub
        </a>
      </div>
    </div>
  </div>`;
}

function renderPrivacy(app) {
  const sections = [
    {
      heading: '1. Data Collection & Resonance',
      icon: 'spatial_tracking',
      text: 'Sarvam Health collects minimal personal identifiers (Name, DOB, Blood Group) to generate your unique Health QR. In accordance with our "Spatial Resonance" protocol, geolocation data is used only for real-time provider discovery and is never stored on persistent storage without explicit consent.'
    },
    {
      heading: '2. Quantum Encryption',
      icon: 'security',
      text: 'All medical records are encrypted using AES-256 GCM logic. Emergency data is accessible instantly via QR scan, while full clinical history remains locked behind dynamic OTP verification, ensuring your identity remains under your total control.'
    },
    {
      heading: '3. Handshake Transparency',
      icon: 'handshake',
      text: 'We do not sell medical data. Verified healthcare providers are granted temporary analytical access only when a handshake is established via QR or Appointment scheduling. Every interaction is logged in your personal audit trail.'
    }
  ];
  renderInfoPage(app, 'Privacy Policy', 'shield_lock', sections);
}

function renderTerms(app) {
  const sections = [
    {
      heading: '1. Universal Health Identity',
      icon: 'fingerprint',
      text: 'By registering with Sarvam, you create a universal health identity node. You are responsible for the accuracy of the medical information provided. Accuracy in blood group and allergy data is critical for safe emergency interventions.'
    },
    {
      heading: '2. Clinical Bridge Mechanism',
      icon: 'hub',
      text: 'The "SARVAM" handshake between patients and doctors constitutes a formal medical consultation. Sarvam acts as the secure bridge but does not take liability for the clinical advice provided by independent practitioners.'
    },
    {
      heading: '3. Termination & Session Purge',
      icon: 'delete_sweep',
      text: 'You may request a "Session Purge" at any time, which will remove your identity node from our primary directory. Anonymized clinical logs may remain for regulatory compliance and audit purposes.'
    }
  ];
  renderInfoPage(app, 'Terms of Service', 'gavel', sections);
}

function renderHIPAA(app) {
  const sections = [
    {
      heading: '1. Secure PHI Siloing',
      icon: 'admin_panel_settings',
      text: 'Protected Health Information (PHI) is handled with strict adherence to universal privacy standards. Our architecture ensures that PHI is siloed and only decrypted during an active clinical session authorized by the patient-node.'
    },
    {
      heading: '2. Real-time Audit Logging',
      icon: 'history_edu',
      text: 'Every access to a medical record is logged with a temporal stamp and the identity of the healthcare provider. This distributed audit trail is available to the patient at any time for total transparency and trust.'
    },
    {
      heading: '3. Compliance Framework',
      icon: 'verified_user',
      text: 'Sarvam utilizes high-security cloud endpoints that are HIPAA-certified. We employ multi-layered defensive protocols to ensure your medical history is protected by the same standards used by global medical institutions.'
    }
  ];
  renderInfoPage(app, 'HIPAA Compliance', 'clinical_notes', sections);
}

async function handleContactSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('contact-btn');
  const original = btn.innerHTML;

  const data = {
    name: document.getElementById('contact-name').value,
    email: document.getElementById('contact-email').value,
    phone: document.getElementById('contact-phone').value,
    type: document.getElementById('contact-type').value,
    message: document.getElementById('contact-message').value
  };

  try {
    btn.disabled = true;
    btn.innerHTML = `${icon('sync', 'spin')} Sending...`;

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();
    if (result.success) {
      showToast('Message Sent! We will get back to you soon.', 'success');
      document.getElementById('contact-form').reset();
    } else {
      showToast(result.error || 'Failed to send message', 'error');
    }
  } catch (err) {
    console.error('Submission Error:', err);
    showToast('Network error. Please check your connection.', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

function renderAbout(app) {
  const owners = [
    {
      name: 'Meet Ukani',
      role: 'SARVAM Owner',
      phone: '+91 11111 11111',
      email: 'meet.ukani@sarvam.health',
      availability: 'Mon-Sat, 10 AM - 5 PM',
      photo: '/founder_meet.png'
    },
    {
      name: 'Prahlad Bhat',
      role: 'SARVAM Owner',
      phone: '+91 22222 22222',
      email: 'prahlad.bhat@sarvam.health',
      availability: 'Mon-Sat, 10 AM - 5 PM',
      photo: '/founder_prahlad.png'
    },
    {
      name: 'Anjali Gupta',
      role: 'SARVAM Owner',
      phone: '+91 33333 33333',
      email: 'anjali.gupta@sarvam.health',
      availability: 'Mon-Sat, 10 AM - 5 PM',
      photo: '/founder_anjali.png'
    }
  ];

  app.innerHTML = `${navbar()}
  <div class="page-enter">
    <section class="about-hero">
      <div class="container stagger-entry">
        <h1 style="font-size:3.5rem;margin-bottom:1.5rem">Get In Touch With Us</h1>
        <p style="font-size:1.25rem;max-width:700px;margin:0 auto;opacity:0.9">
          We're here to help! Reach out to us for any inquiries about our services or just to say hello.
        </p>
      </div>
    </section>

    <div class="container">
      <h2 class="text-center stagger-entry" style="margin-bottom:3rem;font-size:2rem">Meet Our Visionaries</h2>
      
      <div class="owner-grid">
        ${owners.map((o, i) => `
          <div class="owner-card stagger-entry" style="animation-delay:${0.2 + i * 0.1}s">
            <img src="${o.photo}" alt="${o.name}" class="owner-photo">
            <div class="owner-details">
              <h3>${o.name}</h3>
              <div class="owner-role">${o.role}</div>
              <div class="owner-contact-item">${icon('phone')} ${o.phone}</div>
              <div class="owner-contact-item">${icon('mail')} ${o.email}</div>
              <div class="owner-contact-item">${icon('schedule')} ${o.availability}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="contact-section stagger-entry" style="animation-delay:0.6s">
        <div class="contact-card">
          <div class="text-center mb-4">
            <h2 style="font-size:2.25rem;margin-bottom:0.5rem">Send Us A Message</h2>
            <p class="text-muted">Fill out the form below and we'll get back to you as soon as possible.</p>
          </div>

          <form id="contact-form" onsubmit="handleContactSubmit(event)">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" id="contact-name" class="form-input" placeholder="Enter your full name" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Email Address *</label>
                <input type="email" id="contact-email" class="form-input" placeholder="your.email@example.com" required>
              </div>
              <div class="form-group">
                <label class="form-label">Phone Number *</label>
                <input type="tel" id="contact-phone" class="form-input" placeholder="10-digit phone number">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Inquiry Type *</label>
              <select id="contact-type" class="form-select">
                <option>General Inquiry</option>
                <option>Business Partnership</option>
                <option>Technical Support</option>
                <option>Others</option>
              </select>
            </div>

            <div class="form-group">
              <label class="form-label">Your Message *</label>
              <textarea id="contact-message" class="form-input" placeholder="Tell us more about your inquiry..." required></textarea>
            </div>

            <button type="submit" id="contact-btn" class="btn btn-primary btn-lg btn-block">
              ${icon('send')} Send Message
            </button>
          </form>
        </div>
      </div>

      <div class="urgent-box stagger-entry" style="margin-top:4rem; border-color: rgba(255, 171, 0, 0.4); background: rgba(255,171,0,0.08)">
        <div class="urgent-icon">${icon('warning')}</div>
        <h3 style="color:black">Need Urgent Support?</h3>
        <p>For immediate technical assistance or critical platform inquiries, please call our support line directly.</p>
        <a href="tel:+918799622618" class="urgent-btn">
          ${icon('call')} +91 87996 22618
        </a>
      </div>

      <div class="info-footer stagger-entry" style="animation-delay:0.8s; margin-top:2rem">
        <a href="#/" class="btn btn-outline btn-lg">
          ${icon('home')} Return to Sarvam Hub
        </a>
      </div>
    </div>
  </div>`;

  window.scrollTo(0, 0);
}






