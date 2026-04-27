// ============================================================
// Sarvam - Smart Healthcare Solutions (Pages Part 2)
// Doctor, Scanner, Emergency, Clinical, Admin
// ============================================================

// ============================================================
// DOCTOR AUTH
// ============================================================
function renderDoctorAuth(app) {
  if (APP.state.doctor && APP.state.doctor.id) { navigate('/doctor-dashboard'); return; }

  let pendingEmail = '';
  let countdownTimer = null;
  let devOtp = null;

  const showCredStep = () => {
    if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
    app.innerHTML = `${navbar()}
    <div class="page-enter container" style="padding:2rem 0">
      <div class="tabs" style="max-width:480px;margin:0 auto 0">
        <button class="tab-btn active" data-tab="login">Login</button>
        <button class="tab-btn" onclick="navigate('/doctor-register')">Register</button>
      </div>
      <div id="doc-login" class="login-card" style="margin-top:0">
        <h2>${icon('stethoscope')} Doctor Login</h2><p>Access your clinical dashboard</p>
        <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="doc-email" type="email" placeholder="doctor@hospital.com"></div>
        <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="doc-pass" type="password" placeholder="********"></div>
        <div style="text-align:right;margin-top:-0.5rem;margin-bottom:1.5rem">
          <a href="#/forgot-password?from=doctor" style="font-size:0.8125rem;color:var(--primary);font-weight:600">Forgot Password?</a>
        </div>
        <button class="btn btn-primary btn-block" id="doc-login-btn">${icon('login')} Login</button>
      </div>
    </div>`;

    document.querySelectorAll('.tab-btn[data-tab]').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('doc-login').classList.remove('hidden');
      };
    });

    document.getElementById('doc-login-btn').onclick = doDocLogin;
    document.getElementById('doc-pass').onkeydown = e => { if (e.key === 'Enter') doDocLogin(); };
  };

  const showOtpStep = (email, userName, dOtp) => {
    devOtp = dOtp;
    pendingEmail = email;

    const loginCard = document.getElementById('doc-login');
    if (!loginCard) return;
    loginCard.innerHTML = `
      <div style="text-align:center;margin-bottom:1.5rem">
        <div style="width:3.5rem;height:3.5rem;border-radius:50%;background:var(--secondary-container);color:var(--on-secondary-container);display:flex;align-items:center;justify-content:center;margin:0 auto 1rem;font-size:1.75rem">${icon('mark_email_read')}</div>
        <h2>Verify Your Identity</h2>
        <p>A 6-digit code was sent to <strong>${email}</strong></p>
      </div>

      ${devOtp ? `
      <div class="card mb-3" style="background:var(--secondary-container);border:1px dashed var(--secondary);padding:1rem;text-align:center">
        <div style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--secondary);font-weight:700;margin-bottom:0.5rem">
          ${icon('speed')} Network Delay Fallback
        </div>
        <div style="font-size:1.5rem;font-weight:800;color:var(--on-secondary-container);letter-spacing:0.25rem">
          ${devOtp}
        </div>
        <p style="font-size:0.75rem;color:var(--on-secondary-container);margin-top:0.5rem;opacity:0.8">
          Please use this code to continue
        </p>
      </div>
      ` : ''}

      <div class="ir-field-wrap" style="margin-bottom:1rem">
        <label class="ir-label">${icon('dialpad')} 6-Digit Verification Code</label>
        <div class="ir-otp-row" id="doc-otp-row">
          ${[0,1,2,3,4,5].map(i => `<input class="ir-otp-box" id="dotp-${i}" type="text" maxlength="1" inputmode="numeric" pattern="[0-9]">`).join('')}
        </div>
      </div>
      <div class="ir-ttl" style="margin-bottom:1rem">${icon('schedule')} Code expires in <span id="doc-ttl-count">05:00</span></div>
      <button class="btn btn-primary btn-block mb-2" id="doc-otp-verify-btn">${icon('verified_user')} Verify & Login</button>
      <button class="btn btn-text btn-block text-muted" id="doc-otp-back-btn" style="font-size:0.875rem">${icon('arrow_back')} Back</button>`;

    const boxes = Array.from({length:6}, (_,i) => document.getElementById(`dotp-${i}`));
    boxes[0].focus();
    boxes.forEach((box, i) => {
      box.oninput = e => {
        const v = e.target.value.replace(/\D/g,''); box.value = v;
        if (v && i < 5) boxes[i+1].focus();
        if (boxes.every(b => b.value)) document.getElementById('doc-otp-verify-btn')?.click();
      };
      box.onkeydown = e => {
        if (e.key === 'Backspace' && !box.value && i > 0) { boxes[i-1].focus(); boxes[i-1].value = ''; }
        if (e.key === 'ArrowLeft' && i > 0) boxes[i-1].focus();
        if (e.key === 'ArrowRight' && i < 5) boxes[i+1].focus();
      };
      box.onpaste = e => {
        const paste = (e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
        paste.split('').forEach((ch,j) => { if (boxes[j]) boxes[j].value = ch; });
        e.preventDefault();
        if (boxes.every(b => b.value)) setTimeout(() => document.getElementById('doc-otp-verify-btn')?.click(), 100);
      };
    });

    let remaining = 5 * 60;
    const ttlEl = document.getElementById('doc-ttl-count');
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(countdownTimer);
        if (ttlEl) ttlEl.textContent = '00:00 (expired)';
        const vBtn = document.getElementById('doc-otp-verify-btn');
        if (vBtn) vBtn.disabled = true;
        return;
      }
      const m = String(Math.floor(remaining/60)).padStart(2,'0');
      const s = String(remaining%60).padStart(2,'0');
      if (ttlEl) ttlEl.textContent = `${m}:${s}`;
    }, 1000);



    document.getElementById('doc-otp-back-btn').onclick = () => showCredStep();

    document.getElementById('doc-otp-verify-btn').onclick = async () => {
      const otp = boxes.map(b => b.value).join('');
      if (otp.length !== 6) { showToast('Enter all 6 digits', 'error'); return; }
      const btn = document.getElementById('doc-otp-verify-btn');
      btn.disabled = true; btn.innerHTML = `<span class="ir-pulse-dot"></span> Verifying...`;
      try {
        const data = await api('/api/auth/login-verify-otp', { method: 'POST', body: { email: pendingEmail, role: 'doctor', otp } });
        setDeviceToken('doctor', data.device_token);
        APP.state.doctor = data.doctor;
        APP.state.recentPatients = data.recent_patients;
        saveSession('uhqr_doctor', data.doctor);
        if (countdownTimer) clearInterval(countdownTimer);
        showToast('Welcome, Dr. ' + data.doctor.name, 'success');
        navigate('/doctor-dashboard');
      } catch (e) {
        btn.disabled = false; btn.innerHTML = `${icon('verified_user')} Verify & Login`;
        boxes.forEach(b => { b.classList.add('ir-otp-error'); setTimeout(() => b.classList.remove('ir-otp-error'), 600); });
      }
    };
  };

  showCredStep();

  async function doDocLogin() {
    const email = document.getElementById('doc-email')?.value;
    const password = document.getElementById('doc-pass')?.value;
    if (!email || !password) { showToast('Enter email and password', 'error'); return; }
    const btn = document.getElementById('doc-login-btn');
    btn.disabled = true; btn.innerHTML = `<span class="ir-pulse-dot"></span> Signing in...`;
    try {
      const data = await api('/api/doctors/login', {
        method: 'POST', body: { email, password },
        headers: { 'X-Device-Token': getDeviceToken('doctor') }
      });
      if (data.requires_verification) {
        if (data.dev_otp) alert(`Network Delay: Your OTP is ${data.dev_otp} (Please use this to continue)`);
        showToast(data.email_sent ? `Code sent to ${email}` : 'Dev mode: OTP shown below', data.email_sent ? 'success' : 'info');
        showOtpStep(email, data.user_name, data.dev_otp || null);
      } else {
        setDeviceToken('doctor', data.device_token);
        APP.state.doctor = data.doctor;
        APP.state.recentPatients = data.recent_patients;
        saveSession('uhqr_doctor', data.doctor);
        showToast('Welcome, Dr. ' + data.doctor.name, 'success');
        navigate('/doctor-dashboard');
      }
    } catch (e) {
      btn.disabled = false; btn.innerHTML = `${icon('login')} Login`;
    }
  }
}

// ============================================================
// DOCTOR DASHBOARD - Redesigned with Appointments + Profile tabs
// ============================================================
function renderDoctorDashboard(app) {
  const doc = APP.state.doctor;
  if (!doc) { navigate('/doctor-login'); return; }

  app.innerHTML = `${navbar()}
  <div class="page-enter container" style="padding:8rem 0 3rem">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem">
      <div><h1 style="font-size:1.75rem">Doctor Dashboard</h1><p class="text-muted">Manage your appointments and availability</p></div>
      <div style="display:flex;gap:0.75rem">
        <a href="#/scan" class="btn btn-secondary btn-sm">${icon('qr_code_scanner')} Scan QR</a>
        <a href="#/add-prescription" class="btn btn-secondary btn-sm">${icon('edit_note')} Prescription</a>
        <button data-action="logout" data-target="/doctor-login" data-role="doctor" class="btn btn-outline btn-sm">${icon('logout')} Logout</button>

      </div>
    </div>
    <div id="doctor-notifications"></div>


    <!-- Stats Grid -->
    <div class="doc-stats-grid" id="doc-stats">
      <div class="doc-stat-card"><span class="doc-stat-label">Total Appointments</span><span class="doc-stat-value" id="stat-total">-</span></div>
      <div class="doc-stat-card"><span class="doc-stat-label">Upcoming</span><span class="doc-stat-value" id="stat-upcoming" style="color:var(--success)">-</span></div>
      <div class="doc-stat-card"><span class="doc-stat-label">Pending</span><span class="doc-stat-value" id="stat-pending" style="color:#E65100">-</span></div>
      <div class="doc-stat-card"><span class="doc-stat-label">Consultation Fee</span><span class="doc-stat-value" id="stat-fee" style="color:var(--primary)">&#8377;${doc.consultation_fee||500}</span></div>
    </div>

    <!-- Tabs -->
    <div class="doc-dash-tabs" id="doc-tabs">
      <button class="doc-dash-tab active" data-tab="appointments">${icon('calendar_month')} Appointments</button>
      <button class="doc-dash-tab" data-tab="archives">${icon('history_edu')} Quantum History</button>
      <button class="doc-dash-tab" data-tab="profile">${icon('settings')} Profile & Availability</button>
    </div>

    <!-- Tab Content -->
    <div id="doc-tab-content"></div>
  </div>`;

  // Load appointments data
  loadDocDashboard(doc);
  initDoctorSSE(doc);


  // Tab switching
  document.querySelectorAll('.doc-dash-tab').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.doc-dash-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === btn.dataset.tab));
      if (btn.dataset.tab === 'appointments') loadDocAppointments(doc);
      else if (btn.dataset.tab === 'archives') loadDocArchives(doc);
      else showDocProfile(doc);
    };
  });
}

async function loadDocArchives(doc) {
  const c = document.getElementById('doc-tab-content');
  if (!c) return;
  c.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner" style="border-top-color:var(--secondary)"></div></div>`;
  
  try {
    const data = await api(`/api/doctors/${doc.id}/archives`);
    const archives = data.archives || [];
    
    if (archives.length === 0) {
      c.innerHTML = `
        <div class="text-center" style="padding:4rem 2rem; background: var(--surface-container-low); border-radius: var(--radius-xl)">
          <div style="font-size:3.5rem; color:var(--outline-variant); margin-bottom:1rem">${icon('history_edu')}</div>
          <h3 style="color:var(--on-surface-variant)">No Quantum History</h3>
          <p class="text-muted" style="max-width:320px; margin:0 auto 1.5rem">Patients you scan via the Sarvam handshake will appear here for 10-minute high-security access.</p>
          <a href="#/scan" class="btn btn-primary">${icon('qr_code_scanner')} Start Scanning</a>
        </div>`;
      return;
    }

    c.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
        <h3 style="display:flex; align-items:center; gap:0.5rem">${icon('auto_awesome')} Active History</h3>
        <span class="badge badge-info">${archives.length} Records Synced</span>
      </div>
      <div class="archives-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(300px, 1fr)); gap:1.25rem">
        ${archives.map(a => renderArchiveCard(a)).join('')}
      </div>`;
  } catch (err) {
    c.innerHTML = `<div class="text-center text-danger" style="padding:3rem">${icon('error')} Failed to load history.</div>`;
  }
}

function renderArchiveCard(a) {
  const syncTime = new Date(a.sync_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `
    <div class="apt-card drifting-card" style="border-left:4px solid var(--secondary); background: linear-gradient(to right, rgba(0, 210, 255, 0.05), transparent); cursor:pointer" onclick="navigate('/patient/${a.patient_id}')">
      <div class="apt-card-header">
        <div style="display:flex; align-items:center; gap:0.75rem">
          <div class="avatar-sm" style="background:var(--secondary-container); color:var(--on-secondary-container)">${a.photo ? `<img src="${a.photo}">` : a.patient_name.charAt(0)}</div>
          <div>
            <strong style="font-size:1rem">${a.patient_name}</strong>
            <div style="font-size:0.75rem; color:var(--secondary); font-weight:700; text-transform:uppercase; letter-spacing:0.05em">Synced at ${syncTime}</div>
          </div>
        </div>
        <div class="success-glow">${icon('verified')}</div>
      </div>
      <div class="apt-card-details" style="margin-top:0.75rem">
        <span class="badge badge-outline">${icon('water_drop')} ${a.blood_group || '-'}</span>
        <span class="badge badge-success" style="font-size:0.7rem">${icon('sync')} ${a.status.toUpperCase()}</span>
      </div>
    </div>`;
}

async function loadDocDashboard(doc) {
  try {
    const data = await api(`/api/doctors/${doc.id}/appointments`);
    APP.state.docAppointments = data.appointments || [];
    APP.state.docStats = data.stats || {};
    document.getElementById('stat-total').textContent = data.stats.total || 0;
    document.getElementById('stat-upcoming').textContent = data.stats.upcoming || 0;
    document.getElementById('stat-pending').textContent = data.stats.pending || 0;
  } catch(e) {}
  loadDocAppointments(doc);
}

function loadDocAppointments(doc) {
  const apts = APP.state.docAppointments || [];
  const c = document.getElementById('doc-tab-content');
  if (!c) return;
  
  const pending = apts.filter(a => a.status === 'pending');
  const confirmed = apts.filter(a => a.status === 'confirmed');
  const cancelled = apts.filter(a => a.status === 'cancelled');

  let html = '';

  // Pending Requests Tray
  if (pending.length) {
    html += `
    <div class="card mb-3" style="border:1px solid var(--warning-light); background: rgba(255,152,0,0.02)">
      <h3 style="margin-bottom:1.5rem;display:flex;align-items:center;gap:0.5rem;color:var(--warning)">${icon('pending_actions')} Pending Requests</h3>
      <div class="requests-tray">
        ${pending.map(a => `
          <div class="apt-card apt-request-card" style="border-left:4px solid var(--warning)">
            <div class="apt-card-header">
              <div style="display:flex;align-items:center;gap:0.5rem">
                ${icon('person')} <strong>${a.patient_name || 'Patient'}</strong>
              </div>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-primary btn-sm approve-apt-btn" data-id="${a.id}">${icon('check')} Approve</button>
                <button class="btn btn-outline btn-sm decline-apt-btn" data-id="${a.id}" style="color:var(--tertiary);border-color:var(--tertiary)">${icon('close')} Decline</button>
              </div>
            </div>
            <div class="apt-card-details">
              <span>${icon('calendar_month')} ${fmtDate(a.date)}</span>
              <span>${icon('schedule')} ${a.time_slot || '-'}</span>
            </div>
            ${a.notes ? `<div class="apt-reason"><p style="margin:0">${a.notes}</p></div>` : ''}
          </div>
        `).join('')}
      </div>
    </div>`;
  }

  // My Appointments (Confirmed/History)
  html += `<div class="card" style="padding:2rem">
    <h3 style="margin-bottom:1.5rem;display:flex;align-items:center;gap:0.5rem">${icon('calendar_month')} My Appointments</h3>
    ${confirmed.length === 0 && cancelled.length === 0 ? `
      <div class="text-center" style="padding:3rem"><p class="text-muted">${icon('event_busy')} No confirmed appointments.</p></div>
    ` : `
      ${confirmed.map(a => renderAptCard(a, 'confirmed')).join('')}
      ${cancelled.length ? `<h4 class="mt-4 mb-2 text-muted" style="font-size:0.875rem">Cancelled</h4>` : ''}
      ${cancelled.map(a => renderAptCard(a, 'cancelled')).join('')}
    `}
  </div>`;

  c.innerHTML = html;

  // Bind buttons
  document.querySelectorAll('.approve-apt-btn').forEach(btn => {
    btn.onclick = async () => {
      try {
        await api(`/api/appointments/${btn.dataset.id}/approve`, { method: 'PATCH' });
        showToast('Appointment approved', 'success');
        loadDocDashboard(doc);
      } catch(e) {}
    }
  });
  document.querySelectorAll('.decline-apt-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Decline this appointment request?')) return;
      try {
        await api(`/api/appointments/${btn.dataset.id}/cancel`, { method: 'PATCH' });
        showToast('Appointment declined', 'info');
        loadDocDashboard(doc);
      } catch(e) {}
    }
  });
  document.querySelectorAll('.cancel-apt-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Cancel this appointment?')) return;
      try {
        await api(`/api/appointments/${btn.dataset.id}/cancel`, { method: 'PATCH' });
        showToast('Appointment cancelled', 'success');
        loadDocDashboard(doc);
      } catch(e) {}
    };
  });
}

function renderAptCard(a, status) {
  const isCancelled = status === 'cancelled';
  const color = isCancelled ? 'var(--tertiary)' : 'var(--success)';
  return `
    <div class="apt-card" style="border-left:4px solid ${color}">
      <div class="apt-card-header">
        <div style="display:flex;align-items:center;gap:0.5rem">
          ${icon('person')} <strong>${a.patient_name || 'Patient'}</strong>
        </div>
        ${!isCancelled ? `<button class="btn btn-outline btn-sm cancel-apt-btn" data-id="${a.id}" style="color:var(--tertiary);border-color:var(--tertiary-light)">
          ${icon('close')} Cancel</button>` : ''}
      </div>
      <span class="apt-status-badge ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
      <div class="apt-card-details">
        <span>${icon('calendar_month')} ${fmtDate(a.date)}</span>
        <span>${icon('schedule')} ${a.time_slot || '-'}</span>
      </div>
      ${a.patient_phone ? `<p style="font-size:0.8125rem;margin-top:0.5rem;display:flex;align-items:center;gap:0.375rem">${icon('call')} ${a.patient_phone}</p>` : ''}
    </div>`;
}

function initDoctorSSE(doc) {
  if (!doc || APP.state.doctorSSERunning) return;
  APP.state.doctorSSERunning = true;
  const ev = new EventSource(window.API_BASE_URL + `/api/sse/doctor/${doc.id}`);
  
  ev.addEventListener('new_request', (e) => {
    const data = JSON.parse(e.data);
    const apt = data.appointment;
    
    // Play sound or show floating notification
    showDriftingNotification(`New Appointment Request`, `Patient: ${apt.patient_name}`);
    loadDocDashboard(doc); // Refresh dashboard to show the new card
  });
}

function showDriftingNotification(title, body) {
  const container = document.getElementById('doctor-notifications');
  if (!container) return;
  
  const id = 'notif-' + Date.now();
  const html = `
    <div class="drifting-notification" id="${id}">
      <div style="display:flex;align-items:center;gap:0.75rem">
        <div style="background:var(--warning-light);color:var(--warning);width:2.5rem;height:2.5rem;border-radius:50%;display:flex;align-items:center;justify-content:center">
          ${icon('notification_important')}
        </div>
        <div>
          <h4 style="margin:0;font-size:0.9375rem">${title}</h4>
          <p class="text-muted" style="margin:0.25rem 0 0;font-size:0.8125rem">${body}</p>
        </div>
        <button onclick="this.parentElement.parentElement.remove()" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--outline)">${icon('close')}</button>
      </div>
    </div>
  `;
  container.insertAdjacentHTML('beforeend', html);
  
  // Auto remove after 10s
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.style.opacity = '0';
    setTimeout(() => el?.remove(), 500);
  }, 10000);
}

function showDocProfile(doc) {
  const days = (doc.available_days || 'Mon,Tue,Wed,Thu,Fri').split(',').map(d => d.trim());
  const allDays = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const specs = ['Orthopedic','Cardiology','Neurology','Dermatology','Pediatrics','Ophthalmology','ENT','Psychiatry','General Medicine','Gynecology','Dentistry','Radiology'];

  const c = document.getElementById('doc-tab-content');
  let currentPhotoBase64 = doc.profile_photo;

  c.innerHTML = `<div class="card" style="padding:2rem">
    <div class="photo-upload-section" style="display:flex;align-items:center;gap:2rem;margin-bottom:2.5rem;padding-bottom:2rem;border-bottom:1px solid var(--surface-container-high)">
      <div class="photo-preview-wrapper" style="position:relative">
        <div id="doc-pf-photo-preview" class="photo-preview" style="width:120px;height:120px;border-radius:50%;background:var(--surface-container-high);display:flex;align-items:center;justify-content:center;overflow:hidden;border:4px solid #fff;box-shadow:var(--shadow-md)">
          ${doc.profile_photo ? `<img src="${doc.profile_photo}" style="width:100%;height:100%;object-fit:cover">` : icon('person', 'icon-xl')}
        </div>
        <label for="doc-pf-photo-input" style="position:absolute;bottom:0;right:0;width:36px;height:36px;border-radius:50%;background:var(--secondary);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;border:3px solid #fff;box-shadow:var(--shadow-sm)">
          ${icon('photo_camera', 'style="font-size:1.25rem"')}
        </label>
        <input type="file" id="doc-pf-photo-input" accept="image/*" hidden>
      </div>
      <div>
        <h3 style="margin:0 0 0.5rem">Profile Photo</h3>
        <p class="text-muted" style="font-size:0.875rem;max-width:300px">Your photo will be visible to patients and in search results.</p>
        <label for="doc-pf-photo-input" class="btn btn-outline btn-sm" style="margin-top:0.75rem;cursor:pointer">Change Photo</label>
      </div>
    </div>

    <h3 style="margin-bottom:1.5rem;display:flex;align-items:center;gap:0.5rem">${icon('person')} Doctor Profile</h3>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Full Name</label><input class="form-input" id="dp-name" value="${doc.name||''}"></div>
      <div class="form-group"><label class="form-label">Specialization</label>
        <select class="form-select" id="dp-spec">${specs.map(s=>`<option ${doc.specialization===s?'selected':''}>${s}</option>`).join('')}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Hospital / Clinic</label><input class="form-input" id="dp-hospital" value="${doc.hospital||''}"></div>
      <div class="form-group"><label class="form-label">License Number</label><input class="form-input" value="${doc.license_number||''}" disabled style="opacity:0.6"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="dp-phone" value="${doc.phone||''}"></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="dp-email" value="${doc.email||''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Experience (years)</label><input class="form-input" id="dp-exp" type="number" value="${doc.experience_years||0}" min="0"></div>
      <div class="form-group"><label class="form-label">Consultation Fee (&#8377;)</label><input class="form-input" id="dp-fee" type="number" value="${doc.consultation_fee||500}" min="0"></div>
    </div>
    <div class="form-group"><label class="form-label">Bio</label><textarea class="form-input" id="dp-bio" rows="3" placeholder="Brief introduction about yourself...">${doc.bio||''}</textarea></div>

    <h4 style="margin:1.5rem 0 0.75rem;font-weight:600">Available Days</h4>
    <div class="day-toggle-grid" id="day-toggles">
      ${allDays.map(d => `<button class="day-toggle ${days.includes(d)?'active':''}" data-day="${d}">${d}</button>`).join('')}
    </div>

    <h4 style="margin:1.5rem 0 0.75rem;font-weight:600">Available Time Slots</h4>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Start Time</label><input class="form-input" id="dp-start" type="time" value="${doc.available_start||'09:00'}"></div>
      <div class="form-group"><label class="form-label">End Time</label><input class="form-input" id="dp-end" type="time" value="${doc.available_end||'17:00'}"></div>
    </div>
    <p style="display:flex;align-items:center;gap:0.375rem;font-size:0.875rem;color:var(--on-surface-variant);margin-bottom:1.5rem">${icon('schedule')} ${doc.available_start||'09:00'} - ${doc.available_end||'17:00'}</p>

    <button class="btn btn-primary" id="save-doc-profile">${icon('save')} Save Profile & Availability</button>
  </div>`;

  // Logic for photo input
  const photoInput = document.getElementById('doc-pf-photo-input');
  if (photoInput) {
    photoInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (re) => {
          currentPhotoBase64 = re.target.result;
          const preview = document.getElementById('doc-pf-photo-preview');
          preview.innerHTML = `<img src="${currentPhotoBase64}" style="width:100%;height:100%;object-fit:cover">`;
        };
        reader.readAsDataURL(file);
      }
    };
  }

  // Day toggles
  document.querySelectorAll('.day-toggle').forEach(btn => {
    btn.onclick = () => btn.classList.toggle('active');
  });

  // Save handler
  document.getElementById('save-doc-profile').onclick = async () => {
    const selectedDays = [...document.querySelectorAll('.day-toggle.active')].map(b => b.dataset.day).join(',');
    const body = {
      name: document.getElementById('dp-name').value,
      specialization: document.getElementById('dp-spec').value,
      hospital: document.getElementById('dp-hospital').value,
      phone: document.getElementById('dp-phone').value,
      email: document.getElementById('dp-email').value,
      experience_years: document.getElementById('dp-exp').value,
      consultation_fee: document.getElementById('dp-fee').value,
      bio: document.getElementById('dp-bio').value,
      available_days: selectedDays,
      available_start: document.getElementById('dp-start').value,
      available_end: document.getElementById('dp-end').value,
      profile_photo: currentPhotoBase64
    };
    try {
      const data = await api(`/api/doctors/${doc.id}`, { method: 'PUT', body });
      Object.assign(APP.state.doctor, data.doctor);
      saveSession('uhqr_doctor', APP.state.doctor);
      document.getElementById('stat-fee').textContent = ',1' + (data.doctor.consultation_fee||500);
      showToast('Profile updated!', 'success');
    } catch(e) {}
  };
}

// ============================================================
// QR SCANNER
// ============================================================
function renderScanner(app) {
  app.innerHTML = `${navbar()}
  <div class="page-enter container" style="padding:8rem 0">
    <div class="scanner-container">
      <h1 class="text-center mb-2">${icon('qr_code_scanner')} Scan Patient QR</h1>
      <p class="text-center text-muted mb-3">Point camera at patient's QR code or enter ID manually</p>
      <div class="quantum-scanner-overlay">
        <div class="quantum-beam"></div>
        <div class="quantum-scanner-corners"></div>
        <div id="qr-reader" style="width:100%; border:none;"></div>
      </div>
      <div class="mt-3 text-center">
        <p class="text-muted mb-2" style="font-size:0.875rem">Or enter patient ID manually:</p>
        <div class="manual-input-row">
          <input class="form-input" id="manual-id" placeholder="Enter Patient ID">
          <button class="btn btn-primary" id="manual-go">${icon('search')} Look Up</button>
        </div>
      </div>
    </div>
  </div>`;

  document.getElementById('manual-go').onclick = () => {
    let id = document.getElementById('manual-id').value.trim();
    if (id) {
       const match = id.match(/#\/patient\/([a-zA-Z0-9_-]+)/);
       if (match) id = match[1];
       else {
         const parts = id.split('/');
         id = parts[parts.length-1];
       }
       triggerEmergencyModal(id);
    } else showToast('Enter a patient ID', 'error');
  };

  // Try camera scanner
  try {
    const scanner = new Html5Qrcode('qr-reader');
    scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 250, height: 250 } },
      decodedText => {
        scanner.stop();
        let patientId = '';
        const match = decodedText.match(/#\/patient\/([a-zA-Z0-9_-]+)/);
        if (match) patientId = match[1];
        else { const parts = decodedText.split('/'); patientId = parts[parts.length-1]; }
        
        // SARVAM TRIGGER: If doctor is logged in, perform quantum handshake
        if (APP.state.doctor) {
          triggerQuantumScan(patientId);
        } else {
          triggerEmergencyModal(patientId);
        }
      }, () => {}
    ).catch(() => {
      document.getElementById('qr-reader').innerHTML = `<div class="card text-center" style="padding:3rem">
        <div style="font-size:3rem;color:var(--outline);margin-bottom:1rem">${icon('videocam_off')}</div>
        <p class="text-muted">Camera not available. Please enter the patient ID manually below.</p></div>`;
    });
  } catch(e) {
    document.getElementById('qr-reader').innerHTML = `<div class="card text-center" style="padding:3rem">
      <p class="text-muted">Camera not available. Enter patient ID manually.</p></div>`;
  }
}

// ============================================================
// PATIENT ACCESS (Emergency + OTP + Clinical)
// ============================================================
function renderPatientAccess(app, patientId) {
  app.innerHTML = `${navbar()}<div class="page-enter"><div class="spinner"></div><p class="text-center text-muted">Loading patient data...</p></div>`;

  const doc = APP.state.doctor;
  let emergencyUrl = `/api/patients/${encodeURIComponent(patientId)}/emergency`;
  if (doc && doc.id) {
    emergencyUrl += `?doctor_id=${encodeURIComponent(doc.id)}&doctor_name=${encodeURIComponent(doc.name||'')}&doctor_specialization=${encodeURIComponent(doc.specialization||'')}`;
  }

  fetch(window.API_BASE_URL + emergencyUrl).then(r => r.json()).then(data => {
    if (data.error) { app.innerHTML = `${navbar()}<div class="container" style="padding:4rem 0;text-align:center"><h2>Patient Not Found</h2><p class="text-muted">${data.error}</p><a href="#/scan" class="btn btn-primary mt-3">${icon('qr_code_scanner')} Try Again</a></div>`; return; }
    APP.state.viewingPatient = data;
    APP.state.viewingPatientId = patientId;
    showEmergencyView(app, data, patientId);
  }).catch(() => {
    app.innerHTML = `${navbar()}<div class="container text-center" style="padding:4rem 0"><h2>Error</h2><p>Failed to load patient data</p></div>`;
  });
}

function triggerEmergencyModal(patientId) {
  const overlay = document.getElementById('modal-overlay');
  const body = document.getElementById('modal-body');
  if (!overlay || !body) return;
  
  body.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner" style="border-top-color:var(--primary)"></div></div>`;
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';

  const doc = APP.state.doctor;
  let emergencyUrl = `/api/patients/${encodeURIComponent(patientId)}/emergency`;
  if (doc && doc.id) {
    emergencyUrl += `?doctor_id=${encodeURIComponent(doc.id)}&doctor_name=${encodeURIComponent(doc.name||'')}&doctor_specialization=${encodeURIComponent(doc.specialization||'')}`;
  }

  fetch(window.API_BASE_URL + emergencyUrl).then(r => r.json()).then(data => {
    if (data.error) { body.innerHTML = `<div class="text-center" style="padding:2rem"><h3>Not Found</h3><p class="text-muted">${data.error}</p></div>`; return; }
    showEmergencyView(body, data, patientId, true);
  }).catch(() => {
    body.innerHTML = `<div class="text-center text-danger" style="padding:2rem">Failed to load data</div>`;
  });
}

function showEmergencyView(container, data, patientId, isModal = false) {
  const age = data.dob ? Math.floor((Date.now() - new Date(data.dob)) / 31557600000) : '';

  container.innerHTML = `
  ${!isModal ? navbar() : ''}
  <div class="page-enter emergency-view ${isModal ? 'modal-mode' : ''}">
    ${!isModal ? `
    <button class="btn btn-text" onclick="window.history.back()" style="margin-bottom:1.5rem; padding:0.5rem 0; display:inline-flex; align-items:center; gap:0.5rem; color:var(--on-surface-variant); font-weight:600">
      ${icon('arrow_back')} Back
    </button>` : ''}
    <div class="emergency-header">
      <div class="patient-photo">${data.photo ? `<img src="${data.photo}">` : icon('person','',{style:'font-size:2rem'})}</div>
      <h1>${data.name}</h1>
      <p class="dob">${data.dob ? `DOB: ${fmtDate(data.dob)}${age ? ` (${age} yrs)` : ''}` : ''}</p>
      <div style="margin-top:1rem"><span class="emergency-badge-blood">${data.blood_group}</span></div>
    </div>

    <div class="emergency-section">
      <div class="emergency-section-title" style="color:var(--tertiary)">${icon('emergency')} Major Allergies</div>
      <div class="emergency-badges">
        ${(data.allergies||[]).length ? data.allergies.map(a => `<span class="emergency-badge-allergy">${icon('warning')} ${a}</span>`).join('') : '<span class="text-muted">No known allergies</span>'}
      </div>
    </div>

    <div class="emergency-section">
      <div class="emergency-section-title" style="color:var(--warning)">${icon('monitor_heart')} Chronic Conditions</div>
      <div class="emergency-badges">
        ${(data.chronic_conditions||[]).length ? data.chronic_conditions.map(c => `<span class="emergency-badge-condition">${icon('clinical_notes')} ${c}</span>`).join('') : '<span class="text-muted">No chronic conditions</span>'}
      </div>
    </div>

    <div class="emergency-section">
      <div class="emergency-section-title" style="color:var(--success)">${icon('contact_phone')} Emergency Contacts (ICE)</div>
      ${(data.emergency_contacts||[]).map(c => `<div class="ice-contact">
        <div class="ice-info"><h4>${c.name}</h4><p>${c.relationship} - ${c.phone}</p></div>
        <a href="tel:${c.phone}" class="ice-call">${icon('call')}</a>
      </div>`).join('') || '<p class="text-muted">No emergency contacts</p>'}
    </div>

    <div class="emergency-footer">This information is for emergency first-response use only.</div>

    <div class="otp-section" style="max-width:100%">
      <h2>${icon('lock')} Unlock Clinical Records</h2>
      <p>Request OTP from patient to view full medical data</p>
      <button class="btn btn-primary btn-block mb-2" id="req-otp-btn">${icon('sms')} Request OTP from Patient</button>
      <div id="doctor-otp-area" class="hidden"></div>
    </div>
  </div>`;

  document.getElementById('req-otp-btn').onclick = async () => {
    const doc = APP.state.doctor || {};
    try {
      const data = await api(`/api/patients/${encodeURIComponent(patientId)}/request-otp`, {
        method: 'POST', body: { doctor_id: doc.id || 'anonymous', doctor_name: doc.name || 'Anonymous Doctor' }
      });
      document.getElementById('doctor-otp-area').classList.remove('hidden');
      document.getElementById('doctor-otp-area').innerHTML = `
        <div class="mock-otp-banner">${icon('science')} Demo OTP: <span class="mock-otp-value">${data.mock_otp}</span></div>
        <p class="text-muted mb-2" style="font-size:0.875rem">OTP sent to ${data.patient_phone}</p>
        <div class="otp-inputs">${[0,1,2,3,4,5].map(i=>`<input type="text" maxlength="1" id="doc-otp-${i}">`).join('')}</div>
        <button class="btn btn-primary btn-block" id="verify-doc-otp">${icon('verified')} Verify & Access Clinical Data</button>`;
      
      for (let i = 0; i < 6; i++) {
        const inp = document.getElementById(`doc-otp-${i}`);
        inp.oninput = () => { if (inp.value && i < 5) document.getElementById(`doc-otp-${i+1}`).focus(); };
        inp.onkeydown = e => { if (e.key === 'Backspace' && !inp.value && i > 0) document.getElementById(`doc-otp-${i-1}`).focus(); };
      }
      document.getElementById('doc-otp-0').focus();

      document.getElementById('verify-doc-otp').onclick = async () => {
        const otp = [0,1,2,3,4,5].map(i=>document.getElementById(`doc-otp-${i}`).value).join('');
        if (otp.length < 6) { showToast('Enter complete OTP', 'error'); return; }
        try {
          await api(`/api/patients/${encodeURIComponent(patientId)}/verify-doctor-otp`, {
            method: 'POST', body: { otp, doctor_id: doc.id, doctor_name: doc.name }
          });
          showToast('Access granted!', 'success');
          closeModal();
          showClinicalView(document.getElementById('app'), patientId);
        } catch(e) {}
      };
    } catch(e) {}
  };
}

async function showClinicalView(app, patientId) {
  const doc = APP.state.doctor || {};
  try {
    const data = await api(`/api/patients/${encodeURIComponent(patientId)}/clinical?accessor_id=${doc.id||''}&accessor_name=${doc.name||''}&accessor_type=doctor`);
    const rxs = data.prescriptions || [];
    let allergies = data.allergies || [];
    let conditions = data.chronic_conditions || [];

    const renderTagList = (items, containerId, color) => items.map((item, i) => `
      <span style="display:inline-flex;align-items:center;gap:0.375rem;background:${color}18;color:${color};padding:0.25rem 0.75rem;border-radius:99px;font-size:0.875rem;font-weight:500;">
        ${item}
        <button type="button" onclick="window.__removeTag('${containerId}',${i})" style="background:none;border:none;cursor:pointer;color:${color};font-size:1rem;line-height:1;padding:0">&times;</button>
      </span>`).join('');

    app.innerHTML = `${navbar()}
    <div class="page-enter container" style="padding:8rem 0">
      <div class="clinical-view">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2rem;flex-wrap:wrap;gap:1rem">
          <div><h1>${icon('medical_information')} Clinical Records</h1><p class="text-muted">${data.name} - ${data.blood_group}</p></div>
          <button onclick="location.hash='#/patient/${patientId}'; render()" class="btn btn-outline btn-sm">${icon('arrow_back')} Back to Emergency</button>
        </div>

        <!-- ALLERGIES EDITOR -->
        <div class="clinical-section" style="border-left:4px solid var(--tertiary)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:0.75rem">
            <h3 style="color:var(--tertiary);margin:0">${icon('warning')} Major Allergies</h3>
            <span style="font-size:0.8125rem;color:var(--outline)">${icon('edit')} Doctor editable</span>
          </div>
          <div id="allergy-tags" style="display:flex;flex-wrap:wrap;gap:0.5rem;min-height:2rem;margin-bottom:1rem">
            ${allergies.length ? renderTagList(allergies, 'allergy-tags', '#D32F2F') : '<span class="text-muted" style="font-size:0.875rem">No known allergies</span>'}
          </div>
          <div style="display:flex;gap:0.5rem">
            <input class="form-input" id="allergy-input" placeholder="e.g. Penicillin, Peanuts..." style="flex:1;height:2.5rem;font-size:0.875rem">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.__addTag('allergy')" style="color:var(--tertiary);border-color:var(--tertiary)">${icon('add')} Add</button>
          </div>
        </div>

        <!-- CHRONIC CONDITIONS EDITOR -->
        <div class="clinical-section" style="border-left:4px solid var(--warning)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:0.75rem">
            <h3 style="color:var(--warning);margin:0">${icon('monitor_heart')} Chronic Conditions</h3>
            <span style="font-size:0.8125rem;color:var(--outline)">${icon('edit')} Doctor editable</span>
          </div>
          <div id="condition-tags" style="display:flex;flex-wrap:wrap;gap:0.5rem;min-height:2rem;margin-bottom:1rem">
            ${conditions.length ? renderTagList(conditions, 'condition-tags', '#E65100') : '<span class="text-muted" style="font-size:0.875rem">No chronic conditions</span>'}
          </div>
          <div style="display:flex;gap:0.5rem">
            <input class="form-input" id="condition-input" placeholder="e.g. Diabetes, Hypertension..." style="flex:1;height:2.5rem;font-size:0.875rem">
            <button type="button" class="btn btn-outline btn-sm" onclick="window.__addTag('condition')" style="color:var(--warning);border-color:var(--warning)">${icon('add')} Add</button>
          </div>
        </div>

        <!-- SAVE BUTTON -->
        <div style="margin-bottom:1.5rem">
          <button id="save-medical-btn" class="btn btn-primary" style="min-width:200px">${icon('save')} Save Medical Updates</button>
          <span id="save-medical-status" style="margin-left:1rem;font-size:0.875rem;color:var(--outline)"></span>
        </div>

        <div class="clinical-section"><h3>${icon('vaccines')} Immunization Status</h3>
          <span class="badge badge-success">${data.immunization_status || 'Not Updated'}</span></div>

        <!-- QUICK UPLOAD SECTION -->
        <div class="clinical-section" style="border-top: 2px dashed var(--outline-variant); padding-top: 2rem;">
          <h3 style="color:var(--primary);margin-bottom:1rem">${icon('cloud_upload')} Digital Document Upload</h3>
          <p class="text-muted" style="font-size:0.875rem; margin-bottom:1.5rem">Upload scanned prescriptions, lab results, or diagnostic photos here.</p>
          
          <div class="upload-zone" id="rx-upload-zone" onclick="document.getElementById('rx-file-input').click()">
            <div class="upload-icon">${icon('upload_file')}</div>
            <div class="upload-text">
              <strong>Click to upload</strong> or drag and drop<br>
              <span style="font-size:0.75rem; color:var(--outline)">PDF, JPG, PNG (Max 10MB)</span>
            </div>
            <input type="file" id="rx-file-input" class="hidden" accept=".pdf,image/*" onchange="window.__handleFileSelect(this)">
          </div>
          
          <div id="file-preview-strip" class="hidden" style="margin-top:1rem; padding:1rem; background:var(--surface-container-low); border-radius:var(--radius-md); display:flex; align-items:center; justify-content:space-between">
            <div style="display:flex; align-items:center; gap:0.75rem">
              <div id="file-icon-preview" style="font-size:1.5rem; color:var(--primary)">${icon('description')}</div>
              <div>
                <div id="file-name-preview" style="font-weight:600; font-size:0.875rem">filename.pdf</div>
                <div id="file-size-preview" style="font-size:0.75rem; color:var(--outline)">1.2 MB</div>
              </div>
            </div>
            <button type="button" class="btn btn-sm btn-outline btn-danger" onclick="window.__clearFile()">${icon('delete')}</button>
          </div>

          <div class="form-group mt-3">
            <label class="form-label" style="font-size:0.75rem">Visit Notes / Summary (Optional)</label>
            <textarea class="form-input" id="rx-quick-notes" placeholder="Brief context for this document..." style="min-height:80px; font-size:0.875rem"></textarea>
          </div>

          <button id="upload-doc-btn" class="btn btn-secondary btn-block mt-3" disabled onclick="window.__submitQuickRx('${patientId}')">
            ${icon('publish')} Upload and Save to Records
          </button>
        </div>

        <div class="clinical-section">
          <h3>${icon('history')} Medical History & Reports</h3>
          ${rxs.length ? rxs.map(rx => `
            <div class="prescription-card">
              <div class="prescription-header">
                <div>
                  <h4>${rx.doctor_name||'Doctor'}</h4>
                  <p class="text-muted" style="font-size:0.8125rem">${rx.hospital||''}</p>
                </div>
                <span class="badge badge-info">${fmtDate(rx.date)}</span>
              </div>
              
              ${(rx.medications && rx.medications.length) ? `
                <ul class="medication-list">
                  ${rx.medications.map(m=>`<li>${m.name||m} ${m.dosage?'- '+m.dosage:''}</li>`).join('')}
                </ul>
              ` : ''}
              
              ${rx.notes ? `<p class="text-muted mt-2" style="font-size:0.875rem">${rx.notes}</p>` : ''}
              
              ${rx.lab_report ? `
                <div style="display:flex; gap:0.5rem; margin-top:1rem; flex-wrap:wrap">
                  <button onclick="window.__viewDocument('${rx.lab_report.replace(/'/g,"\\'")}', '${(rx.lab_report_name||'document').replace(/'/g,"\\'")}')" class="btn btn-outline btn-sm">
                    ${icon('visibility')} View ${rx.lab_report_name ? 'Document' : 'Lab Report'}
                  </button>
                  <a href="${rx.lab_report}" download="${rx.lab_report_name || 'prescription'}" class="btn btn-outline btn-sm">
                    ${icon('download')} Download
                  </a>
                </div>
              ` : ''}
            </div>
          `).join('') : '<p class="text-muted">No prescriptions or records found.</p>'}
        </div>

        <a href="#/add-prescription" class="btn btn-primary" onclick="APP.state.prescriptionPatientId='${patientId}'">${icon('edit_note')} Add New Prescription</a>
      </div>
    </div>`;

    // Tag management helpers
    window.__addTag = (type) => {
      const inputEl = document.getElementById(type === 'allergy' ? 'allergy-input' : 'condition-input');
      const val = inputEl.value.trim();
      if (!val) return;
      if (type === 'allergy') { if (!allergies.includes(val)) { allergies.push(val); } }
      else { if (!conditions.includes(val)) { conditions.push(val); } }
      inputEl.value = '';
      refreshTags();
    };
    window.__removeTag = (containerId, idx) => {
      if (containerId === 'allergy-tags') allergies.splice(idx, 1);
      else conditions.splice(idx, 1);
      refreshTags();
    };

    const refreshTags = () => {
      const ac = document.getElementById('allergy-tags');
      const cc = document.getElementById('condition-tags');
      if (ac) ac.innerHTML = allergies.length ? renderTagList(allergies, 'allergy-tags', '#D32F2F') : '<span class="text-muted" style="font-size:0.875rem">No known allergies</span>';
      if (cc) cc.innerHTML = conditions.length ? renderTagList(conditions, 'condition-tags', '#E65100') : '<span class="text-muted" style="font-size:0.875rem">No chronic conditions</span>';
    };

    // Enter key support for inputs
    document.getElementById('allergy-input').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); window.__addTag('allergy'); } };
    document.getElementById('condition-input').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); window.__addTag('condition'); } };

    // Quick Upload Logic
    let selectedFile = null;
    window.__handleFileSelect = (input) => {
      const file = input.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { showToast('File too large (Max 10MB)', 'error'); return; }
      
      selectedFile = file;
      document.getElementById('file-preview-strip').classList.remove('hidden');
      document.getElementById('file-name-preview').textContent = file.name;
      document.getElementById('file-size-preview').textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      document.getElementById('upload-doc-btn').disabled = false;
      
      const isImg = file.type.startsWith('image/');
      document.getElementById('file-icon-preview').innerHTML = icon(isImg ? 'image' : 'description');
    };

    window.__clearFile = () => {
      selectedFile = null;
      document.getElementById('rx-file-input').value = '';
      document.getElementById('file-preview-strip').classList.add('hidden');
      document.getElementById('upload-doc-btn').disabled = true;
    };

    window.__submitQuickRx = async (pid) => {
      if (!selectedFile) return;
      const btn = document.getElementById('upload-doc-btn');
      const origTxt = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `${icon('hourglass_empty')} Finalizing Upload...`;
      
      const fd = new FormData();
      fd.append('patient_id', pid);
      fd.append('doctor_id', doc.id || '');
      fd.append('doctor_name', doc.name || 'Doctor');
      fd.append('hospital', doc.hospital || '');
      fd.append('notes', document.getElementById('rx-quick-notes').value);
      fd.append('lab_report', selectedFile);
      fd.append('medications', '[]'); // Quick upload is mainly for documents
      
      try {
        const res = await fetch('/api/prescriptions', { method: 'POST', body: fd }).then(r => r.json());
        if (res.error) throw new Error(res.error);
        showToast('Medical document added!', 'success');
        setTimeout(() => showClinicalView(app, pid), 800); // Reload view
      } catch (e) {
        showToast('Upload failed: ' + e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = origTxt;
      }
    };

    window.__viewDocument = (base64, name) => {
      if (base64.startsWith('data:application/pdf')) {
        const win = window.open();
        win.document.write(`<iframe src="${base64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
      } else {
        // Image preview in modal
        showModal(`
          <div class="doc-viewer">
            <div class="doc-viewer-header">
              <h3>${name}</h3>
              <button onclick="closeModal()" class="btn btn-icon">${icon('close')}</button>
            </div>
            <div class="doc-viewer-content">
              <img src="${base64}" style="max-width:100%; border-radius:8px; box-shadow:0 8px 30px rgba(0,0,0,0.2)">
            </div>
            <div class="doc-viewer-footer">
              <a href="${base64}" download="${name}" class="btn btn-primary">${icon('download')} Download Original</a>
            </div>
          </div>
        `);
      }
    };

    // Save button
    document.getElementById('save-medical-btn').onclick = async () => {
      const btn = document.getElementById('save-medical-btn');
      const status = document.getElementById('save-medical-status');
      btn.disabled = true;
      btn.innerHTML = `${icon('hourglass_empty')} Saving...`;
      try {
        await api(`/api/patients/${encodeURIComponent(patientId)}`, {
          method: 'PUT',
          body: {
            name: data.name, dob: data.dob, phone: data.phone,
            blood_group: data.blood_group, gender: data.gender,
            address: data.address, email: data.email,
            allergies, chronic_conditions: conditions,
            immunization_status: data.immunization_status,
            organ_donor_status: data.organ_donor_status
          }
        });
        btn.innerHTML = `${icon('check_circle')} Saved!`;
        btn.style.background = 'var(--success)';
        status.style.color = 'var(--success)';
        status.textContent = 'Patient record updated successfully.';
        showToast('Medical record updated!', 'success');
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = `${icon('save')} Save Medical Updates`;
          btn.style.background = '';
          status.textContent = '';
        }, 3000);
      } catch(e) {
        btn.disabled = false;
        btn.innerHTML = `${icon('save')} Save Medical Updates`;
        showToast('Failed to save', 'error');
      }
    };

  } catch(e) { showToast('Failed to load clinical data', 'error'); }
}

// ============================================================
// ADD PRESCRIPTION
// ============================================================
function renderAddPrescription(app) {
  const doc = APP.state.doctor;
  const prefillId = APP.state.prescriptionPatientId || '';

  app.innerHTML = `${navbar()}
  <div class="page-enter container" style="padding:8rem 0">
    <div class="form-container">
      <h1 class="mb-2">${icon('edit_note')} Add Prescription</h1>
      <p class="text-muted mb-3">${doc ? `Dr. ${doc.name} - ${doc.hospital||''}` : 'Please login as doctor first'}</p>
      <form id="rx-form">
        <div class="form-section">
          <div class="form-section-title"><div class="icon">${icon('person_search')}</div> Patient</div>
          <div class="form-group"><label class="form-label">Patient ID</label>
            <div style="display:flex;gap:0.75rem"><input class="form-input" id="rx-patient-id" value="${prefillId}" placeholder="Enter patient ID or scan QR">
            <button type="button" class="btn btn-secondary btn-sm" id="rx-search-btn">${icon('search')}</button></div>
          </div>
          <div id="rx-patient-info" class="hidden"></div>
        </div>

        <div class="form-section">
          <div class="form-section-title"><div class="icon">${icon('medication')}</div> Medications</div>
          <div id="med-list"></div>
          <button type="button" class="btn btn-outline btn-sm mt-2" id="add-med-btn">${icon('add')} Add Medication</button>
        </div>

        <div class="form-section">
          <div class="form-section-title"><div class="icon">${icon('notes')}</div> Notes & Reports</div>
          <div class="form-group"><label class="form-label">Notes</label><textarea class="form-input" id="rx-notes" placeholder="Additional notes..."></textarea></div>
          <div class="form-group"><label class="form-label">Lab Report (PDF/Image)</label><input type="file" class="form-input" id="rx-lab-report" accept=".pdf,image/*"></div>
        </div>

        <button type="submit" class="btn btn-primary btn-lg btn-block">${icon('save')} Submit Prescription</button>
      </form>
    </div>
  </div>`;

  let medCount = 0;
  const addMed = () => {
    medCount++;
    const div = document.createElement('div');
    div.className = 'medication-entry';
    div.innerHTML = `<button type="button" class="remove-med" onclick="this.parentElement.remove()">-</button>
      <div class="form-row"><div class="form-group"><label class="form-label">Medicine Name</label><input class="form-input med-name" placeholder="Amoxicillin"></div>
      <div class="form-group"><label class="form-label">Dosage</label><input class="form-input med-dosage" placeholder="500mg"></div></div>
      <div class="form-row"><div class="form-group"><label class="form-label">Frequency</label><input class="form-input med-freq" placeholder="Twice daily"></div>
      <div class="form-group"><label class="form-label">Duration</label><input class="form-input med-dur" placeholder="7 days"></div></div>`;
    document.getElementById('med-list').appendChild(div);
  };
  addMed();
  document.getElementById('add-med-btn').onclick = addMed;

  document.getElementById('rx-search-btn').onclick = async () => {
    const id = document.getElementById('rx-patient-id').value.trim();
    if (!id) return;
    try {
      const r = await fetch(`/api/patients/${encodeURIComponent(id)}/emergency`);
      const d = await r.json();
      if (d.error) { showToast('Patient not found', 'error'); return; }
      document.getElementById('rx-patient-info').classList.remove('hidden');
      document.getElementById('rx-patient-info').innerHTML = `<div class="card" style="display:flex;align-items:center;gap:1rem">
        <div class="avatar" style="width:3rem;height:3rem;border-radius:50%;background:var(--primary-gradient);color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden">
          ${d.photo ? `<img src="${d.photo}" style="width:100%;height:100%;object-fit:cover">` : d.name.charAt(0)}
        </div>
        <div><strong>${d.name}</strong><p class="text-muted" style="font-size:0.8125rem">${d.blood_group}</p></div></div>`;
    } catch(e) {}
  };

  document.getElementById('rx-form').onsubmit = async e => {
    e.preventDefault();
    const patientId = document.getElementById('rx-patient-id').value.trim();
    if (!patientId) { showToast('Enter patient ID', 'error'); return; }

    const meds = [...document.querySelectorAll('.medication-entry')].map(el => ({
      name: el.querySelector('.med-name').value,
      dosage: el.querySelector('.med-dosage').value,
      frequency: el.querySelector('.med-freq').value,
      duration: el.querySelector('.med-dur').value
    })).filter(m => m.name);

    const fd = new FormData();
    fd.set('patient_id', patientId);
    fd.set('doctor_id', doc?.id || '');
    fd.set('doctor_name', doc?.name || 'Doctor');
    fd.set('hospital', doc?.hospital || '');
    fd.set('medications', JSON.stringify(meds));
    fd.set('notes', document.getElementById('rx-notes').value);
    const labFile = document.getElementById('rx-lab-report').files[0];
    if (labFile) fd.set('lab_report', labFile);

    try {
      await fetch('/api/prescriptions', { method: 'POST', body: fd }).then(r => r.json());
      showToast('Prescription added!', 'success');
      APP.state.prescriptionPatientId = '';
      if (doc) navigate('/doctor-dashboard'); else navigate('/');
    } catch(e) {}
  };
}

// ============================================================
// ADMIN AUTH & PANEL
// ============================================================
function renderAdminAuth(app) {
  if (APP.state.admin && APP.state.admin.id) { navigate('/admin'); return; }
  app.innerHTML = `${navbar()}
  <div class="page-enter">
    <div class="tabs" style="max-width:480px;margin:2rem auto 0">
      <button class="tab-btn active" data-tab="login">Login</button>
      <button class="tab-btn" data-tab="register">Register</button>
    </div>
    <div id="adm-login" class="login-card" style="margin-top:0">
      <h2>${icon('admin_panel_settings')} Admin Login</h2><p>Hospital / Lab administration</p>
      <div class="form-group"><label class="form-label">Email</label><input class="form-input" id="adm-email" type="email"></div>
      <div class="form-group"><label class="form-label">Password</label><input class="form-input" id="adm-pass" type="password"></div>
      <button class="btn btn-primary btn-block" id="adm-login-btn">${icon('login')} Login</button>
    </div>
    <div id="adm-register" class="login-card hidden" style="margin-top:0;max-width:600px">
      <h2>${icon('domain_add')} Register Organization</h2>
      <form id="adm-reg-form">
        <div class="form-group"><label class="form-label">Admin Name *</label><input class="form-input" name="name" required></div>
        <div class="form-row"><div class="form-group"><label class="form-label">Organization *</label><input class="form-input" name="organization" required></div>
        <div class="form-group"><label class="form-label">Type</label><select class="form-select" name="org_type"><option>Hospital</option><option>Laboratory</option><option>Clinic</option></select></div></div>
        <div class="form-group"><label class="form-label">Email *</label><input class="form-input" name="email" type="email" required></div>
        <div class="form-group"><label class="form-label">Password *</label><input class="form-input" name="password" type="password" required></div>
        <button type="submit" class="btn btn-primary btn-block">${icon('domain_add')} Register</button>
      </form>
    </div>
  </div>`;

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('adm-login').classList.toggle('hidden', btn.dataset.tab !== 'login');
      document.getElementById('adm-register').classList.toggle('hidden', btn.dataset.tab !== 'register');
    };
  });

  document.getElementById('adm-login-btn').onclick = async () => {
    try {
      const data = await api('/api/admins/login', { method: 'POST', body: {
        email: document.getElementById('adm-email').value,
        password: document.getElementById('adm-pass').value
      }});
      APP.state.admin = data.admin;
      APP.state.adminData = data;
      saveSession('uhqr_admin', data.admin); // Administrative Handshake
      showToast('Welcome, ' + data.admin.name, 'success');
      navigate('/admin');
    } catch(e) {}
  };

  document.getElementById('adm-reg-form').onsubmit = async e => {
    e.preventDefault();
    try {
      await api('/api/admins/register', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      showToast('Organization registered! Please login.', 'success');
      document.querySelector('[data-tab="login"]').click();
    } catch(e) {}
  };
}

function renderAdminPanel(app) {
  const adm = APP.state.admin;
  if (!adm) { navigate('/admin-login'); return; }
  const d = APP.state.adminData || {};
  const tabs = ['Overview','Patients','Doctors','Audit Trail'];

  app.innerHTML = `${navbar()}
  <div class="dashboard page-enter" style="padding-top:8rem">
    <aside class="sidebar">
      <div class="sidebar-header"><div class="user-info">
        <div class="avatar" style="background:linear-gradient(135deg,var(--warning),#ef6c00)">${adm.name.charAt(0)}</div>
        <div><strong>${adm.name}</strong><p class="text-muted" style="font-size:0.8125rem">${adm.organization}</p></div>
      </div></div>
      <ul class="sidebar-nav" id="adm-nav">
        ${tabs.map((t,i)=>`<li class="${i===0?'active':''}"><button data-tab="${i}">${icon(['dashboard','group','stethoscope','shield_person'][i])} ${t}</button></li>`).join('')}
      </ul>
      <div style="padding:1.5rem;display:flex;flex-direction:column;align-items:center;gap:1.5rem;margin-top:auto;border-top:1px solid var(--outline-variant)">
        <button data-action="logout" data-target="/admin-login" data-role="admin" class="btn btn-outline" style="width:100%;border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;gap:0.5rem">
          ${icon('logout')} Logout
        </button>

      </div>
    </aside>
    <main class="main-content" id="adm-content"></main>
  </div>`;

  const showTab = idx => {
    document.querySelectorAll('#adm-nav li').forEach((li,i)=>li.classList.toggle('active',i===idx));
    const c = document.getElementById('adm-content');
    if (idx===0) c.innerHTML = adminOverview(d);
    else if (idx===1) c.innerHTML = adminPatients(d.patients||[]);
    else if (idx===2) c.innerHTML = adminDoctors(d.doctors||[]);
    else c.innerHTML = adminLogs(d.recentLogs||[]);
  };
  document.querySelectorAll('#adm-nav button[data-tab]').forEach(b => b.onclick = () => showTab(parseInt(b.dataset.tab)));
  showTab(0);
}

function adminOverview(d) {
  const s = d.stats||{};
  return `<div class="main-content-header"><h1>Admin Overview</h1><p>System health at a glance</p></div>
    <div class="dash-grid">
      <div class="dash-stat" style="border-left:4px solid var(--primary)"><div class="stat-label">Total Patients</div><div class="stat-value">${s.patientCount||0}</div></div>
      <div class="dash-stat" style="border-left:4px solid var(--success)"><div class="stat-label">Registered Doctors</div><div class="stat-value">${s.doctorCount||0}</div></div>
      <div class="dash-stat" style="border-left:4px solid var(--warning)"><div class="stat-label">Prescriptions</div><div class="stat-value">${s.prescriptionCount||0}</div></div>
    </div>`;
}

function adminPatients(pts) {
  return `<div class="main-content-header"><h1>Patient Records</h1></div>
    <div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>Name</th><th>Phone</th><th>Blood Group</th><th>Registered</th><th>Action</th></tr></thead>
    <tbody>${pts.map(p=>`<tr><td>${p.name}</td><td>${p.phone}</td><td><span class="badge badge-info">${p.blood_group}</span></td><td>${fmtDate(p.created_at)}</td><td><a href="#/patient/${p.id}" class="btn btn-outline btn-sm">View</a></td></tr>`).join('')}
    </tbody></table></div>`;
}

function adminDoctors(docs) {
  return `<div class="main-content-header"><h1>Doctor Accounts</h1></div>
    <div style="overflow-x:auto"><table class="admin-table"><thead><tr><th>Name</th><th>Specialization</th><th>Hospital</th><th>Email</th></tr></thead>
    <tbody>${docs.map(d=>`<tr><td>Dr. ${d.name}</td><td>${d.specialization||'General'}</td><td>${d.hospital||''}</td><td>${d.email}</td></tr>`).join('')}
    </tbody></table></div>`;
}

function adminLogs(logs) {
  return `<div class="main-content-header"><h1>Audit Trail</h1></div>
    <div class="card">${logs.map(l=>`<div class="log-entry">
      <div class="log-icon ${l.accessor_type||'doctor'}">${icon(l.accessor_type==='admin'?'admin_panel_settings':'stethoscope')}</div>
      <div class="log-details"><h4>${l.accessor_name||'Unknown'} - ${l.patient_name||'Patient'}</h4><p>${l.layer_accessed||''} - ${l.purpose||''}</p></div>
      <span class="log-time">${fmtDate(l.timestamp)}</span>
    </div>`).join('')}</div>`;
}

// ============================================================
// SUPER ADMIN LOGIN
// ============================================================
function renderSuperAdminLogin(app) {
  if (APP.state.superAdmin && APP.state.superAdmin.username) { navigate('/super-admin'); return; }
  app.innerHTML = `
  <div class="hms-login-page sa page-enter">
    <div class="hms-login-card">
      <div class="hms-login-icon sa">${icon('shield_person')}</div>
      <h2>Super Admin</h2>
      <p class="sub">Secure system-wide control panel</p>
      <div class="hms-form-group">
        <label class="hms-form-label">Email</label>
        <input class="hms-form-input" id="sa-email" type="email" placeholder="admin@uhqr.com">
      </div>
      <div class="hms-form-group">
        <label class="hms-form-label">Password</label>
        <input class="hms-form-input" id="sa-pass" type="password" placeholder="********">
      </div>
      <button class="hms-login-submit sa" id="sa-login-btn">${icon('lock_open')} Sign In</button>
      <div class="hms-cred-hint">Default: admin@uhqr.com / Admin@123</div>
      <p style="text-align:center;margin-top:1rem;font-size:.75rem;color:var(--hms-text-muted)">
        <button class="btn-link" onclick="navigate('/')" style="color:var(--hms-blue);background:none;border:none;cursor:pointer;font:inherit">${icon('arrow_back')} Back to Home</button>
      </p>
    </div>
  </div>`;

  const doLogin = async () => {
    const email = document.getElementById('sa-email').value.trim();
    const pass  = document.getElementById('sa-pass').value;
    if (!email||!pass) { showToast('Enter credentials','error'); return; }
    try {
      const data = await api('/api/super-admin/login', { method:'POST', body:{email,password:pass} });
      APP.state.superAdmin = data.superAdmin;
      saveSession('uhqr_superadmin', data.superAdmin);
      showToast('Welcome, Super Admin!','success');
      navigate('/super-admin');
    } catch(e){}
  };
  document.getElementById('sa-login-btn').onclick = doLogin;
  document.getElementById('sa-pass').onkeydown = e => { if(e.key==='Enter') doLogin(); };
}

// ============================================================
// SUPER ADMIN DASHBOARD
// ============================================================
function renderSuperAdminDashboard(app) {
  const sa = APP.state.superAdmin;
  if (!sa) { navigate('/super-admin-login'); return; }

  const tabs = [
    {id:'overview', label:'Overview',     ico:'dashboard'},
    {id:'hospitals',label:'Hospitals',    ico:'local_hospital'},
    {id:'heads',    label:'Hospital Heads',ico:'manage_accounts'},
    {id:'analytics',label:'Analytics',    ico:'bar_chart'},
    {id:'logs',     label:'Audit Logs',   ico:'history'},
  ];

  app.innerHTML = `
  <div class="hms-layout page-enter" style="padding-top:8rem">
    <aside class="hms-sidebar">
      <div class="hms-sidebar-brand">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem">
          <img src="/logo.png" class="brand-logo" style="width:2.5rem;height:2.5rem">
          <span class="brand-text">Sarvam</span>
        </div>
        <div class="hms-role-pill sa">${icon('verified_user')} Super Admin</div>
        <p>Signed in as ${sa.name}</p>
      </div>
      <ul class="hms-sidebar-nav" id="sa-nav">
        ${tabs.map((t,i)=>`<li class="${i===0?'active':''}">
          <button data-tab="${t.id}">${icon(t.ico)} ${t.label}</button>
        </li>`).join('')}
      </ul>
      <div class="hms-sidebar-footer" style="display:flex;flex-direction:column;align-items:center;gap:1.5rem;padding:1.5rem">
        <button data-action="logout" data-target="/super-admin-login" data-role="super_admin" class="btn btn-outline" style="width:100%;border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;gap:0.5rem">
          ${icon('logout')} Logout
        </button>

      </div>
    </aside>
    <main class="hms-main">
      <div class="hms-topbar">
        <div><h1 id="sa-page-title">Overview</h1><p>Hospital Management System - Global Control</p></div>
        <div style="display:flex;gap:.5rem;align-items:center">
          <span class="hms-status ok">${icon('circle')} System Online</span>

        </div>
      </div>
      <div class="hms-content" id="sa-content"></div>
    </main>
  </div>

  <!-- Hospital Modal -->
  <div class="hms-modal-backdrop" id="hosp-modal">
    <div class="hms-modal">
      <button class="hms-modal-close" onclick="document.getElementById('hosp-modal').classList.remove('open')">-</button>
      <h3 id="hosp-modal-title">Add Hospital</h3>
      <input type="hidden" id="hosp-edit-id">
      <div class="hms-form-row">
        <div class="hms-form-group"><label class="hms-form-label">Hospital Name *</label><input class="hms-form-input" id="h-name" placeholder="City General Hospital"></div>
        <div class="hms-form-group"><label class="hms-form-label">Type</label>
          <select class="hms-form-select" id="h-type"><option>Hospital</option><option>Clinic</option><option>Laboratory</option><option>Specialty Center</option></select></div>
      </div>
      <div class="hms-form-row">
        <div class="hms-form-group"><label class="hms-form-label">City</label><input class="hms-form-input" id="h-city" placeholder="Mumbai"></div>
        <div class="hms-form-group"><label class="hms-form-label">Total Beds</label><input class="hms-form-input" id="h-beds" type="number" placeholder="200" min="0"></div>
      </div>
      <div class="hms-form-row">
        <div class="hms-form-group"><label class="hms-form-label">Phone</label><input class="hms-form-input" id="h-phone" placeholder="+91 ..."></div>
        <div class="hms-form-group"><label class="hms-form-label">Email</label><input class="hms-form-input" id="h-email" type="email" placeholder="contact@hospital.com"></div>
      </div>
      <div class="hms-form-group"><label class="hms-form-label">Address</label>
        <div style="display:flex;gap:0.5rem">
          <input class="hms-form-input" id="h-address" placeholder="Full address" style="flex:1" oninput="document.getElementById('h-map-btn').classList.remove('verified'); document.getElementById('save-hosp-btn').classList.add('weightless-disabled');">
          <button type="button" class="btn-map-node" id="h-map-btn" onclick="const v=document.getElementById('h-address').value.trim(); if(!v) { alert('Please type an address first to see it on the map.'); return; } this.classList.add('verified'); document.getElementById('save-hosp-btn').classList.remove('weightless-disabled'); window.open('https://www.google.com/maps/search/?api=1&amp;query='+encodeURIComponent(v), '_blank');" title="Verify Spatial Anchor">${icon('location_on')}</button>
        </div>
      </div>
      <div class="hms-modal-actions">
        <button class="hms-btn hms-btn-ghost" onclick="document.getElementById('hosp-modal').classList.remove('open')">Cancel</button>
        <button class="hms-btn hms-btn-primary weightless-disabled" id="save-hosp-btn" onclick="saveHospital()">${icon('save')} Save Hospital</button>
      </div>
    </div>
  </div>

  <!-- Hospital Head Modal -->
  <div class="hms-modal-backdrop" id="hh-modal">
    <div class="hms-modal">
      <button class="hms-modal-close" onclick="document.getElementById('hh-modal').classList.remove('open')">-</button>
      <h3>Add Hospital Head</h3>
      <div class="hms-form-group"><label class="hms-form-label">Assign Hospital *</label>
        <select class="hms-form-select" id="hh-hospital-select"><option value="">Select hospital...</option></select></div>
      <div class="hms-form-row">
        <div class="hms-form-group"><label class="hms-form-label">Full Name *</label><input class="hms-form-input" id="hh-name" placeholder="Dr. Jane Smith"></div>
        <div class="hms-form-group"><label class="hms-form-label">Email *</label><input class="hms-form-input" id="hh-email" type="email" placeholder="head@hospital.com"></div>
      </div>
      <div class="hms-form-group"><label class="hms-form-label">Password *</label><input class="hms-form-input" id="hh-pass" type="password" placeholder="Min 6 characters"></div>
      <div class="hms-modal-actions">
        <button class="hms-btn hms-btn-ghost" onclick="document.getElementById('hh-modal').classList.remove('open')">Cancel</button>
        <button class="hms-btn hms-btn-green" onclick="saveHospitalHead()">${icon('person_add')} Create Head</button>
      </div>
    </div>
  </div>`;

  // Tab switching
  const showSATab = async (tabId) => {
    document.querySelectorAll('#sa-nav li').forEach(li => li.classList.toggle('active', li.querySelector('button').dataset.tab === tabId));
    document.getElementById('sa-page-title').textContent = tabs.find(t=>t.id===tabId)?.label || '';
    const el = document.getElementById('sa-content');
    el.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner" style="border-top-color:var(--hms-blue)"></div></div>`;
    try {
      const dash = await api('/api/super-admin/dashboard');
      if (tabId==='overview')   renderSAOverview(el, dash);
      else if (tabId==='hospitals') renderSAHospitals(el, dash.hospitals||[]);
      else if (tabId==='heads') { const hd = await api('/api/super-admin/hospital-heads'); renderSAHeads(el, hd.heads||[], dash.hospitals||[]); }
      else if (tabId==='analytics') renderSAAnalytics(el, dash);
      else if (tabId==='logs')  renderSALogs(el, dash.recentLogs||[]);
    } catch(e) { el.innerHTML = `<div class="hms-empty">${icon('error')} <p>Failed to load data</p></div>`; }
  };

  document.querySelectorAll('#sa-nav button[data-tab]').forEach(btn => btn.onclick = () => showSATab(btn.dataset.tab));
  showSATab('overview');

  // Hospital CRUD helpers (global)
  window.openHospitalModal = (h=null) => {
    document.getElementById('hosp-edit-id').value = h ? h.id : '';
    document.getElementById('hosp-modal-title').textContent = h ? 'Edit Hospital' : 'Add Hospital';
    document.getElementById('h-name').value    = h?.name||'';
    document.getElementById('h-type').value    = h?.type||'Hospital';
    document.getElementById('h-city').value    = h?.city||'';
    document.getElementById('h-beds').value    = h?.beds_total||'';
    document.getElementById('h-phone').value   = h?.phone||'';
    document.getElementById('h-email').value   = h?.email||'';
    document.getElementById('h-address').value = h?.address||'';
    
    // Sarvam Spatial Mandate reset
    const mapBtn = document.getElementById('h-map-btn');
    const saveBtn = document.getElementById('save-hosp-btn');
    if (mapBtn) mapBtn.classList.remove('verified');
    if (saveBtn) saveBtn.classList.add('weightless-disabled');
    if (h?.address) {
       if (mapBtn) mapBtn.classList.add('verified');
       if (saveBtn) saveBtn.classList.remove('weightless-disabled');
    }

    document.getElementById('hosp-modal').classList.add('open');
  };
  window.saveHospital = async () => {
    const saveBtn = document.getElementById('save-hosp-btn');
    if (saveBtn && saveBtn.classList.contains('weightless-disabled')) {
      saveBtn.classList.remove('shake-error');
      void saveBtn.offsetWidth;
      saveBtn.classList.add('shake-error');
      showToast('Spatial Mandate: Map verification required before saving!', 'error');
      return;
    }
    const id = document.getElementById('hosp-edit-id').value;
    const body = {
      name:    document.getElementById('h-name').value.trim(),
      type:    document.getElementById('h-type').value,
      city:    document.getElementById('h-city').value.trim(),
      beds_total: document.getElementById('h-beds').value,
      phone:   document.getElementById('h-phone').value.trim(),
      email:   document.getElementById('h-email').value.trim(),
      address: document.getElementById('h-address').value.trim()
    };
    // Edge validation before network drift
    if (!body.name)  { showToast('Hospital name is required', 'error'); document.getElementById('h-name').focus(); return; }
    if (!body.email) { showToast('Admin email is required', 'error'); document.getElementById('h-email').focus(); return; }

    // Sync-Orb loading state
    const origTxt = saveBtn.innerHTML;
    saveBtn.innerHTML = `<span class="sync-orb" style="width:.875rem;height:.875rem"></span> Saving...`;
    saveBtn.disabled = true;

    try {
      if (id) {
        await api(`/api/super-admin/hospitals/${id}`, {method:'PUT', body});
      } else {
        await api('/api/super-admin/hospitals', {method:'POST', body});
      }
      // Luminous success pulse
      saveBtn.innerHTML = `<span style="font-size:1rem">[-]</span> ${id ? 'Updated!' : 'Created!'}`;
      saveBtn.style.background = 'linear-gradient(135deg,#00c853,#00e676)';
      saveBtn.style.color = '#fff';
      showToast(id ? `"${body.name}" updated successfully!` : `"${body.name}" added to the system!`, 'success');
      setTimeout(() => {
        const modal = document.getElementById('hosp-modal');
        if (modal) modal.classList.remove('open');
        if (typeof showSATab === 'function') showSATab('hospitals'); // Resilience: only refresh if element exists
      }, 700);
    } catch(e) {
      saveBtn.innerHTML = origTxt;
      saveBtn.disabled = false;
    }
  };
  window.deleteHospital = async (id, name) => {
    if (!confirm(`Delete "${name}" and ALL its data? This cannot be undone.`)) return;
    try { 
      await api(`/api/super-admin/hospitals/${id}`, {method:'DELETE'}); 
      showToast('Hospital deleted','success'); 
      if (typeof showSATab === 'function') showSATab('hospitals'); 
    } catch(e){}
  };
  window.openHHModal = async (hospitals) => {
    const sel = document.getElementById('hh-hospital-select');
    sel.innerHTML = '<option value="">Select hospital...</option>' + hospitals.map(h=>`<option value="${h.id}">${h.name}</option>`).join('');
    ['hh-name','hh-email','hh-pass'].forEach(id => document.getElementById(id).value='');
    document.getElementById('hh-modal').classList.add('open');
  };
  window.saveHospitalHead = async () => {
    const body = {
      hospital_id: document.getElementById('hh-hospital-select').value,
      name:        document.getElementById('hh-name').value.trim(),
      email:       document.getElementById('hh-email').value.trim(),
      password:    document.getElementById('hh-pass').value
    };
    if (!body.hospital_id) { showToast('Please select a hospital', 'error'); return; }
    if (!body.name)        { showToast('Full name is required', 'error'); document.getElementById('hh-name').focus(); return; }
    if (!body.email)       { showToast('Email address is required', 'error'); document.getElementById('hh-email').focus(); return; }
    if (!body.password || body.password.length < 6) { showToast('Password must be at least 6 characters', 'error'); document.getElementById('hh-pass').focus(); return; }

    const btn = document.querySelector('#hh-modal .hms-btn-green');
    const origTxt = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = `<span class="sync-orb" style="width:.8rem;height:.8rem"></span> Creating...`; btn.disabled = true; }

    try {
      await api('/api/super-admin/hospital-heads', {method:'POST', body});
      if (btn) { btn.innerHTML = `<span>[-]</span> Created!`; btn.style.background = 'linear-gradient(135deg,#00c853,#00e676)'; }
      showToast(`Hospital Head "${body.name}" created! They can now log in.`, 'success');
      setTimeout(() => {
        const modal = document.getElementById('hh-modal');
        if (modal) modal.classList.remove('open');
        if (typeof showSATab === 'function') showSATab('heads');
      }, 700);
    } catch(e) {
      if (btn) { btn.innerHTML = origTxt; btn.disabled = false; btn.style.background = ''; }
    }
  };

  window.deleteHospitalHead = async (id, name) => {
    if (!confirm(`Remove Hospital Head "${name}"?`)) return;
    try { 
      await api(`/api/super-admin/hospital-heads/${id}`, {method:'DELETE'}); 
      showToast('Removed','success'); 
      if (typeof showSATab === 'function') showSATab('heads'); 
    } catch(e){}
  };
}

function renderSAOverview(el, dash) {
  const s = dash.stats||{};
  el.innerHTML = `
  <div class="kpi-grid">
    <div class="kpi-card blue"><div class="kpi-icon blue">${icon('local_hospital')}</div><div class="kpi-label">Hospitals</div><div class="kpi-value">${s.hospitals||0}</div></div>
    <div class="kpi-card green"><div class="kpi-icon green">${icon('manage_accounts')}</div><div class="kpi-label">Hospital Heads</div><div class="kpi-value">${s.hospitalHeads||0}</div></div>
    <div class="kpi-card orange"><div class="kpi-icon orange">${icon('stethoscope')}</div><div class="kpi-label">Doctors</div><div class="kpi-value">${s.doctors||0}</div></div>
    <div class="kpi-card purple"><div class="kpi-icon purple">${icon('group')}</div><div class="kpi-label">Patients</div><div class="kpi-value">${s.patients||0}</div></div>
    <div class="kpi-card gold"><div class="kpi-icon gold">${icon('bed')}</div><div class="kpi-label">Total Beds</div><div class="kpi-value">${s.totalBeds||0}</div></div>
    <div class="kpi-card green"><div class="kpi-icon green">${icon('calendar_month')}</div><div class="kpi-label">Appointments</div><div class="kpi-value">${s.appointments||0}</div></div>
  </div>
  <div class="hms-card">
    <div class="hms-card-header"><h3>${icon('local_hospital')} Recent Hospitals</h3></div>
    <div class="hms-table-wrap" style="border:none">
      <table class="hms-table">
        <thead><tr><th>Name</th><th>Type</th><th>City</th><th>Beds</th><th>Staff</th><th>Depts</th><th>Actions</th></tr></thead>
        <tbody>${(dash.hospitals||[]).slice(0,8).map(h=>`<tr>
          <td style="font-weight:600">${h.name}</td>
          <td><span class="hms-status muted">${h.type||'Hospital'}</span></td>
          <td>${h.city||'-'}</td>
          <td>${h.beds_total||0}</td>
          <td>${h.staff_count||0}</td>
          <td>${h.dept_count||0}</td>
          <td>
            <button class="hms-btn hms-btn-ghost" onclick='openHospitalModal(${JSON.stringify(h).replace(/'/g,"&apos;")})'>${icon('edit')}</button>
            <button class="hms-btn hms-btn-danger" style="margin-left:.375rem" onclick="deleteHospital('${h.id}','${h.name.replace(/'/g,"\\'")}')">${icon('delete')}</button>
          </td>
        </tr>`).join('') || `<tr><td colspan="7"><div class="hms-empty">${icon('domain_disabled')}<p>No hospitals yet</p></div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderSAHospitals(el, hospitals) {
  el.innerHTML = `
  <div style="display:flex;justify-content:flex-end;margin-bottom:1rem">
    <button class="hms-btn hms-btn-primary" onclick="openHospitalModal()">${icon('add')} Add Hospital</button>
  </div>
  <div class="hms-table-wrap">
    <table class="hms-table">
      <thead><tr><th>Hospital</th><th>Type</th><th>City</th><th>Beds</th><th>Staff</th><th>Heads</th><th>Actions</th></tr></thead>
      <tbody>${hospitals.length ? hospitals.map(h=>`<tr>
        <td><div style="font-weight:700;color:var(--hms-text)">${h.name}</div><div style="font-size:.7rem;color:var(--hms-text-muted)">${h.email||''}</div></td>
        <td><span class="hms-status muted">${h.type||'Hospital'}</span></td>
        <td>${h.city||'-'}</td>
        <td>${h.beds_total||0}</td>
        <td>${h.staff_count||0}</td>
        <td>${h.head_count||0}</td>
        <td>
          <button class="hms-btn hms-btn-ghost" onclick='openHospitalModal(${JSON.stringify(h).replace(/'/g,"&apos;")})'>${icon('edit')}</button>
          <button class="hms-btn hms-btn-danger" style="margin-left:.375rem" onclick="deleteHospital('${h.id}','${h.name.replace(/'/g,"\\'")}')"> ${icon('delete')}</button>
        </td>
      </tr>`).join('') : `<tr><td colspan="7"><div class="hms-empty">${icon('domain_disabled')}<p>No hospitals. Click "Add Hospital" to create one.</p></div></td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function renderSAHeads(el, heads, hospitals) {
  el.innerHTML = `
  <div style="display:flex;justify-content:flex-end;margin-bottom:1rem">
    <button class="hms-btn hms-btn-green" onclick='openHHModal(${JSON.stringify(hospitals).replace(/'/g, "&apos;")})'>${icon('person_add')} Add Hospital Head</button>
  </div>
  <div class="hms-table-wrap">
    <table class="hms-table">
      <thead><tr><th>Name</th><th>Email</th><th>Hospital</th><th>Created</th><th>Action</th></tr></thead>
      <tbody>${heads.length ? heads.map(h=>`<tr>
        <td style="font-weight:600">${h.name}</td>
        <td style="color:var(--hms-text-muted)">${h.email}</td>
        <td>${h.hospital_name||'-'}</td>
        <td style="color:var(--hms-text-muted)">${fmtDate(h.created_at)}</td>
        <td><button class="hms-btn hms-btn-danger" onclick="deleteHospitalHead('${h.id}','${h.name.replace(/'/g,"\\")}')">${icon('delete')}</button></td>
      </tr>`).join('') : `<tr><td colspan="5"><div class="hms-empty">${icon('manage_accounts')}<p>No hospital heads yet.</p></div></td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function renderSAAnalytics(el, dash) {
  const hospitals = (dash.hospitals||[]).slice(0,8);
  const maxStaff = Math.max(...hospitals.map(h=>h.staff_count||0), 1);
  el.innerHTML = `
  <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="kpi-card blue"><div class="kpi-icon blue">${icon('pie_chart')}</div><div class="kpi-label">Avg Staff / Hospital</div>
      <div class="kpi-value">${hospitals.length ? Math.round(hospitals.reduce((a,h)=>a+(h.staff_count||0),0)/hospitals.length) : 0}</div></div>
    <div class="kpi-card green"><div class="kpi-icon green">${icon('bed')}</div><div class="kpi-label">Avg Beds / Hospital</div>
      <div class="kpi-value">${hospitals.length ? Math.round(hospitals.reduce((a,h)=>a+(h.beds_total||0),0)/hospitals.length) : 0}</div></div>
    <div class="kpi-card purple"><div class="kpi-icon purple">${icon('business')}</div><div class="kpi-label">Total Departments</div>
      <div class="kpi-value">${hospitals.reduce((a,h)=>a+(h.dept_count||0),0)}</div></div>
  </div>
  <div class="hms-card">
    <div class="hms-card-header"><h3>${icon('bar_chart')} Staff Distribution by Hospital</h3></div>
    <div class="hms-card-body">
      ${hospitals.length ? hospitals.map(h=>`
        <div class="hms-bar-row">
          <span class="hms-bar-label">${h.name}</span>
          <div class="hms-bar-track"><div class="hms-bar-fill" style="width:${Math.round((h.staff_count||0)/maxStaff*100)}%"></div></div>
          <span class="hms-bar-val">${h.staff_count||0}</span>
        </div>`).join('') : `<div class="hms-empty">${icon('bar_chart')}<p>No data yet</p></div>`}
    </div>
  </div>`;
}

function renderSALogs(el, logs) {
  el.innerHTML = `
  <div class="hms-card">
    <div class="hms-card-header"><h3>${icon('history')} System Audit Logs</h3><span class="hms-status muted">${logs.length} recent</span></div>
    <div class="hms-card-body">
      ${logs.length ? logs.map(l=>`
        <div class="hms-log-row">
          <div class="hms-log-icon">${icon(l.accessor_type==='admin'?'admin_panel_settings':'stethoscope')}</div>
          <div class="hms-log-detail">
            <h4>${l.accessor_name||'Unknown'} - ${l.patient_name||'Patient'}</h4>
            <p>${l.layer_accessed||''} - ${l.purpose||''}</p>
          </div>
          <span class="hms-log-time">${fmtDate(l.timestamp)}</span>
        </div>`).join('') : `<div class="hms-empty">${icon('history')}<p>No audit logs yet</p></div>`}
    </div>
  </div>`;
}

// ============================================================
// HOSPITAL HEAD LOGIN
// ============================================================
function renderHospitalHeadLogin(app) {
  if (APP.state.hospitalHead && APP.state.hospitalHead.id) { navigate('/hospital-head'); return; }
  app.innerHTML = `
  <div class="hms-login-page hh page-enter">
    <div class="hms-login-card">
      <div class="hms-login-icon hh">${icon('domain')}</div>
      <h2>Hospital Head</h2>
      <p class="sub">Access your hospital management portal</p>
      <div class="hms-form-group">
        <label class="hms-form-label">Email</label>
        <input class="hms-form-input" id="hh-login-email" type="email" placeholder="head@hospital.com" autocomplete="email">
      </div>
      <div class="hms-form-group" style="position:relative">
        <label class="hms-form-label">Password</label>
        <input class="hms-form-input" id="hh-login-pass" type="password" placeholder="********" autocomplete="current-password" style="padding-right:2.5rem">
        <button type="button" id="hh-pass-toggle" style="position:absolute;right:0.75rem;bottom:0.6rem;background:none;border:none;color:var(--hms-text-muted);cursor:pointer;padding:0;line-height:1;">${icon('visibility')}</button>
      </div>
      <button class="hms-login-submit hh" id="hh-login-btn" style="position:relative;overflow:hidden;transition:all .3s ease;">
        <span id="hh-btn-idle" style="display:flex;align-items:center;gap:0.5rem;justify-content:center;">${icon('lock_open')} Sign In</span>
        <span id="hh-btn-loading" style="display:none;align-items:center;gap:0.5rem;justify-content:center;"><span class="sync-orb"></span> Authenticating...</span>
      </button>
      <div class="hms-cred-hint">Contact Super Admin to get your login credentials.</div>
      <p style="text-align:center;margin-top:1rem;font-size:.75rem;color:var(--hms-text-muted)">
        <button class="btn-link" onclick="navigate('/')" style="color:var(--hms-green);background:none;border:none;cursor:pointer;font:inherit">${icon('arrow_back')} Back to Home</button>
      </p>
    </div>
  </div>`;

  // Password visibility toggle
  document.getElementById('hh-pass-toggle').onclick = () => {
    const p = document.getElementById('hh-login-pass');
    p.type = p.type === 'password' ? 'text' : 'password';
  };

  let _busy = false;
  const doLogin = async () => {
    if (_busy) return;
    const email = document.getElementById('hh-login-email').value.trim();
    const pass  = document.getElementById('hh-login-pass').value;
    if (!email) { showToast('Please enter your email address', 'error'); document.getElementById('hh-login-email').focus(); return; }
    if (!pass)  { showToast('Please enter your password', 'error'); document.getElementById('hh-login-pass').focus(); return; }

    _busy = true;
    const btn = document.getElementById('hh-login-btn');
    document.getElementById('hh-btn-idle').style.display    = 'none';
    document.getElementById('hh-btn-loading').style.display = 'flex';
    btn.disabled = true;

    try {
      const data = await api('/api/hospital-head/login', {method:'POST', body:{email, password:pass}});
      APP.state.hospitalHead = data.hospitalHead;
      saveSession('uhqr_hospital_head', data.hospitalHead);
      // Luminous success state
      btn.style.background = 'linear-gradient(135deg,#00c853,#00e676)';
      document.getElementById('hh-btn-loading').innerHTML = '<span style="font-size:1.1rem">[-]</span> Welcome, ' + data.hospitalHead.name + '!';
      showToast('Welcome back, ' + data.hospitalHead.name + '!', 'success');
      setTimeout(() => navigate('/hospital-head'), 600);
    } catch(e) {
      const raw = (e.message || 'Login failed');
      let friendly = raw;
      if (raw.includes('not found') || raw.includes('404')) friendly = 'No account found with this email. Contact your Super Admin.';
      else if (raw.includes('password') || raw.includes('401')) friendly = 'Incorrect password. Please try again.';
      else if (raw.includes('fetch') || raw.includes('Network')) friendly = 'Cannot reach server. Please check your connection.';
      showToast(friendly, 'error');
      document.getElementById('hh-btn-idle').style.display    = 'flex';
      document.getElementById('hh-btn-loading').style.display = 'none';
      btn.disabled = false;
      _busy = false;
    }
  };
  document.getElementById('hh-login-btn').onclick = doLogin;
  document.getElementById('hh-login-pass').onkeydown = e => { if(e.key==='Enter') doLogin(); };
  document.getElementById('hh-login-email').onkeydown = e => { if(e.key==='Enter') document.getElementById('hh-login-pass').focus(); };
}

// ============================================================
// HOSPITAL HEAD DASHBOARD
// ============================================================
function renderHospitalHeadDashboard(app) {
  const hh = APP.state.hospitalHead;
  if (!hh) { navigate('/hospital-head-login'); return; }
  const hid = hh.hospital_id;

  const tabs = [
    {id:'overview',     label:'Overview',    ico:'dashboard'},
    {id:'active-doctors', label:'Active Staff Repo', ico:'verified'},
    {id:'approvals',    label:'Doctor Approvals', ico:'verified_user'},
    {id:'beds',         label:'Bed Management', ico:'bed'},
    {id:'departments',  label:'Departments', ico:'category'},
    {id:'staff',        label:'Staff',       ico:'groups'},
    {id:'inventory',    label:'Inventory',   ico:'inventory_2'},
    {id:'patients',     label:'Patients',    ico:'personal_injury'},
  ];

  app.innerHTML = `
  <div class="hms-layout page-enter" style="padding-top:8rem">
    <aside class="hms-sidebar">
      <div class="hms-sidebar-brand">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1.5rem">
          <img src="/logo.png" class="brand-logo" style="width:2.5rem;height:2.5rem">
          <span class="brand-text">Sarvam</span>
        </div>
        <div class="hms-role-pill hh">${icon('domain')} Hospital Head</div>
        <h2>${hh.hospital_name||'My Hospital'}</h2>
        <p>${hh.name}</p>
      </div>
      <ul class="hms-sidebar-nav" id="hh-nav">
        ${tabs.map((t,i)=>`<li class="${i===0?'active hh':'hh'}">
          <button data-tab="${t.id}">${icon(t.ico)} ${t.label}</button>
        </li>`).join('')}
      </ul>
      <div class="hms-sidebar-footer" style="display:flex;flex-direction:column;align-items:center;gap:1.5rem;padding:1.5rem">
        <button data-action="logout" data-target="/hospital-head-login" data-role="hospital_head" class="btn btn-outline" style="width:100%;border-radius:var(--radius-lg);display:flex;align-items:center;justify-content:center;gap:0.5rem">
          ${icon('logout')} Sign Out
        </button>

      </div>
    </aside>
    <main class="hms-main">
      <div class="hms-topbar">
        <div><h1 id="hh-page-title">Overview</h1><p>${hh.hospital_name||'Hospital'} - ${hh.hospital_city||''}</p></div>
        <div style="display:flex;gap:.5rem;align-items:center">
          <span class="hms-status ok">${icon('circle')} Active</span>

        </div>
      </div>
      <div class="hms-content" id="hh-content"></div>
    </main>
  </div>

  <!-- Staff Modal -->
  <div class="hms-modal-backdrop" id="staff-modal">
    <div class="hms-modal">
      <button class="hms-modal-close" onclick="document.getElementById('staff-modal').classList.remove('open')">-</button>
      <h3>Add Staff Member</h3>
      <div class="hms-form-row">
        <div class="hms-form-group"><label class="hms-form-label">Full Name *</label><input class="hms-form-input" id="sf-name" placeholder="Dr. John Doe"></div>
        <div class="hms-form-group"><label class="hms-form-label">Role *</label>
          <select class="hms-form-select" id="sf-role" onchange="filterStaffDepts(this.value)">
            <option>Doctor</option><option>Nurse</option><option>Technician</option>
            <option>Admin Staff</option><option>Pharmacist</option><option>Receptionist</option>
            <option>Other</option>
          </select></div>
      </div>
      <div id="sf-role-other-wrap" style="display:none;margin-top:-0.5rem;margin-bottom:1rem">
        <label class="hms-form-label">Custom Role *</label>
        <input class="hms-form-input" id="sf-role-other" placeholder="Enter custom role...">
      </div>
      <div class="hms-form-row">
        <div class="hms-form-group"><label class="hms-form-label">Phone</label><input class="hms-form-input" id="sf-phone" placeholder="+91 ..."></div>
        <div class="hms-form-group"><label class="hms-form-label">Email</label><input class="hms-form-input" id="sf-email" type="email"></div>
      </div>
      <div class="hms-form-row">
        <div class="hms-form-group"><label class="hms-form-label">Shift</label>
          <select class="hms-form-select" id="sf-shift"><option>Day</option><option>Night</option><option>Rotation</option></select></div>
        <div class="hms-form-group"><label class="hms-form-label">Department</label>
          <select class="hms-form-select" id="sf-dept" onchange="document.getElementById('sf-dept-other-wrap').style.display = this.value==='Other'?'block':'none'">
            <option value="">None</option>
            <option>Cardiology</option><option>Radiology</option><option>Neurology</option>
            <option>Orthopedics</option><option>Pediatrics</option><option>Oncology</option>
            <option>Emergency (ED)</option><option>ENT</option><option>Ophthalmology</option>
            <option>Dermatology</option><option>General Medicine</option><option>Gynecology</option>
            <option>Psychiatry</option><option>Pathology</option><option>Pharmacy</option><option>Laboratory</option><option>ICU / Critical Care</option>
            <option>Other</option>
          </select></div>
      </div>
      <div id="sf-dept-other-wrap" style="display:none;margin-top:-0.5rem;margin-bottom:1rem">
        <label class="hms-form-label">Custom Department Name *</label>
        <input class="hms-form-input" id="sf-dept-other" placeholder="Enter department name...">
      </div>
      <div class="hms-modal-actions">
        <button class="hms-btn hms-btn-ghost" onclick="document.getElementById('staff-modal').classList.remove('open')">Cancel</button>
        <button class="hms-btn hms-btn-green" onclick="saveStaff('${hid}')">${icon('person_add')} Add Staff</button>
      </div>
    </div>
  </div>

  <!-- Inventory Modal -->
  <div class="hms-modal-backdrop" id="inv-modal">
    <div class="hms-modal">
      <button class="hms-modal-close" onclick="document.getElementById('inv-modal').classList.remove('open')">-</button>
      <h3 id="inv-modal-title">Add Inventory Item</h3>
      <input type="hidden" id="inv-edit-id">
      <div class="hms-form-row">
        <div class="hms-form-group"><label class="hms-form-label">Item Name *</label><input class="hms-form-input" id="inv-name" placeholder="Paracetamol 500mg"></div>
        <div class="hms-form-group"><label class="hms-form-label">Category</label>
          <select class="hms-form-select" id="inv-cat"><option>Medicine</option><option>Equipment</option><option>Consumable</option><option>PPE</option><option>Lab Reagent</option></select></div>
      </div>
      <div class="hms-form-row">
        <div class="hms-form-group"><label class="hms-form-label">Quantity</label><input class="hms-form-input" id="inv-qty" type="number" placeholder="100" min="0"></div>
        <div class="hms-form-group"><label class="hms-form-label">Unit</label><input class="hms-form-input" id="inv-unit" placeholder="tablets / pcs / ml"></div>
      </div>
      <div class="hms-form-group"><label class="hms-form-label">Reorder Level (alert below this)</label><input class="hms-form-input" id="inv-reorder" type="number" placeholder="20" min="0"></div>
      <div class="hms-modal-actions">
        <button class="hms-btn hms-btn-ghost" onclick="document.getElementById('inv-modal').classList.remove('open')">Cancel</button>
        <button class="hms-btn hms-btn-green" onclick="saveInventory('${hid}')">${icon('save')} Save Item</button>
      </div>
    </div>
  </div>

  <!-- Department Modal -->
  <div class="hms-modal-backdrop" id="dept-modal">
    <div class="hms-modal">
      <button class="hms-modal-close" onclick="document.getElementById('dept-modal').classList.remove('open')">-</button>
      <h3>Add Department</h3>
      <div class="hms-form-group"><label class="hms-form-label">Department Name *</label>
        <select class="hms-form-select" id="dept-name" onchange="document.getElementById('dept-other-wrap').style.display = this.value==='Other'?'block':'none'">
          <option value="">Select Department...</option>
          <option>Cardiology</option><option>Radiology</option><option>Neurology</option>
          <option>Orthopedics</option><option>Pediatrics</option><option>Oncology</option>
          <option>Emergency (ED)</option><option>ENT</option><option>Ophthalmology</option>
          <option>Dermatology</option><option>General Medicine</option><option>Gynecology</option>
          <option>Psychiatry</option><option>Pathology</option><option>Pharmacy</option><option>Laboratory</option><option>ICU / Critical Care</option>
          <option>Other</option>
        </select>
      </div>
      <div id="dept-other-wrap" style="display:none;margin-top:-0.5rem;margin-bottom:1rem">
        <label class="hms-form-label">Custom Department Name *</label>
        <input class="hms-form-input" id="dept-name-other" placeholder="Enter department name...">
      </div>
      <div class="hms-form-group"><label class="hms-form-label">Department Head</label><input class="hms-form-input" id="dept-head" placeholder="Dr. Name"></div>
      <div class="hms-modal-actions">
        <button class="hms-btn hms-btn-ghost" onclick="document.getElementById('dept-modal').classList.remove('open')">Cancel</button>
        <button class="hms-btn hms-btn-green" onclick="saveDept('${hid}')">${icon('add')} Add</button>
      </div>
    </div>
  </div>`;

  // Tab loader
  const showHHTab = async (tabId) => {
    document.querySelectorAll('#hh-nav li').forEach(li => { li.classList.toggle('active', li.querySelector('button').dataset.tab === tabId); });
    document.getElementById('hh-page-title').textContent = tabs.find(t=>t.id===tabId)?.label||'';
    const el = document.getElementById('hh-content');
    el.innerHTML = `<div style="display:flex;justify-content:center;padding:3rem"><div class="spinner" style="border-top-color:var(--hms-green)"></div></div>`;
    try {
      if (tabId==='overview')    { const d = await api(`/api/hospital-head/${hid}/dashboard`); renderHHOverview(el,d,hh); }
      else if (tabId==='active-doctors') { const d = await api(`/api/hospital-head/${hid}/doctors/active`); renderHHActiveStaff(el, d.activeDoctors||[], hid); }
      else if (tabId==='beds')   { const res = await api('/api/beds/search'); const hdata = res.hospitals.find(x=>x.hospital_id===hid) || {}; renderHHBeds(el, hdata, hid); }
      else if (tabId==='approvals') { const d = await api(`/api/hospital-head/${hid}/doctors/pending`); renderHHApprovals(el, d.pendingDoctors||[], hid); }
      else if (tabId==='departments') { const d = await api(`/api/hospital-head/${hid}/departments`); renderHHDepts(el,d.departments||[],hid); }
      else if (tabId==='staff')  { const [s,d] = await Promise.all([api(`/api/hospital-head/${hid}/staff`), api(`/api/hospital-head/${hid}/departments`)]); renderHHStaff(el,s.staff||[],d.departments||[],hid); }
      else if (tabId==='inventory') { const d = await api(`/api/hospital-head/${hid}/inventory`); renderHHInventory(el,d.inventory||[],hid); }
      else if (tabId==='patients')  { renderHHPatients(el); }
    } catch(e) { el.innerHTML = `<div class="hms-empty">${icon('error')}<p>Failed to load data.</p></div>`; }
  };

  document.querySelectorAll('#hh-nav button[data-tab]').forEach(btn => btn.onclick = () => showHHTab(btn.dataset.tab));
  showHHTab('overview');

  const ALL_HMS_DEPTS = ['Cardiology','Radiology','Neurology','Orthopedics','Pediatrics','Oncology','Emergency (ED)','ENT','Ophthalmology','Dermatology','General Medicine','Gynecology','Psychiatry','Pathology','Pharmacy','Laboratory','ICU / Critical Care'];
  
  window.filterStaffDepts = (role) => {
    const roleOther = document.getElementById('sf-role-other-wrap');
    if(roleOther) roleOther.style.display = role==='Other'?'block':'none';
    
    const deptSel = document.getElementById('sf-dept');
    if(!deptSel) return;
    
    const mapping = {
      'Nurse': ['General Medicine', 'Emergency (ED)', 'ICU / Critical Care', 'Pediatrics', 'Gynecology'],
      'Pharmacist': ['Pharmacy'],
      'Technician': ['Radiology', 'Pathology', 'Laboratory'],
      'Receptionist': ['General Medicine'],
      'Admin Staff': ['General Medicine'],
      'Doctor': ALL_HMS_DEPTS,
      'Other': ALL_HMS_DEPTS
    };
    
    const relevant = mapping[role] || ALL_HMS_DEPTS;
    let html = '<option value="">Select Department...</option>';
    relevant.forEach(d => { html += `<option>${d}</option>`; });
    html += '<option>Other</option>';
    
    deptSel.innerHTML = html;
    if(relevant.length === 1) deptSel.value = relevant[0];
  };

  // Staff CRUD
  window.openStaffModal = async () => {
    ['sf-name','sf-phone','sf-email','sf-role-other','sf-dept-other'].forEach(id=>{ const el = document.getElementById(id); if(el) el.value=''; });
    document.getElementById('sf-role-other-wrap').style.display = 'none';
    document.getElementById('sf-dept-other-wrap').style.display = 'none';
    
    // Default filter for Doctor (Initial Role)
    document.getElementById('sf-role').value = 'Doctor';
    filterStaffDepts('Doctor');
    
    document.getElementById('staff-modal').classList.add('open');
  };
  window.saveStaff = async (hospitalId) => {
    let role = document.getElementById('sf-role').value;
    if (role === 'Other') role = document.getElementById('sf-role-other').value;
    
    let deptName = document.getElementById('sf-dept').value;
    if (deptName === 'Other') deptName = document.getElementById('sf-dept-other').value;

    const body = { 
      name:document.getElementById('sf-name').value.trim(), 
      role,
      phone:document.getElementById('sf-phone').value.trim(), 
      email:document.getElementById('sf-email').value.trim(),
      shift:document.getElementById('sf-shift').value, 
      department_name: deptName || null 
    };
    if (!body.name) { showToast('Staff name required','error'); document.getElementById('sf-name').focus(); return; }
    
    const btn = document.querySelector('#staff-modal .hms-btn-green');
    const origTxt = btn ? btn.innerHTML : '';
    if (btn) { 
      btn.innerHTML = `<span class="sync-orb" style="width:.85rem;height:.85rem"></span> Pulse Syncing...`; 
      btn.disabled = true; 
    }

    try { 
      await api(`/api/hospital-head/${hospitalId}/staff`,{method:'POST',body}); 
      if (btn) {
        btn.innerHTML = `<span>[-]</span> Added!`;
        btn.style.background = 'linear-gradient(135deg,#00c853,#00e676)';
      }
      showToast('Staff member added successfully!','success'); 
      setTimeout(() => {
        const modal = document.getElementById('staff-modal');
        if (modal) modal.classList.remove('open');
        if (typeof showHHTab === 'function') showHHTab('staff'); 
      }, 700);
    } catch(e){
      if (btn) { btn.innerHTML = origTxt; btn.disabled = false; btn.style.background = ''; }
    }
  };
  window.deleteStaff = async (hospitalId, id, name) => {
    if (!confirm(`Remove ${name}?`)) return;
    try { 
      await api(`/api/hospital-head/${hospitalId}/staff/${id}`,{method:'DELETE'}); 
      showToast('Removed','success'); 
      if (typeof showHHTab === 'function') showHHTab('staff'); 
    } catch(e){}
  };

  // Inventory CRUD
  window.openInvModal = (item=null) => {
    document.getElementById('inv-edit-id').value = item?.id||'';
    document.getElementById('inv-modal-title').textContent = item ? 'Edit Item' : 'Add Inventory Item';
    document.getElementById('inv-name').value    = item?.item_name||'';
    document.getElementById('inv-cat').value     = item?.category||'Medicine';
    document.getElementById('inv-qty').value     = item?.quantity||'';
    document.getElementById('inv-unit').value    = item?.unit||'';
    document.getElementById('inv-reorder').value = item?.reorder_level||'';
    document.getElementById('inv-modal').classList.add('open');
  };
  window.saveInventory = async (hospitalId) => {
    const id = document.getElementById('inv-edit-id').value;
    const body = {
      item_name: document.getElementById('inv-name').value.trim(),
      category:  document.getElementById('inv-cat').value,
      quantity:  document.getElementById('inv-qty').value,
      unit:      document.getElementById('inv-unit').value.trim(),
      reorder_level: document.getElementById('inv-reorder').value
    };
    if (!body.item_name) { showToast('Item name required', 'error'); document.getElementById('inv-name').focus(); return; }

    const btn = document.querySelector('#inv-modal .hms-btn-green');
    const origTxt = btn ? btn.innerHTML : '';
    if (btn) {
      btn.innerHTML = `<span class="sync-orb" style="width:.85rem;height:.85rem"></span> Inventory Sync...`;
      btn.disabled = true;
    }

    try {
      if (id) await api(`/api/hospital-head/${hospitalId}/inventory/${id}`, {method:'PUT', body});
      else    await api(`/api/hospital-head/${hospitalId}/inventory`, {method:'POST', body});
      
      if (btn) {
        btn.innerHTML = `<span>[-]</span> ${id ? 'Updated!' : 'Added!'}`;
        btn.style.background = 'linear-gradient(135deg,#00c853,#00e676)';
      }
      showToast(id ? 'Inventory updated!' : 'Item added to inventory!', 'success');
      
      setTimeout(() => {
        const modal = document.getElementById('inv-modal');
        if (modal) modal.classList.remove('open');
        if (typeof showHHTab === 'function') showHHTab('inventory');
      }, 700);
    } catch(e) {
      if (btn) { btn.innerHTML = origTxt; btn.disabled = false; btn.style.background = ''; }
    }
  };
  window.deleteInventory = async (hospitalId, id, name) => {
    if (!confirm(`Remove "${name}"?`)) return;
    try { 
      await api(`/api/hospital-head/${hospitalId}/inventory/${id}`,{method:'DELETE'}); 
      showToast('Removed','success'); 
      if (typeof showHHTab === 'function') showHHTab('inventory');
    } catch(e){}
  };

  // Department CRUD
  window.openDeptModal = () => {
    ['dept-name','dept-head'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('dept-modal').classList.add('open');
  };
  window.saveDept = async (hospitalId) => {
    let name = document.getElementById('dept-name').value;
    if (name === 'Other') name = document.getElementById('dept-name-other').value.trim();
    const body = { name, head_name: document.getElementById('dept-head').value.trim() };
    if (!body.name) { showToast('Department name required', 'error'); return; }

    const btn = document.querySelector('#dept-modal .hms-btn-green');
    const origTxt = btn ? btn.innerHTML : '';
    if (btn) {
      btn.innerHTML = `<span class="sync-orb" style="width:.85rem;height:.85rem"></span> Formatting Archive...`;
      btn.disabled = true;
    }

    try {
      await api(`/api/hospital-head/${hospitalId}/departments`, {method:'POST', body});
      if (btn) {
        btn.innerHTML = `<span>[-]</span> Formed!`;
        btn.style.background = 'linear-gradient(135deg,#00c853,#00e676)';
      }
      showToast('Department initialized successfully!', 'success');
      setTimeout(() => {
        const modal = document.getElementById('dept-modal');
        if (modal) modal.classList.remove('open');
        if (typeof showHHTab === 'function') showHHTab('departments');
      }, 700);
    } catch(e) {
      if (btn) { btn.innerHTML = origTxt; btn.disabled = false; btn.style.background = ''; }
    }
  };
  window.deleteDept = async (hospitalId, id, name) => {
    if (!confirm(`Delete department "${name}"?`)) return;
    try { 
      await api(`/api/hospital-head/${hospitalId}/departments/${id}`,{method:'DELETE'}); 
      showToast('Deleted','success'); 
      if (typeof showHHTab === 'function') showHHTab('departments');
    } catch(e){}
  };
}

function renderHHOverview(el, data, hh) {
  const s = data.stats||{}, h = data.hospital||{};
  el.innerHTML = `
  <div class="kpi-grid">
    <div class="kpi-card green"><div class="kpi-icon green">${icon('category')}</div><div class="kpi-label">Departments</div><div class="kpi-value">${s.departments||0}</div></div>
    <div class="kpi-card blue"><div class="kpi-icon blue">${icon('groups')}</div><div class="kpi-label">Staff</div><div class="kpi-value">${s.staff||0}</div></div>
    <div class="kpi-card orange"><div class="kpi-icon orange">${icon('inventory_2')}</div><div class="kpi-label">Inventory Items</div><div class="kpi-value">${s.inventory||0}</div></div>
    <div class="kpi-card red"><div class="kpi-icon red">${icon('warning')}</div><div class="kpi-label">Low Stock</div><div class="kpi-value">${s.lowStock||0}</div><div class="kpi-sub">${s.lowStock>0?'Reorder needed':'All stocked'}</div></div>
    <div class="kpi-card purple"><div class="kpi-icon purple">${icon('bed')}</div><div class="kpi-label">Total Beds</div><div class="kpi-value">${h.beds_total||0}</div></div>
    <div class="kpi-card gold"><div class="kpi-icon gold">${icon('location_city')}</div><div class="kpi-label">City</div><div class="kpi-value" style="font-size:1.125rem;padding-top:.25rem">${h.city||'-'}</div></div>
  </div>
  <div class="hms-card">
    <div class="hms-card-header"><h3>${icon('domain')} Hospital Info</h3></div>
    <div class="hms-card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
      ${[['Hospital Name',h.name],['Type',h.type||'Hospital'],['Phone',h.phone||'-'],['Email',h.email||'-'],['Address',h.address||'-']].map(([k,v])=>`
        <div><div style="font-size:.65rem;color:var(--hms-text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">${k}</div>
        <div style="font-size:.875rem;font-weight:600;color:var(--hms-text)">${v}</div></div>`).join('')}
    </div>
  </div>`;
}

function renderHHDepts(el, depts, hid) {
  el.innerHTML = `
  <div style="display:flex;justify-content:flex-end;margin-bottom:1rem">
    <button class="hms-btn hms-btn-green" onclick="openDeptModal()">${icon('add')} Add Department</button>
  </div>
  <div class="hms-table-wrap">
    <table class="hms-table">
      <thead><tr><th>Department</th><th>Head</th><th>Staff Count</th><th>Action</th></tr></thead>
      <tbody>${depts.length ? depts.map(d=>`<tr>
        <td style="font-weight:600">${d.name}</td>
        <td style="color:var(--hms-text-muted)">${d.head_name||'-'}</td>
        <td>${d.staff_count||0}</td>
        <td><button class="hms-btn hms-btn-danger" onclick="deleteDept('${hid}','${d.id}','${d.name.replace(/'/g,"\\")}')">${icon('delete')}</button></td>
      </tr>`).join('') : `<tr><td colspan="4"><div class="hms-empty">${icon('category')}<p>No departments yet.</p></div></td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function renderHHStaff(el, staffList, depts, hid) {
  el.innerHTML = `
  <div style="display:flex;justify-content:flex-end;margin-bottom:1rem">
    <button class="hms-btn hms-btn-green" onclick="openStaffModal()">${icon('person_add')} Add Staff</button>
  </div>
  <div class="hms-table-wrap">
    <table class="hms-table">
      <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Shift</th><th>Phone</th><th>Action</th></tr></thead>
      <tbody>${staffList.length ? staffList.map(s=>`<tr>
        <td style="font-weight:600">${s.name}</td>
        <td><span class="hms-status muted">${s.role||'Staff'}</span></td>
        <td style="color:var(--hms-text-muted)">${s.department_name||'-'}</td>
        <td style="color:var(--hms-text-muted)">${s.shift||'Day'}</td>
        <td style="color:var(--hms-text-muted)">${s.phone||'-'}</td>
        <td><button class="hms-btn hms-btn-danger" onclick="deleteStaff('${hid}','${s.id}','${s.name.replace(/'/g,"\\")}')">${icon('delete')}</button></td>
      </tr>`).join('') : `<tr><td colspan="6"><div class="hms-empty">${icon('groups')}<p>No staff yet.</p></div></td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function renderHHActiveStaff(el, doctors, hid) {
  el.innerHTML = `
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; background:var(--surface-container-lowest); padding:1rem 1.5rem; border-radius:var(--radius-lg); box-shadow:var(--shadow-sm);">
    <div>
      <h2 style="font-size:1.25rem; font-weight:700; color:var(--on-surface);">Verified Doctors Tracker</h2>
      <p style="font-size:0.875rem; color:var(--on-surface-variant);">Monitor active staff availability and details.</p>
    </div>
    <div style="position:relative; width:300px;">
      <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--outline);">${icon('search')}</span>
      <input type="text" id="active-doc-search" placeholder="Search by name or department..." style="width:100%; padding:0.6rem 1rem 0.6rem 2.5rem; border-radius:var(--radius-full); border:1px solid var(--outline-variant); outline:none; font-family:inherit; transition:0.2s; background:var(--surface-container-low); box-shadow:0 2px 4px rgba(0,0,0,0.02);" onfocus="this.style.borderColor='var(--primary)'; this.style.boxShadow='0 0 0 3px rgba(0,93,144,0.1)';" onblur="this.style.borderColor='var(--outline-variant)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.02)';">
    </div>
  </div>
  <div class="hms-table-wrap">
    <table class="hms-table" id="active-docs-table">
      <thead><tr><th>Doctor</th><th>Department</th><th>Contact</th><th>Status</th></tr></thead>
      <tbody>${doctors.length ? doctors.map(d=>`
      <tr class="doc-row">
        <td>
          <div style="display:flex; align-items:center; gap:1rem;">
            <div style="width:2.5rem; height:2.5rem; border-radius:50%; background:var(--primary-gradient); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700;">
              ${d.profile_photo ? `<img src="${d.profile_photo}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">` : (d.name||'').substring(0,1).toUpperCase()}
            </div>
            <div>
              <div class="doc-name" style="font-weight:700; font-size:1rem; color:var(--on-surface);">Dr. ${d.name}</div>
              <div style="font-size:0.75rem; color:var(--on-surface-variant);"><span style="font-family:monospace;letter-spacing:0.05em;color:var(--outline)">LIC</span> ${d.license_number}</div>
            </div>
          </div>
        </td>
        <td><span class="doc-dept hms-status muted">${d.specialization || 'General Medicine'}</span></td>
        <td>
          <div style="font-size:0.875rem;">${d.phone}</div>
          <div style="font-size:0.8125rem; color:var(--on-surface-variant);">${d.email}</div>
        </td>
        <td><span class="hms-status ok glowing">Active</span></td>
      </tr>`).join('') : `<tr><td colspan="4"><div class="hms-empty">${icon('groups')}<p>No active doctors yet.</p></div></td></tr>`}
      </tbody>
    </table>
  </div>`;

  const searchInput = document.getElementById('active-doc-search');
  if (searchInput) {
    searchInput.oninput = function() {
      const query = this.value.toLowerCase().trim();
      const rows = document.querySelectorAll('.doc-row');
      rows.forEach(row => {
        const name = row.querySelector('.doc-name').textContent.toLowerCase();
        const dept = row.querySelector('.doc-dept').textContent.toLowerCase();
        if (name.includes(query) || dept.includes(query)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    };
  }
}

function renderHHInventory(el, items, hid) {
  el.innerHTML = `
  <div style="display:flex;justify-content:flex-end;margin-bottom:1rem">
    <button class="hms-btn hms-btn-green" onclick="openInvModal()">${icon('add')} Add Item</button>
  </div>
  <div class="hms-table-wrap">
    <table class="hms-table">
      <thead><tr><th>Item</th><th>Category</th><th>Quantity</th><th>Unit</th><th>Stock Status</th><th>Actions</th></tr></thead>
      <tbody>${items.length ? items.map(it=>{
        const low = it.quantity <= it.reorder_level;
        return `<tr>
          <td style="font-weight:600">${it.item_name}</td>
          <td><span class="hms-status muted">${it.category||'Medicine'}</span></td>
          <td style="font-weight:700;color:${low?'var(--hms-red)':'var(--hms-text)'}">${it.quantity}</td>
          <td style="color:var(--hms-text-muted)">${it.unit||'pcs'}</td>
          <td>${low ? `<span class="hms-status danger">${icon('warning')} Low Stock</span>` : `<span class="hms-status ok">${icon('check_circle')} OK</span>`}</td>
          <td>
            <button class="hms-btn hms-btn-ghost" onclick='openInvModal(${JSON.stringify(it).replace(/'/g,"&apos;")})'>${icon('edit')}</button>
            <button class="hms-btn hms-btn-danger" style="margin-left:.25rem" onclick="deleteInventory('${hid}',${it.id},'${it.item_name.replace(/'/g,"\\'")}'">${icon('delete')}</button>
          </td>
        </tr>`;
      }).join('') : `<tr><td colspan="6"><div class="hms-empty">${icon('inventory_2')}<p>No inventory items.</p></div></td></tr>`}
      </tbody>
    </table>
  </div>`;
}

function renderHHPatients(el) {
  el.innerHTML = `
  <div class="hms-card">
    <div class="hms-card-header"><h3>${icon('personal_injury')} Patients at This Hospital</h3></div>
    <div class="hms-card-body">
      <div class="hms-empty" style="padding:2rem">
        ${icon('qr_code_scanner')}
        <p>Patient records are accessed via QR scan or the main portal.<br>
        Use the <a href="#/scan" style="color:var(--hms-green)">QR Scanner</a> to look up a patient.</p>
      </div>
    </div>
  </div>`;
}

function renderHHBeds(el, data, hid) {
  el.innerHTML = `
  <div class="hms-card">
    <div class="hms-card-header"><h3>${icon('bed')} Manage Bed Availability</h3></div>
    <div class="hms-card-body">
      <p style="margin-bottom:1.5rem;color:var(--hms-text-muted)">Update bed counts to make them visible on the public Bed Tracker immediately.</p>
      
      <div class="hms-form-row">
        <div class="hms-form-group">
          <label class="hms-form-label" style="color:#b50514">${icon('medical_services')} ICU Beds (Available / Total)</label>
          <div style="display:flex;gap:0.5rem">
            <input type="number" id="bed-icu-av" class="hms-form-input" value="${data.icu_available||0}" min="0">
            <span style="align-self:center">/</span>
            <input type="number" id="bed-icu-tot" class="hms-form-input" value="${data.icu_total||0}" min="0">
          </div>
        </div>
        <div class="hms-form-group">
          <label class="hms-form-label">${icon('local_hospital')} Emergency Beds</label>
          <div style="display:flex;gap:0.5rem">
            <input type="number" id="bed-em-av" class="hms-form-input" value="${data.emergency_available||0}" min="0">
            <span style="align-self:center">/</span>
            <input type="number" id="bed-em-tot" class="hms-form-input" value="${data.emergency_total||0}" min="0">
          </div>
        </div>
      </div>
      
      <div class="hms-form-row">
        <div class="hms-form-group">
          <label class="hms-form-label">${icon('bed')} General Ward</label>
          <div style="display:flex;gap:0.5rem">
            <input type="number" id="bed-gen-av" class="hms-form-input" value="${data.general_available||0}" min="0">
            <span style="align-self:center">/</span>
            <input type="number" id="bed-gen-tot" class="hms-form-input" value="${data.general_total||0}" min="0">
          </div>
        </div>
        <div class="hms-form-group">
          <label class="hms-form-label">${icon('pregnant_woman')} Maternity</label>
          <div style="display:flex;gap:0.5rem">
            <input type="number" id="bed-mat-av" class="hms-form-input" value="${data.maternity_available||0}" min="0">
            <span style="align-self:center">/</span>
            <input type="number" id="bed-mat-tot" class="hms-form-input" value="${data.maternity_total||0}" min="0">
          </div>
        </div>
      </div>

      <div class="hms-form-group" style="max-width:300px">
        <label class="hms-form-label">${icon('child_care')} Pediatric</label>
        <div style="display:flex;gap:0.5rem">
          <input type="number" id="bed-ped-av" class="hms-form-input" value="${data.pediatric_available||0}" min="0">
          <span style="align-self:center">/</span>
          <input type="number" id="bed-ped-tot" class="hms-form-input" value="${data.pediatric_total||0}" min="0">
        </div>
      </div>

      <button class="hms-btn btn-tertiary mt-2" onclick="saveBeds('${hid}')">${icon('save')} Publish Updates</button>
    </div>
  </div>`;
  
  window.saveBeds = async (id) => {
    try {
      await api('/api/hospital-head/' + id + '/beds', {
        method: 'POST', body: {
          icu_available: parseInt(document.getElementById('bed-icu-av').value),
          icu_total: parseInt(document.getElementById('bed-icu-tot').value),
          emergency_available: parseInt(document.getElementById('bed-em-av').value),
          emergency_total: parseInt(document.getElementById('bed-em-tot').value),
          general_available: parseInt(document.getElementById('bed-gen-av').value),
          general_total: parseInt(document.getElementById('bed-gen-tot').value),
          maternity_available: parseInt(document.getElementById('bed-mat-av').value),
          maternity_total: parseInt(document.getElementById('bed-mat-tot').value),
          pediatric_available: parseInt(document.getElementById('bed-ped-av').value),
          pediatric_total: parseInt(document.getElementById('bed-ped-tot').value)
        }
      });
      showToast('Beds updated publicly!', 'success');
    } catch(e) { showToast('Failure to update', 'error'); }
  };
}

// ============================================================
// BED TRACKER PUBLIC PAGES
// ============================================================

function getBedStatusBadge(av, tot) {
  if (tot === 0 || !tot) return '<span style="color:var(--outline);font-size:0.8rem">Not setup</span>';
  const pct = av / tot;
  if (av === 0) return `<span class="status-badge status-red">${icon('cancel')} Full (0)</span>`;
  if (pct <= 0.25) return `<span class="status-badge status-yellow">${icon('warning')} Lim (${av})</span>`;
  return `<span class="status-badge status-green">${icon('check_circle')} Avail (${av})</span>`;
}

function getBedRow(label, av, tot, hint) {
  return `<tr>
    <td>${label} <span class="text-muted" style="font-size:0.65rem;display:block;font-weight:400">${hint}</span></td>
    <td class="text-center">${tot||0}</td>
    <td class="text-right">${getBedStatusBadge(av, tot)}</td>
  </tr>`;
}

async function renderBedSearch(app) {
  app.innerHTML = `${navbar()}
  <div class="page-enter container" style="padding:2rem 0; min-height:80vh;">
    <div class="bed-tracker-hero">
      <h1 class="bed-tracker-title">Hospital Bed Tracker</h1>
      <p style="font-size:1.1rem; color:var(--on-surface-variant)">Find real-time bed availability in emergencies</p>
      
      <div class="bed-search-box">
        <div style="padding:0.5rem; color:var(--tertiary)">${icon('search')}</div>
        <input type="text" id="bed-search-q" class="bed-search-input" placeholder="Search by city, hospital, or pincode...">
        <button class="btn btn-tertiary" style="border-radius:var(--radius-full)" onclick="doBedSearch()">${icon('arrow_forward')}</button>
      </div>
      
      <div style="margin-top:1.5rem; display:flex; justify-content:center; gap:1rem;">
        <button class="btn btn-outline" style="background:#fff" onclick="searchNearMe()">${icon('my_location')} Near Me</button>
        <button class="btn btn-outline" style="background:#fff" onclick="navigate('/beds/stats')">${icon('leaderboard')} City Stats</button>
      </div>
    </div>
    
    <div id="bed-results">
       <div style="text-align:center; padding:3rem; color:var(--on-surface-variant)">
          <div class="spinner" style="margin:0 auto; border-top-color:var(--tertiary);"></div>
       </div>
    </div>
  </div>`;
  
  window.doBedSearch = async (query = '') => {
    const q = query || document.getElementById('bed-search-q').value;
    const resDiv = document.getElementById('bed-results');
    resDiv.innerHTML = '<div class="spinner" style="margin:3rem auto; border-top-color:var(--tertiary)"></div>';
    try {
      const data = await api('/api/beds/search?q=' + encodeURIComponent(q));
      if (!data.hospitals.length) {
        resDiv.innerHTML = `<div class="hms-empty" style="padding:4rem 0">
          <div style="font-size:3rem; color:var(--outline-variant); margin-bottom:1rem">${icon('search_off', 'text-tertiary')}</div>
          <p>No hospitals found in this area.</p>
        </div>`;
        return;
      }
      resDiv.innerHTML = `<div class="bed-results-grid">
        ${data.hospitals.map(h => `<div class="bed-card">
          <div class="bed-card-header">
            <div><h3 class="bed-card-title">${h.name}</h3>
            <span class="bed-card-meta">${icon('location_on', 'text-tertiary')} ${h.city || h.address}</span></div>
          </div>
          <table class="bed-table">
            <thead><tr><th>Bed Type</th><th class="text-center">Total</th><th class="text-right">Status</th></tr></thead>
            <tbody>
              ${getBedRow('ICU', h.icu_available, h.icu_total, 'Intensive Care')}
              ${getBedRow('Emergency', h.emergency_available, h.emergency_total, 'Trauma/ER')}
              ${getBedRow('General', h.general_available, h.general_total, 'Standard Ward')}
            </tbody>
          </table>
          <span class="bed-update-time">Updated: ${h.last_updated ? Math.round((new Date()-new Date(h.last_updated))/60000) + ' mins ago' : 'Never'}</span>
          <div class="bed-card-actions">
            <a href="tel:${h.phone||''}" class="btn btn-tertiary">${icon('call')} Call</a>
            <a href="https://maps.google.com/?q=${encodeURIComponent(h.name + ' ' + (h.city||''))}" target="_blank" class="btn btn-outline" style="border-color:var(--outline-variant)">${icon('directions')} Directions</a>
          </div>
        </div>`).join('')}
      </div>`;
    } catch(e) { resDiv.innerHTML = `<p class="text-center text-tertiary">Failed to load bed data</p>`; }
  };
  
  window.searchNearMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(()=>doBedSearch(''), ()=>showToast('Location access denied','error'));
    } else showToast('Geolocation not supported','error');
  };
  
  // Initial load
  doBedSearch();
}

async function renderBedStats(app) {
  app.innerHTML = `${navbar()}
  <div class="page-enter container" style="padding:2rem 0; min-height:80vh;">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem;">
      <h1>${icon('leaderboard')} City Bed Statistics</h1>
      <button class="btn btn-tertiary" onclick="navigate('/beds')">${icon('search')} Find Hospital</button>
    </div>
    
    <div id="stats-content">
       <div class="spinner" style="margin:3rem auto; border-top-color:var(--tertiary);"></div>
    </div>
  </div>`;
  
  try {
    const data = await api('/api/beds/stats');
    const s = data.stats;
    const cards = [
      { t: 'ICU',     a: s.icu_avail,   tot: s.icu_total, ico: 'medical_services' },
      { t: 'Emerg',   a: s.emerg_avail, tot: s.emerg_total, ico: 'local_hospital' },
      { t: 'General', a: s.gen_avail,   tot: s.gen_total, ico: 'bed' },
      { t: 'Maternity', a: s.mat_avail, tot: s.mat_total, ico: 'pregnant_woman' },
      { t: 'Pediatric', a: s.ped_avail, tot: s.ped_total, ico: 'child_care' }
    ];
    
    document.getElementById('stats-content').innerHTML = `
    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1.5rem; margin-bottom:3rem">
      ${cards.map(c => `<div class="bed-card text-center" style="padding:2rem 1rem">
        <div style="font-size:2rem; color:var(--tertiary); margin-bottom:0.5rem">${icon(c.ico)}</div>
        <h3 style="font-size:1.1rem; color:var(--on-surface-variant)">${c.t} Beds</h3>
        <p style="font-size:2rem; font-weight:800; font-family:'Manrope',sans-serif; margin-top:0.5rem">${c.a} <span style="font-size:1rem; color:var(--outline); font-weight:500">/ ${c.tot}</span></p>
      </div>`).join('')}
    </div>
    
    <div class="bed-card" style="background:var(--tertiary-light); box-shadow:none;">
      <h3 style="color:var(--tertiary); display:flex; align-items:center; gap:0.5rem; margin-bottom:1rem">${icon('campaign')} Emergency Contacts</h3>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(250px, 1fr)); gap:1rem;">
        ${data.emergency_contacts.map(e => `<div style="background:#fff; padding:1rem; border-radius:var(--radius-md); display:flex; justify-content:space-between; align-items:center">
          <div><h4 style="font-size:1rem">${e.name}</h4><p style="font-size:0.8rem; color:var(--on-surface-variant)">${e.city||'General'}</p></div>
          <a href="tel:${e.phone}" class="btn-tertiary" style="padding:0.5rem 1rem; border-radius:var(--radius-full); font-weight:600; text-decoration:none">${icon('call')} ${e.phone}</a>
        </div>`).join('')}
      </div>
    </div>`;
  } catch(e) {
    document.getElementById('stats-content').innerHTML = `<p class="text-tertiary">Error loading statistics.</p>`;
  }
}


function renderHHApprovals(el, pending, hid) {
  el.innerHTML = `
  <div class="hms-table-wrap">
    <table class="hms-table">
      <thead><tr><th>Doctor Details</th><th>Credentials</th><th>Requested On</th><th>Action</th></tr></thead>
      <tbody>${pending.length ? pending.map(d=>`<tr>
        <td>
          <div style="font-weight:600">Dr. ${d.name}</div>
          <div style="font-size:.75rem;color:var(--hms-text-muted)">${d.specialization} * ${d.experience_years}y Exp.</div>
          <div style="font-size:.75rem;color:var(--hms-text-muted)">${d.email} * ${d.phone}</div>
        </td>
        <td>
          <div style="font-size:.75rem;margin-bottom:.25rem">License: <b>${d.license_number}</b></div>
          <button class="hms-btn hms-btn-green" style="font-size:.7rem;padding:.2rem .5rem" onclick="viewCertificate('${(d.medical_certificate||'').replace(/'/g,"\\'")}')">
            ${icon('visibility')} View Certificate
          </button>
        </td>
        <td style="color:var(--hms-text-muted);font-size:.75rem">${new Date(d.created_at).toLocaleDateString()}</td>
        <td>
          <div style="display:flex;gap:.5rem">
            <button class="hms-btn hms-btn-green" onclick="approveDoctor('${hid}','${d.id}','${d.name}')">Approve</button>
            <button class="hms-btn hms-btn-danger" onclick="rejectDoctor('${hid}','${d.id}','${d.name}')">Reject</button>
          </div>
        </td>
      </tr>`).join('') : `<tr><td colspan="4"><div class="hms-empty">${icon('verified_user')}<p>No pending approvals.</p></div></td></tr>`}
      </tbody>
    </table>
  </div>`;
  
  window.approveDoctor = async (hid, docId, name) => {
    if(!confirm(`Approve Dr. ${name}?`)) return;
    try {
      await api(`/api/hospital-head/${hid}/doctors/approve/${docId}`, { method: 'POST' });
      showToast('Doctor approved successfully!', 'success');
      const d = await api(`/api/hospital-head/${hid}/doctors/pending`);
      renderHHApprovals(document.getElementById('hh-content'), d.pendingDoctors||[], hid);
    } catch(e) { showToast('Execution failed', 'error'); }
  };
  
  window.rejectDoctor = async (hid, docId, name) => {
    if(!confirm(`Reject and delete registration for Dr. ${name}?`)) return;
    try {
      await api(`/api/hospital-head/${hid}/doctors/reject/${docId}`, { method: 'DELETE' });
      showToast('Registration rejected and deleted', 'info');
      const d = await api(`/api/hospital-head/${hid}/doctors/pending`);
      renderHHApprovals(document.getElementById('hh-content'), d.pendingDoctors||[], hid);
    } catch(e) { showToast('Execution failed', 'error'); }
  };
}

window.viewCertificate = (base64) => {
  try {
    if (!base64 || !base64.includes(';base64,')) {
      showToast('No valid certificate data found', 'error');
      return;
    }
    const parts = base64.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const byteCharacters = atob(parts[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {type: contentType});
    const url = URL.createObjectURL(blob);
    const win = window.open();
    if (win) {
      win.document.write(`<iframe src="${url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    } else {
      showToast('Pop-up blocked! Please allow pop-ups for this site.', 'error');
    }
  } catch(e) {
    console.error('Certificate view error:', e);
    showToast('Failed to open certificate', 'error');
  }
};

