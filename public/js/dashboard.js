/* SafeReach - Main Dashboard & Real-Time Socket Controller */

let currentUser = null;
let socket = null;
let activeCountdownIntervals = new Map();

document.addEventListener('DOMContentLoaded', async () => {
  currentUser = SafeReach.getUser();
  if (!currentUser || !SafeReach.getToken()) {
    window.location.href = '/login';
    return;
  }

  renderUserProfile();
  initSocketConnection();

  // Requirement 2: Request location permission when page loads
  if (window.SafeReachLocation) {
    SafeReachLocation.requestPermissionOnLoad();
  }

  // Render role-specific dashboard modules
  renderRoleDashboard();
  loadActiveEmergencies();
  loadEmergencyHistory();

  // Load account link requests based on role
  if (currentUser.role === 'senior_citizen' || currentUser.role === 'child') {
    loadSeniorLinkRequests();
  } else {
    loadResponderLinkRequests();
  }

  // Load Notifications and start 5-second polling fallback (Requirement 2)
  loadUserNotifications();
  setInterval(loadUserNotifications, 5000);

  // Listen for language change events and immediately re-translate the entire dashboard
  window.addEventListener('careconnect_language_changed', () => {
    if (window.CareConnectI18n) {
      CareConnectI18n.updateDOM();
    }
    renderUserProfile();
    loadActiveEmergencies();
    loadEmergencyHistory();
    loadUserNotifications();
    if (window.SafeReachLocation && SafeReachLocation.lastLocation) {
      if (SafeReachLocation.lastLocation.isFallback) {
        SafeReachLocation.useFallbackProfileLocation();
      } else {
        SafeReachLocation.refreshLocationWidget().catch(() => {});
      }
    }
  });
});

// Render Header User Info
function renderUserProfile() {
  const nameEl = document.getElementById('user-display-name');
  const roleEl = document.getElementById('user-display-role');
  const avatarEl = document.getElementById('user-avatar');
  const editBtn = document.getElementById('btn-edit-profile');

  if (nameEl) nameEl.textContent = currentUser.name;
  if (roleEl) roleEl.textContent = `${SafeReach.formatRole(currentUser.role)} • ${currentUser.apartmentNumber || currentUser.address || ''}`;
  if (avatarEl) avatarEl.textContent = currentUser.name.charAt(0).toUpperCase();

  if (editBtn) {
    if (currentUser.role === 'senior_citizen' || currentUser.role === 'child') {
      editBtn.innerHTML = `✏️ <span data-i18n="profile">Edit Profile & Contacts</span>`;
    } else {
      editBtn.innerHTML = `✏️ <span data-i18n="profile">Edit Profile</span>`;
    }
  }

  // Toggle Security Guard Duty status button or Volunteer Availability toggle if present
  const dutyContainer = document.getElementById('duty-status-container');
  if (dutyContainer) {
    if (currentUser.role === 'security_guard') {
      dutyContainer.innerHTML = `
        <button id="btn-toggle-duty" class="btn btn-sm ${currentUser.dutyStatus === 'ON_DUTY' ? 'btn-success' : 'btn-secondary'}">
          ${currentUser.dutyStatus === 'ON_DUTY' ? '🟢 ON DUTY' : '⚪ OFF DUTY'}
        </button>
      `;
      document.getElementById('btn-toggle-duty')?.addEventListener('click', toggleDutyStatus);
    } else if (currentUser.role === 'volunteer') {
      dutyContainer.innerHTML = `
        <button id="btn-toggle-avail" class="btn btn-sm ${currentUser.availability === 'AVAILABLE' ? 'btn-success' : 'btn-secondary'}">
          ${currentUser.availability === 'AVAILABLE' ? '⚡ AVAILABLE' : '🌙 UNAVAILABLE'}
        </button>
      `;
      document.getElementById('btn-toggle-avail')?.addEventListener('click', toggleVolunteerAvailability);
    }
  }
}

// Socket.IO Real-Time Engine Integration
function initSocketConnection() {
  if (typeof io === 'undefined') return;

  socket = io();

  socket.on('connect', () => {
    console.log('[Socket] Connected to SafeReach network. Joining rooms...');
    socket.emit('join_rooms', {
      userId: currentUser.id,
      role: currentUser.role
    });
  });

  // Tier 1 Alert (Neighbors & Security Guards)
  socket.on('NEW_EMERGENCY_ALERT', (data) => {
    SafeReach.showToast(data.message, 'danger');
    playNotificationSound();
    loadActiveEmergencies();
  });

  // Tier 2 Alert (Volunteers & Family)
  socket.on('EMERGENCY_ESCALATED', (data) => {
    SafeReach.showToast(data.message, 'danger');
    playNotificationSound();
    loadActiveEmergencies();
  });

  // Status updates
  socket.on('EMERGENCY_ACCEPTED', (data) => {
    SafeReach.showToast(data.message, 'success');
    loadActiveEmergencies();
    loadEmergencyHistory();
  });

  socket.on('EMERGENCY_RESOLVED', (data) => {
    SafeReach.showToast(data.message, 'success');
    loadActiveEmergencies();
    loadEmergencyHistory();
  });

  socket.on('SOS_STATUS_UPDATE', (data) => {
    SafeReach.showToast(data.message, data.status === 'ACCEPTED' ? 'success' : 'warning');
    renderActiveSOSTracker(data.emergency);
  });
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1200, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {}
}

// Render Dashboard View according to Role
function renderRoleDashboard() {
  const role = currentUser.role;

  const profileBar = document.getElementById('user-profile-bar');
  const emergencyLogsBtn = document.getElementById('btn-emergency-logs');
  const seniorSosView = document.getElementById('view-senior-sos');
  const responderFeed = document.getElementById('view-responder-feed');
  const mapSection = document.getElementById('view-map-section');
  const historySection = document.getElementById('history');
  const locationWidget = document.getElementById('location-widget-section');

  // Explicitly enable Live Location Widget & Map for ALL roles
  if (locationWidget) locationWidget.classList.remove('d-none');
  if (mapSection) mapSection.classList.remove('d-none');

  // Senior Citizen or Child View
  if (role === 'senior_citizen' || role === 'child') {
    if (profileBar) profileBar.classList.remove('d-none');
    if (emergencyLogsBtn) emergencyLogsBtn.classList.add('d-none');

    if (responderFeed) responderFeed.classList.add('d-none');
    if (historySection) historySection.classList.add('d-none');

    if (seniorSosView) seniorSosView.classList.remove('d-none');
    initSOSButtonEngine();
  } 
  // Responders (Neighbor / Security / Volunteer / Family Member / Admin)
  else {
    if (profileBar) profileBar.classList.remove('d-none');
    if (emergencyLogsBtn) emergencyLogsBtn.classList.remove('d-none');
    if (responderFeed) responderFeed.classList.remove('d-none');
    if (historySection) historySection.classList.remove('d-none');

    if (seniorSosView) seniorSosView.classList.add('d-none');
  }
}

// Initialize 3-Second Press & Hold SOS Button
function initSOSButtonEngine() {
  const sosBtn = document.getElementById('sos-press-btn');
  const ringProgress = document.getElementById('sos-ring-progress');

  if (!sosBtn || !ringProgress) return;

  new SOSTriggerEngine(sosBtn, ringProgress, {
    holdDuration: 3000,
    onComplete: async (coords) => {
      let lat = coords.latitude;
      let lng = coords.longitude;

      if (!lat || !lng || coords.error) {
        SafeReach.showToast('Location permission is required to send an emergency alert. Using registered address location.', 'warning');
        lat = Number(currentUser.latitude) || 12.9716;
        lng = Number(currentUser.longitude) || 77.5946;
      }

      try {
        SafeReach.showToast('Triggering SOS Emergency Alert with location...', 'warning');
        const googleMapsUrl = SafeReachLocation ? SafeReachLocation.generateGoogleMapsUrl(lat, lng) : `https://www.google.com/maps?q=${lat},${lng}`;
        
        const data = await SafeReach.api('/api/emergency/trigger', {
          method: 'POST',
          body: JSON.stringify({
            latitude: lat,
            longitude: lng,
            googleMapsUrl: googleMapsUrl,
            address: currentUser.address,
            emergencyType: 'Immediate SOS Assistance Required',
            medicalInfo: currentUser.medicalInfo
          })
        });

        SafeReach.showToast('🚨 EMERGENCY ALERT BROADCASTED WITH LOCATION!', 'danger');
        renderActiveSOSTracker(data.emergency);
        loadActiveEmergencies();
      } catch (err) {
        SafeReach.showToast(err.message, 'danger');
      }
    }
  });
}

// Render Active SOS Tracker for Senior / Child
function renderActiveSOSTracker(emergency) {
  const trackerEl = document.getElementById('active-sos-tracker');
  if (!trackerEl) return;

  if (!emergency || emergency.status === 'RESOLVED' || emergency.status === 'CANCELLED') {
    trackerEl.innerHTML = '';
    trackerEl.classList.add('d-none');
    return;
  }

  trackerEl.classList.remove('d-none');
  
  let statusBadge = `<span class="badge badge-pending">PENDING (NOTIFYING NEIGHBORS & SECURITY)</span>`;
  if (emergency.status === 'ACCEPTED') {
    statusBadge = `<span class="badge badge-accepted">RESPONDER ACCEPTED</span>`;
  } else if (emergency.status === 'ESCALATED_VOLUNTEER') {
    statusBadge = `<span class="badge badge-escalated">ESCALATED TO VOLUNTEERS & FAMILY</span>`;
  }

  let responderInfo = 'Searching for nearby responders...';
  if (emergency.acceptedBy && emergency.acceptedBy.name) {
    responderInfo = `
      <div style="margin-top:0.75rem; padding:0.75rem; background:rgba(0,122,255,0.15); border-radius:8px; border:1px solid #007aff;">
        <strong>Assigned Responder:</strong> ${emergency.acceptedBy.name} (${SafeReach.formatRole(emergency.acceptedBy.role)})<br>
        <strong>Phone:</strong> <a href="tel:${emergency.acceptedBy.phone}">${emergency.acceptedBy.phone}</a>
      </div>
    `;
  }

  const mapUrl = SafeReachLocation ? SafeReachLocation.generateGoogleMapsUrl(emergency.latitude, emergency.longitude) : `https://www.google.com/maps?q=${emergency.latitude},${emergency.longitude}`;

  trackerEl.innerHTML = `
    <div class="active-sos-card">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="color:#ffffff; font-size:1.3rem;">🚨 ACTIVE EMERGENCY ALERT: #${emergency.alertId}</h3>
        ${statusBadge}
      </div>
      <p style="margin-top:0.5rem; color:#cbd5e1;">Triggered at ${SafeReach.formatTime(emergency)} on ${SafeReach.formatDate(emergency)} (${emergency.address})</p>
      <div style="margin-top:0.5rem; font-size:0.88rem; color:#38bdf8;">
        📍 GPS Coords: <strong>${Number(emergency.latitude).toFixed(6)}, ${Number(emergency.longitude).toFixed(6)}</strong>
      </div>
      ${responderInfo}
      <div style="margin-top:1.25rem; display:flex; gap:0.75rem; flex-wrap:wrap;">
        <a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm">📍 View My Location on Google Maps</a>
        <button onclick="cancelActiveEmergency('${emergency._id}')" class="btn btn-outline-danger btn-sm">Cancel Alert</button>
      </div>
    </div>
  `;

  // Center live map on senior emergency position
  if (emergency.latitude && emergency.longitude && window.SafeReachMap && window.L) {
    const mapSection = document.getElementById('view-map-section');
    if (mapSection) mapSection.classList.remove('d-none');
    setTimeout(() => {
      SafeReachMap.init('map', emergency.latitude, emergency.longitude, 16);
      SafeReachMap.addMarker(
        emergency.latitude,
        emergency.longitude,
        'My Emergency Location',
        `<b>Active Emergency Alert #${emergency.alertId}</b><br>${emergency.address}<br>Lat: ${Number(emergency.latitude).toFixed(6)}, Lng: ${Number(emergency.longitude).toFixed(6)}`,
        'red'
      );
    }, 100);
  }
}

// Cancel SOS Emergency
async function cancelActiveEmergency(emergencyId) {
  if (!confirm('Are you sure you want to cancel this emergency alert?')) return;
  try {
    await SafeReach.api(`/api/emergency/cancel/${emergencyId}`, { method: 'PUT' });
    SafeReach.showToast('Emergency alert cancelled', 'info');
    document.getElementById('active-sos-tracker')?.classList.add('d-none');
    loadActiveEmergencies();
    loadEmergencyHistory();
  } catch (err) {
    SafeReach.showToast(err.message, 'danger');
  }
}

// Fetch and render Active Emergencies Feed for Responders
async function loadActiveEmergencies() {
  try {
    const data = await SafeReach.api('/api/emergency/active');

    // For Senior Citizens or Children, check if user has an active alert to render tracker
    if (currentUser.role === 'senior_citizen' || currentUser.role === 'child') {
      const myActive = data.emergencies ? data.emergencies.find(e => {
        const userId = typeof e.userId === 'object' ? e.userId?._id : (e.userId || e.user);
        return String(userId) === String(currentUser.id);
      }) : null;
      if (myActive) {
        renderActiveSOSTracker(myActive);
      }
      return;
    }

    const alertsContainer = document.getElementById('active-alerts-feed');
    if (!alertsContainer) return;

    if (!data.emergencies || data.emergencies.length === 0) {
      alertsContainer.innerHTML = `
        <div class="glass-card" style="text-align:center; padding:2rem; color:var(--dark-muted);">
          <span style="font-size:2rem;">🛡️</span>
          <p style="margin-top:0.5rem;">No active emergency alerts in your community right now.</p>
        </div>
      `;
      return;
    }

    alertsContainer.innerHTML = '';
    data.emergencies.forEach(emergency => {
      const card = createAlertCard(emergency);
      alertsContainer.appendChild(card);
    });

    // If map section exists and is visible, center map on first active emergency
    const mapSection = document.getElementById('view-map-section');
    if (data.emergencies.length > 0 && document.getElementById('map') && mapSection && !mapSection.classList.contains('d-none')) {
      const first = data.emergencies[0];
      SafeReachMap.init('map', first.latitude, first.longitude, 15);
      SafeReachMap.addMarker(first.latitude, first.longitude, first.userName, `<b>${first.userName}</b><br>${first.address}`, 'red');
    }
  } catch (err) {
    console.error('Error loading active emergencies:', err);
  }
}

// Create Responder Alert Card with Live 60s Countdown Timer Bar
function createAlertCard(emergency) {
  const card = document.createElement('div');
  const isTier2 = emergency.status === 'ESCALATED_VOLUNTEER';
  card.className = `alert-card ${isTier2 ? 'urgent-tier2' : 'urgent-tier1'}`;

  let badge = `<span class="badge badge-pending">60s LOCAL ALERT</span>`;
  if (emergency.status === 'ACCEPTED') badge = `<span class="badge badge-accepted">ACCEPTED BY ${emergency.acceptedBy?.name || 'RESPONDER'}</span>`;
  if (emergency.status === 'ESCALATED_VOLUNTEER') badge = `<span class="badge badge-escalated">VOLUNTEER ESCALATED</span>`;

  const mapUrl = SafeReachMap.getGoogleMapsUrl(emergency.latitude, emergency.longitude);

  card.innerHTML = `
    <div class="alert-card-header">
      <div>
        <h4 class="alert-user-name">${emergency.userName} (${SafeReach.formatRole(emergency.userRole)})</h4>
        <p style="font-size:0.85rem; color:var(--dark-muted);">Alert ID: #${emergency.alertId} • ${SafeReach.formatDate(emergency)} ${SafeReach.formatTime(emergency)}</p>
      </div>
      <div>${badge}</div>
    </div>

    <div class="alert-meta-grid">
      <div class="alert-meta-item">📍 <span><strong>Address:</strong> ${emergency.address}</span></div>
      <div class="alert-meta-item">🌐 <span><strong>GPS:</strong> ${Number(emergency.latitude).toFixed(6)}, ${Number(emergency.longitude).toFixed(6)}</span></div>
      <div class="alert-meta-item">📞 <span><strong>Phone:</strong> <a href="tel:${emergency.userPhone}">${emergency.userPhone}</a></span></div>
      <div class="alert-meta-item">📋 <span><strong>Type:</strong> ${emergency.emergencyType}</span></div>
      <div class="alert-meta-item">🏥 <span><strong>Medical Info:</strong> ${emergency.medicalInfo || 'None'}</span></div>
    </div>

    ${emergency.status === 'PENDING_LOCAL' ? `
      <div class="countdown-bar-wrapper">
        <div id="countdown-bar-${emergency._id}" class="countdown-bar-fill"></div>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:0.8rem; color:#ff9500; margin-bottom:1rem;">
        <span>Escalating to Volunteers & Family if unhandled</span>
        <span id="countdown-text-${emergency._id}">60s</span>
      </div>
    ` : ''}

    <div style="display:flex; gap:0.75rem; flex-wrap:wrap; margin-top:1rem;">
      ${emergency.status !== 'ACCEPTED' && emergency.status !== 'RESOLVED' ? `
        <button onclick="acceptEmergencyAlert('${emergency._id}')" class="btn btn-success btn-sm">✅ ACCEPT EMERGENCY</button>
        <button onclick="rejectEmergencyAlert('${emergency._id}')" class="btn btn-secondary btn-sm">❌ Dismiss</button>
      ` : ''}

      ${emergency.status === 'ACCEPTED' ? `
        <button onclick="resolveEmergencyAlert('${emergency._id}')" class="btn btn-success btn-sm">🏁 Mark as Resolved</button>
      ` : ''}

      <a href="${mapUrl}" target="_blank" class="btn btn-primary btn-sm">🗺️ Open Google Maps Navigation</a>
      <a href="tel:${emergency.userPhone}" class="btn btn-secondary btn-sm">📞 Call ${emergency.userName}</a>
    </div>
  `;

  // Start client countdown animation if pending
  if (emergency.status === 'PENDING_LOCAL') {
    startClientCountdown(emergency);
  }

  return card;
}

// 60-Second Client Countdown Animation
function startClientCountdown(emergency) {
  const alertCreatedAt = new Date(emergency.createdAt).getTime();
  const barEl = document.getElementById(`countdown-bar-${emergency._id}`);
  const textEl = document.getElementById(`countdown-text-${emergency._id}`);

  if (activeCountdownIntervals.has(emergency._id)) {
    clearInterval(activeCountdownIntervals.get(emergency._id));
  }

  const interval = setInterval(() => {
    const elapsed = Date.now() - alertCreatedAt;
    const remainingMs = Math.max(60000 - elapsed, 0);
    const remainingSec = Math.ceil(remainingMs / 1000);

    if (barEl) barEl.style.width = `${(remainingMs / 60000) * 100}%`;
    if (textEl) textEl.textContent = `${remainingSec}s remaining`;

    if (remainingMs <= 0) {
      clearInterval(interval);
      activeCountdownIntervals.delete(emergency._id);
    }
  }, 1000);

  activeCountdownIntervals.set(emergency._id, interval);
}

// Responder Actions
async function acceptEmergencyAlert(emergencyId) {
  try {
    const data = await SafeReach.api(`/api/emergency/accept/${emergencyId}`, { method: 'PUT' });
    SafeReach.showToast(data.message, 'success');
    loadActiveEmergencies();
  } catch (err) {
    SafeReach.showToast(err.message, 'danger');
  }
}

async function rejectEmergencyAlert(emergencyId) {
  try {
    await SafeReach.api(`/api/emergency/reject/${emergencyId}`, { method: 'POST' });
    SafeReach.showToast('Alert dismissed for view', 'info');
    loadActiveEmergencies();
  } catch (err) {
    SafeReach.showToast(err.message, 'danger');
  }
}

async function resolveEmergencyAlert(emergencyId) {
  const notes = prompt('Enter resolution notes (optional):', 'Reached user and ensured safety.');
  try {
    const data = await SafeReach.api(`/api/emergency/resolve/${emergencyId}`, {
      method: 'PUT',
      body: JSON.stringify({ resolutionNotes: notes || '' })
    });
    SafeReach.showToast(data.message, 'success');
    loadActiveEmergencies();
    loadEmergencyHistory();
  } catch (err) {
    SafeReach.showToast(err.message, 'danger');
  }
}

// Emergency History Loader
async function loadEmergencyHistory() {
  if (currentUser.role === 'senior_citizen' || currentUser.role === 'child') {
    return; // Bypass history table loading for Senior Citizens to keep view clutter-free
  }

  try {
    const data = await SafeReach.api('/api/emergency/history');
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    if (!data.emergencies || data.emergencies.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--dark-muted); padding:1.5rem;">No historical emergency logs found.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    data.emergencies.forEach(item => {
      let statusBadge = `<span class="badge badge-resolved">RESOLVED</span>`;
      if (item.status === 'ACCEPTED') statusBadge = `<span class="badge badge-accepted">ACCEPTED</span>`;
      if (item.status === 'PENDING_LOCAL') statusBadge = `<span class="badge badge-pending">PENDING</span>`;
      if (item.status === 'ESCALATED_VOLUNTEER') statusBadge = `<span class="badge badge-escalated">ESCALATED</span>`;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>#${item.alertId}</strong></td>
        <td>${item.userName}</td>
        <td>${SafeReach.formatDate(item)} ${SafeReach.formatTime(item)}</td>
        <td>${item.address}</td>
        <td>${statusBadge}</td>
        <td>${item.acceptedBy?.name ? `${item.acceptedBy.name} (${item.acceptedBy.role})` : 'Unassigned'}</td>
        <td>${item.responseTimeSeconds ? `${item.responseTimeSeconds} sec` : 'N/A'}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('History load error:', err);
  }
}

// Toggle Security Guard Duty Status
async function toggleDutyStatus() {
  const newStatus = currentUser.dutyStatus === 'ON_DUTY' ? 'OFF_DUTY' : 'ON_DUTY';
  try {
    const data = await SafeReach.api('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ dutyStatus: newStatus })
    });
    currentUser.dutyStatus = data.user.dutyStatus;
    SafeReach.setUser(currentUser);
    renderUserProfile();
    SafeReach.showToast(`Duty status updated to ${currentUser.dutyStatus}`, 'info');
  } catch (err) {
    SafeReach.showToast(err.message, 'danger');
  }
}

// Toggle Volunteer Availability
async function toggleVolunteerAvailability() {
  const newAvail = currentUser.availability === 'AVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE';
  try {
    const data = await SafeReach.api('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ availability: newAvail })
    });
    currentUser.availability = data.user.availability;
    SafeReach.setUser(currentUser);
    renderUserProfile();
    SafeReach.showToast(`Availability status updated to ${currentUser.availability}`, 'info');
  } catch (err) {
    SafeReach.showToast(err.message, 'danger');
  }
}

// Open Edit Profile Modal (Role-Tailored Simplified Profile Forms)
function openEditProfileModal() {
  const modal = document.getElementById('edit-profile-modal');
  const modalBody = document.getElementById('edit-profile-modal-body');
  const modalTitle = document.getElementById('edit-profile-modal-title');
  if (!modal || !modalBody) return;

  const u = currentUser || SafeReach.getUser() || {};
  const role = u.role || 'senior_citizen';

  // 1. Family Member (Simplified Profile)
  if (role === 'family_member') {
    modalTitle.innerHTML = `👨‍👩‍👧 <span data-i18n="guardian">Family Member Profile & Contact Details</span>`;
    modalBody.innerHTML = `
      <div class="edit-section-card">
        <div class="edit-section-title">👤 Personal Contact Details</div>
        <div class="grid-2">
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="edit-name" class="form-control" value="${u.name || ''}" required>
          </div>
          <div class="form-group">
            <label>Mobile Phone Number</label>
            <input type="text" id="edit-phone" class="form-control" value="${u.phone || ''}" required>
          </div>
        </div>
        <div class="form-group" style="margin-top:0.75rem;">
          <label>Street Address / Home Location</label>
          <input type="text" id="edit-address" class="form-control" value="${u.address || ''}" placeholder="e.g. 102 Park Avenue">
        </div>
      </div>

      <div class="edit-section-card">
        <div class="edit-section-title">👨‍👩‍👧 Family Guardian Information</div>
        <div class="grid-2">
          <div class="form-group">
            <label>Relationship to Senior / Dependent</label>
            <input type="text" id="edit-family-rel" class="form-control" value="${u.familyRelationship || 'Son / Daughter / Guardian'}" placeholder="e.g. Son, Daughter, Caregiver">
          </div>
          <div class="form-group">
            <label>Apartment / Block Number</label>
            <input type="text" id="edit-apartment" class="form-control" value="${u.apartmentNumber || ''}" placeholder="e.g. Block B, Apt 302">
          </div>
        </div>
      </div>
    `;
  }
  // 2. Community Volunteer (Simplified Profile & Skills)
  else if (role === 'volunteer') {
    modalTitle.innerHTML = `🤝 <span data-i18n="volunteer">Community Volunteer Profile & Skills</span>`;
    modalBody.innerHTML = `
      <div class="edit-section-card">
        <div class="edit-section-title">👤 Personal Contact Details</div>
        <div class="grid-2">
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="edit-name" class="form-control" value="${u.name || ''}" required>
          </div>
          <div class="form-group">
            <label>Mobile Phone Number</label>
            <input type="text" id="edit-phone" class="form-control" value="${u.phone || ''}" required>
          </div>
        </div>
        <div class="form-group" style="margin-top:0.75rem;">
          <label>Community Block / Address</label>
          <input type="text" id="edit-address" class="form-control" value="${u.address || ''}" placeholder="e.g. North Wing, Block C">
        </div>
      </div>

      <div class="edit-section-card">
        <div class="edit-section-title">🩺 Volunteer Skills & Assistance Qualifications</div>
        <div class="form-group">
          <label>Response Skills & Certifications</label>
          <input type="text" id="edit-medical" class="form-control" value="${u.medicalInfo || ''}" placeholder="e.g. First Aid Certified, CPR Trained, Nurse, General Assistance">
        </div>
      </div>
    `;
  }
  // 3. Security Guard (Simplified Profile & Post Info)
  else if (role === 'security_guard') {
    modalTitle.innerHTML = `👮 <span data-i18n="security">Security Guard Officer Profile</span>`;
    modalBody.innerHTML = `
      <div class="edit-section-card">
        <div class="edit-section-title">👤 Officer Details</div>
        <div class="grid-2">
          <div class="form-group">
            <label>Security Officer Name</label>
            <input type="text" id="edit-name" class="form-control" value="${u.name || ''}" required>
          </div>
          <div class="form-group">
            <label>Officer / Gatehouse Direct Phone</label>
            <input type="text" id="edit-phone" class="form-control" value="${u.phone || ''}" required>
          </div>
        </div>
      </div>

      <div class="edit-section-card">
        <div class="edit-section-title">🏢 Security Post & Location</div>
        <div class="form-group">
          <label>Gatehouse / Duty Post Station</label>
          <input type="text" id="edit-address" class="form-control" value="${u.address || ''}" placeholder="e.g. Main Entrance Gate 1, Tower A Security Desk">
        </div>
      </div>
    `;
  }
  // 4. System Administrator (Simplified Operations Profile)
  else if (role === 'admin') {
    modalTitle.innerHTML = `👑 <span data-i18n="admin">System Administrator Profile</span>`;
    modalBody.innerHTML = `
      <div class="edit-section-card">
        <div class="edit-section-title">👤 Admin Details</div>
        <div class="grid-2">
          <div class="form-group">
            <label>Administrator Name</label>
            <input type="text" id="edit-name" class="form-control" value="${u.name || ''}" required>
          </div>
          <div class="form-group">
            <label>Direct Contact Phone</label>
            <input type="text" id="edit-phone" class="form-control" value="${u.phone || ''}" required>
          </div>
        </div>
        <div class="form-group" style="margin-top:0.75rem;">
          <label>Command Center Office Location</label>
          <input type="text" id="edit-address" class="form-control" value="${u.address || ''}" placeholder="e.g. CareConnect Command HQ">
      </div>
    `;
  }
  // 5. Neighbor (Personal Contact Details Only)
  else if (role === 'neighbor') {
    modalTitle.innerHTML = `🏡 <span data-i18n="neighbor">Neighbor Profile</span>`;
    modalBody.innerHTML = `
      <div class="edit-section-card">
        <div class="edit-section-title">👤 Personal Details</div>
        <div class="grid-2">
          <div class="form-group">
            <label for="edit-name">Full Name</label>
            <input type="text" id="edit-name" class="form-control" value="${u.name || ''}" required>
          </div>
          <div class="form-group">
            <label for="edit-phone">Phone Number</label>
            <input type="text" id="edit-phone" class="form-control" value="${u.phone || ''}" required>
          </div>
          <div class="form-group">
            <label for="edit-address">Address / Community Block</label>
            <input type="text" id="edit-address" class="form-control" value="${u.address || ''}">
          </div>
          <div class="form-group">
            <label for="edit-apartment">Apartment / Flat Number</label>
            <input type="text" id="edit-apartment" class="form-control" value="${u.apartmentNumber || ''}">
          </div>
        </div>
      </div>
    `;
  }
  // 6. Senior Citizen / Dependent (Complete Safety Network Profile in 2-Column Grid)
  else {
    modalTitle.innerHTML = `👵 <span data-i18n="profile">Senior Citizen Profile & Safety Network</span>`;
    modalBody.innerHTML = `
      <div class="edit-section-card">
        <div class="edit-section-title">👤 1. Personal & Health Information</div>
        <div class="grid-2">
          <div class="form-group">
            <label for="edit-name">Full Name</label>
            <input type="text" id="edit-name" class="form-control" value="${u.name || ''}" required>
          </div>
          <div class="form-group">
            <label for="edit-phone">Phone Number</label>
            <input type="text" id="edit-phone" class="form-control" value="${u.phone || ''}" required>
          </div>
          <div class="form-group">
            <label for="edit-address">Address / Community Block</label>
            <input type="text" id="edit-address" class="form-control" value="${u.address || ''}">
          </div>
          <div class="form-group">
            <label for="edit-apartment">Apartment / Flat Number</label>
            <input type="text" id="edit-apartment" class="form-control" value="${u.apartmentNumber || ''}">
          </div>
          <div class="form-group">
            <label for="edit-medical">Medical Info & Health Conditions</label>
            <input type="text" id="edit-medical" class="form-control" value="${u.medicalInfo || ''}" placeholder="e.g. Hypertension, Cardiac Pacemaker">
          </div>
          <div class="form-group">
            <label for="edit-emg-name">Primary Emergency Contact Name</label>
            <input type="text" id="edit-emg-name" class="form-control" value="${u.emergencyContactName || ''}" placeholder="Primary Contact Name">
          </div>
        </div>
      </div>

      <div class="edit-section-card">
        <div class="edit-section-title">👨‍👩‍👧 2. Family Guardian Network</div>
        <div class="grid-2">
          <div class="form-group">
            <label for="edit-family-name">Family Contact Name</label>
            <input type="text" id="edit-family-name" class="form-control" value="${u.familyContactName || ''}" placeholder="e.g. Robert Vance">
          </div>
          <div class="form-group">
            <label for="edit-family-phone">Family Phone Number</label>
            <input type="text" id="edit-family-phone" class="form-control" value="${u.familyPhone || ''}" placeholder="+1 (555) 999-1122">
          </div>
          <div class="form-group">
            <label for="edit-family-rel">Relationship to Family Member</label>
            <input type="text" id="edit-family-rel" class="form-control" value="${u.familyRelationship || ''}" placeholder="Son / Daughter / Spouse">
          </div>
          <div class="form-group">
            <label for="edit-emg-phone">Primary Emergency Contact Phone</label>
            <input type="text" id="edit-emg-phone" class="form-control" value="${u.emergencyContactPhone || ''}" placeholder="+1 (555) 000-9999">
          </div>
        </div>
      </div>

      <div class="edit-section-card">
        <div class="edit-section-title">🏡 3. Neighbor & Community Network</div>
        <div class="grid-2">
          <div class="form-group">
            <label for="edit-neighbor-name">Neighbor Name</label>
            <input type="text" id="edit-neighbor-name" class="form-control" value="${u.neighborName || ''}" placeholder="e.g. Sarah Jenkins">
          </div>
          <div class="form-group">
            <label for="edit-neighbor-phone">Neighbor Phone Number</label>
            <input type="text" id="edit-neighbor-phone" class="form-control" value="${u.neighborPhone || ''}" placeholder="+1 (555) 333-4455">
          </div>
          <div class="form-group">
            <label for="edit-neighbor-apt">Neighbor Apartment / Flat</label>
            <input type="text" id="edit-neighbor-apt" class="form-control" value="${u.neighborApartment || ''}" placeholder="e.g. Flat A-4C">
          </div>
          <div class="form-group">
            <label for="edit-emg-rel">Relationship / Category</label>
            <input type="text" id="edit-emg-rel" class="form-control" value="${u.emergencyContactRelationship || ''}" placeholder="Doctor / Caregiver / Relative">
          </div>
        </div>
      </div>

      <div class="edit-section-card">
        <div class="edit-section-title">👮 4. Security & Volunteer Network</div>
        <div class="grid-2">
          <div class="form-group">
            <label for="edit-guard-name">Security Guard Name</label>
            <input type="text" id="edit-guard-name" class="form-control" value="${u.guardName || ''}" placeholder="Officer David Guard">
          </div>
          <div class="form-group">
            <label for="edit-guard-phone">Security Gatehouse Phone</label>
            <input type="text" id="edit-guard-phone" class="form-control" value="${u.guardPhone || ''}" placeholder="+1 (555) 444-5566">
          </div>
          <div class="form-group">
            <label for="edit-volunteer-name">Community Volunteer Name</label>
            <input type="text" id="edit-volunteer-name" class="form-control" value="${u.volunteerName || ''}" placeholder="Marcus Swift">
          </div>
          <div class="form-group">
            <label for="edit-volunteer-phone">Volunteer Phone</label>
            <input type="text" id="edit-volunteer-phone" class="form-control" value="${u.volunteerPhone || ''}" placeholder="+1 (555) 777-8899">
          </div>
        </div>
      </div>
    `;
  }

  if (window.CareConnectI18n) {
    CareConnectI18n.updateDOM();
  }

  modal.classList.remove('d-none');
  modal.style.display = 'flex';
}

function closeEditProfileModal() {
  const modal = document.getElementById('edit-profile-modal');
  if (modal) {
    modal.classList.add('d-none');
    modal.style.display = 'none';
  }
}

// Close modal when clicking outside content area
document.addEventListener('click', (e) => {
  const modal = document.getElementById('edit-profile-modal');
  if (modal && e.target === modal) {
    closeEditProfileModal();
  }
});

// Handle Saving Profile Edits Across All Roles
async function handleSaveProfile(e) {
  if (e && e.preventDefault) e.preventDefault();
  try {
    const getVal = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : undefined;
    };

    const updatedFields = {
      name: getVal('edit-name'),
      phone: getVal('edit-phone'),
      address: getVal('edit-address'),
      apartmentNumber: getVal('edit-apartment'),
      medicalInfo: getVal('edit-medical'),

      familyContactName: getVal('edit-family-name'),
      familyPhone: getVal('edit-family-phone'),
      familyRelationship: getVal('edit-family-rel'),

      neighborName: getVal('edit-neighbor-name'),
      neighborPhone: getVal('edit-neighbor-phone'),
      neighborApartment: getVal('edit-neighbor-apt'),

      guardName: getVal('edit-guard-name'),
      guardPhone: getVal('edit-guard-phone'),

      volunteerName: getVal('edit-volunteer-name'),
      volunteerPhone: getVal('edit-volunteer-phone'),

      emergencyContactName: getVal('edit-emg-name'),
      emergencyContactPhone: getVal('edit-emg-phone'),
      emergencyContactRelationship: getVal('edit-emg-rel')
    };

    // Remove undefined values
    Object.keys(updatedFields).forEach(key => {
      if (updatedFields[key] === undefined) delete updatedFields[key];
    });

    const data = await SafeReach.api('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updatedFields)
    });

    currentUser = { ...(currentUser || {}), ...data.user };
    SafeReach.setUser(currentUser);
    renderUserProfile();
    closeEditProfileModal();

    if (currentUser.role === 'senior_citizen' || currentUser.role === 'child') {
      loadSeniorLinkRequests();
    }

    SafeReach.showToast('✅ Profile updated successfully!', 'success');
  } catch (err) {
    SafeReach.showToast(err.message || 'Failed to update profile details', 'danger');
  }
}

// Fetch and render Link Requests for Responders
async function loadResponderLinkRequests() {
  if (currentUser.role === 'senior_citizen' || currentUser.role === 'child') return;

  try {
    const data = await SafeReach.api('/api/link-requests/responder');
    const container = document.getElementById('responder-link-requests-container');
    if (!container) return;

    const pendingRequests = data.requests ? data.requests.filter(r => r.status === 'PENDING') : [];

    if (pendingRequests.length === 0) {
      container.innerHTML = '';
      container.classList.add('d-none');
      return;
    }

    container.classList.remove('d-none');
    container.innerHTML = '';

    pendingRequests.forEach(req => {
      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.cssText = 'border:2px solid var(--secondary); background:linear-gradient(135deg, rgba(0,122,255,0.15), var(--dark-card)); padding:1.5rem; margin-bottom:1rem;';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:1rem;">
          <div>
            <div style="font-size:0.8rem; font-weight:800; color:#ff9500; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:0.3rem;">
              📫 Account Link Request Notification
            </div>
            <h3 style="color:#ffffff; font-size:1.3rem; font-weight:800; margin-bottom:0.4rem;">
              "A Senior Citizen has added your details and wants to connect with you."
            </h3>
            <p style="color:#cbd5e1; font-size:0.95rem;">
              Accepting this request will link your account and allow you to receive emergency alerts for this Senior Citizen.
            </p>
          </div>
          <span class="badge badge-pending">PENDING APPROVAL</span>
        </div>

        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin:1.25rem 0; padding:1rem; background:rgba(0,0,0,0.25); border-radius:var(--radius-md); font-size:0.9rem;">
          <div><strong style="color:var(--dark-muted);">Senior Citizen Name:</strong><br><span style="color:#fff; font-weight:700;">${req.seniorName}</span></div>
          <div><strong style="color:var(--dark-muted);">Relationship / Role:</strong><br><span style="color:#fff; font-weight:700;">${req.relationship} (${SafeReach.formatRole(req.targetRole)})</span></div>
          <div><strong style="color:var(--dark-muted);">Address:</strong><br><span style="color:#fff; font-weight:700;">${req.seniorAddress || 'Springboard Community'}</span></div>
          <div><strong style="color:var(--dark-muted);">Request Date:</strong><br><span style="color:#fff; font-weight:700;">${req.requestDate || 'Recent'}</span></div>
        </div>

        <div style="display:flex; gap:1rem; flex-wrap:wrap;">
          <button onclick="acceptLinkRequest('${req._id}')" class="btn btn-success" style="font-weight:800;">
            ✅ Accept Request
          </button>
          <button onclick="rejectLinkRequest('${req._id}')" class="btn btn-outline-danger" style="font-weight:700;">
            ❌ Reject Request
          </button>
        </div>
      `;

      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading responder link requests:', err);
  }
}

function openAddContactModal() {
  const modal = document.getElementById('add-contact-modal');
  if (modal) {
    modal.classList.remove('d-none');
    modal.style.display = 'flex';
  }
}

function closeAddContactModal() {
  const modal = document.getElementById('add-contact-modal');
  if (modal) {
    modal.classList.add('d-none');
    modal.style.display = 'none';
  }
}

async function handleAddContactSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  try {
    const targetName = document.getElementById('contact-name').value;
    const targetEmail = document.getElementById('contact-email').value;
    const targetPhone = document.getElementById('contact-phone').value;
    const targetRole = document.getElementById('contact-role').value;
    const relationship = document.getElementById('contact-rel').value;

    const data = await SafeReach.api('/api/link-requests', {
      method: 'POST',
      body: JSON.stringify({
        targetName,
        targetEmail,
        targetPhone,
        targetRole,
        relationship
      })
    });

    SafeReach.showToast('✅ Connection request sent successfully!', 'success');
    closeAddContactModal();
    document.getElementById('form-add-contact')?.reset();
    loadSeniorLinkRequests();
  } catch (err) {
    SafeReach.showToast(err.message || 'Failed to send connection request', 'danger');
  }
}

// Fetch and render Link Requests for Senior Citizens (Pending, Accepted, Rejected)
async function loadSeniorLinkRequests() {
  if (currentUser.role !== 'senior_citizen' && currentUser.role !== 'child') return;

  try {
    const data = await SafeReach.api('/api/link-requests/senior');
    const container = document.getElementById('senior-link-requests-section');
    const content = document.getElementById('senior-link-requests-content');
    if (!container || !content) return;

    container.classList.remove('d-none');

    const requests = data.requests || [];
    if (requests.length === 0) {
      content.innerHTML = `
        <div style="text-align:center; padding:1.5rem; color:var(--dark-muted);">
          No link requests sent yet. Click <strong>"➕ Add Contact"</strong> to connect family, neighbors, security guards, or volunteers!
        </div>
      `;
      return;
    }

    const pending = requests.filter(r => r.status === 'PENDING');
    const accepted = requests.filter(r => r.status === 'ACCEPTED');
    const rejected = requests.filter(r => r.status === 'REJECTED');

    content.innerHTML = `
      <div style="display:flex; gap:1rem; margin-bottom:1rem; font-size:0.9rem; font-weight:700;">
        <span style="color:#ff9500;">⏳ Pending (${pending.length})</span>
        <span style="color:#34c759;">✅ Connected (${accepted.length})</span>
        <span style="color:#ff3b30;">❌ Declined (${rejected.length})</span>
      </div>

      <div style="overflow-x:auto;">
        <table class="history-table">
          <thead>
            <tr>
              <th>Contact Name</th>
              <th>Role</th>
              <th>Email / Phone</th>
              <th>Request Date</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map(r => {
              let badge = `<span class="badge badge-pending">PENDING</span>`;
              if (r.status === 'ACCEPTED') badge = `<span class="badge badge-accepted">CONNECTED</span>`;
              if (r.status === 'REJECTED') badge = `<span class="badge badge-escalated">DECLINED</span>`;

              const displayEmail = (r.targetEmail && !r.targetEmail.includes('@safereach.com')) ? r.targetEmail : '';

              return `
                <tr>
                  <td><strong>${r.targetName}</strong></td>
                  <td>${SafeReach.formatRole(r.targetRole)} (${r.relationship || 'Contact'})</td>
                  <td>${displayEmail ? `${displayEmail}<br>` : ''}<small style="color:var(--dark-muted);">${r.targetPhone || '—'}</small></td>
                  <td>${r.requestDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                  <td>${badge}</td>
                  <td>
                    ${r.status === 'ACCEPTED' ? `
                      <button onclick="unlinkAccount('${r._id}')" class="btn btn-secondary btn-sm" title="Unlink Account">🔌 Unlink</button>
                    ` : r.status === 'PENDING' ? `
                      <span style="font-size:0.8rem; color:var(--dark-muted);">Waiting for acceptance</span>
                    ` : `
                      <span style="font-size:0.8rem; color:#ff3b30;">Declined by user</span>
                    `}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    console.error('Error loading senior link requests:', err);
  }
}

// Accept Link Request Action
async function acceptLinkRequest(requestId) {
  try {
    const data = await SafeReach.api(`/api/link-requests/${requestId}/accept`, { method: 'PUT' });
    SafeReach.showToast(data.message, 'success');
    loadResponderLinkRequests();
    loadActiveEmergencies();
  } catch (err) {
    SafeReach.showToast(err.message, 'danger');
  }
}

// Reject Link Request Action
async function rejectLinkRequest(requestId) {
  if (!confirm('Are you sure you want to decline this connection request?')) return;
  try {
    const data = await SafeReach.api(`/api/link-requests/${requestId}/reject`, { method: 'PUT' });
    SafeReach.showToast('Link request declined.', 'info');
    loadResponderLinkRequests();
  } catch (err) {
    SafeReach.showToast(err.message, 'danger');
  }
}

// Unlink Account Action
async function unlinkAccount(requestId) {
  if (!confirm('Are you sure you want to unlink this account?')) return;
  try {
    const data = await SafeReach.api(`/api/link-requests/${requestId}/unlink`, { method: 'DELETE' });
    SafeReach.showToast(data.message, 'info');
    if (currentUser.role === 'senior_citizen' || currentUser.role === 'child') {
      loadSeniorLinkRequests();
    } else {
      loadResponderLinkRequests();
    }
  } catch (err) {
    SafeReach.showToast(err.message, 'danger');
  }
}

let currentNotifications = [];
let activeNotifFilter = 'all';

// Fetch Notifications and update badge & counts (Requirements 1, 2, 3)
async function loadUserNotifications() {
  try {
    const data = await SafeReach.api('/api/notifications');
    if (!data || !data.notifications) return;

    currentNotifications = data.notifications;

    const counts = data.counts || { pending: 0, accepted: 0, read: 0, unread: 0 };

    const badgeEl = document.getElementById('nav-unread-badge');
    if (badgeEl) {
      if (counts.unread > 0) {
        badgeEl.textContent = counts.unread;
        badgeEl.classList.remove('d-none');
      } else {
        badgeEl.classList.add('d-none');
      }
    }

    const countPendingEl = document.getElementById('count-pending');
    const countAcceptedEl = document.getElementById('count-accepted');
    const countReadEl = document.getElementById('count-read');

    if (countPendingEl) countPendingEl.textContent = counts.pending;
    if (countAcceptedEl) countAcceptedEl.textContent = counts.accepted;
    if (countReadEl) countReadEl.textContent = counts.read;

    renderNotificationList();
  } catch (err) {
    console.error('Error loading notifications:', err);
  }
}

// Open Notifications Modal
function openNotificationsModal() {
  const modal = document.getElementById('notifications-modal');
  if (modal) {
    modal.classList.remove('d-none');
    modal.style.display = 'flex';
    loadUserNotifications();
  }
}

// Close Notifications Modal
function closeNotificationsModal() {
  const modal = document.getElementById('notifications-modal');
  if (modal) {
    modal.classList.add('d-none');
    modal.style.display = 'none';
  }
}

// Filter Notifications Tab (Pending, Accepted, Read, All)
function filterNotifications(filter) {
  activeNotifFilter = filter;
  document.querySelectorAll('.notif-tab-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`tab-notif-${filter.toLowerCase()}`);
  if (activeBtn) activeBtn.classList.add('active');

  renderNotificationList();
}

// Render Notifications List inside Modal (Requirement 1, 3)
function renderNotificationList() {
  const container = document.getElementById('notifications-list-content');
  if (!container) return;

  let filtered = currentNotifications;
  if (activeNotifFilter === 'PENDING') filtered = currentNotifications.filter(n => n.status === 'PENDING');
  else if (activeNotifFilter === 'ACCEPTED') filtered = currentNotifications.filter(n => n.status === 'ACCEPTED');
  else if (activeNotifFilter === 'READ') filtered = currentNotifications.filter(n => n.status === 'READ');

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:2.5rem; color:var(--dark-muted);">
        <div style="font-size:2.5rem; margin-bottom:0.5rem;">🔔</div>
        <p>No notifications found in this category.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(n => {
    let cardClass = 'status-pending';
    if (n.status === 'ACCEPTED') cardClass = 'status-accepted';
    if (n.type === 'EMERGENCY_ALERT') cardClass = 'status-emergency';
    if (n.type === 'HELPER_ASSIGNED') cardClass = 'status-assigned';

    return `
      <div class="notif-card ${cardClass}">
        <div class="notif-header">
          <div class="notif-sender">
            ${n.senderName} <small style="font-size:0.85rem; color:#94a3b8; font-weight:600;">(${n.senderRole || 'User'})</small>
          </div>
          <span class="badge ${n.status === 'PENDING' ? 'badge-pending' : n.status === 'ACCEPTED' ? 'badge-accepted' : 'badge-escalated'}">
            ${n.status}
          </span>
        </div>

        <p style="color:#ffffff; font-size:0.95rem; font-weight:700; margin:0.4rem 0;">
          ${n.message}
        </p>

        <div class="notif-meta-grid">
          <div><strong style="color:#94a3b8;">Request Type:</strong><br><span style="color:#fff; font-weight:700;">${n.emergencyType || 'Connection Request'}</span></div>
          <div><strong style="color:#94a3b8;">Address / Apartment:</strong><br><span style="color:#fff; font-weight:700;">${n.address || 'Springboard Community'} ${n.apartment ? '(' + n.apartment + ')' : ''}</span></div>
          <div><strong style="color:#94a3b8;">Date & Time:</strong><br><span style="color:#fff; font-weight:700;">${SafeReach.formatDate(n) || 'Recent'} ${SafeReach.formatTime(n) || ''}</span></div>
        </div>

        ${n.status === 'PENDING' ? `
          <div class="notif-actions">
            <button onclick="acceptNotificationAction('${n._id}')" class="btn btn-success btn-sm" style="font-weight:800; padding:0.5rem 1.25rem;">
              ✅ Accept
            </button>
            <button onclick="declineNotificationAction('${n._id}')" class="btn btn-outline-danger btn-sm" style="font-weight:700; padding:0.5rem 1.25rem;">
              ❌ Decline
            </button>
          </div>
        ` : n.googleMapsUrl ? `
          <div class="notif-actions">
            <a href="${n.googleMapsUrl}" target="_blank" class="btn btn-secondary btn-sm" style="font-weight:700;">
              🗺️ Open in Google Maps
            </a>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// Accept Notification Action
async function acceptNotificationAction(notificationId) {
  try {
    const data = await SafeReach.api(`/api/notifications/${notificationId}/accept`, { method: 'PUT' });
    SafeReach.showToast(data.message, 'success');
    loadUserNotifications();
    renderUserProfile();
    loadActiveEmergencies();
  } catch (err) {
    SafeReach.showToast(err.message, 'danger');
  }
}

// Decline Notification Action
async function declineNotificationAction(notificationId) {
  if (!confirm('Are you sure you want to decline this request?')) return;
  try {
    const data = await SafeReach.api(`/api/notifications/${notificationId}/decline`, { method: 'PUT' });
    SafeReach.showToast(data.message, 'info');
    loadUserNotifications();
  } catch (err) {
    SafeReach.showToast(err.message, 'danger');
  }
}

// Update Helper Assigned state across active emergency alert cards (Requirement 4)
function updateHelperAssignedCards(alertId, helperName, helperRole) {
  const cards = document.querySelectorAll('.active-alert-card');
  cards.forEach(card => {
    if (card.dataset.alertId === alertId || card.innerHTML.includes(alertId)) {
      card.style.borderColor = '#007aff';
      card.style.background = 'linear-gradient(135deg, rgba(0, 122, 255, 0.15), var(--dark-card))';
      const actionArea = card.querySelector('.emergency-card-actions');
      if (actionArea) {
        actionArea.innerHTML = `
          <div style="background:rgba(0,122,255,0.25); border:1px solid #007aff; border-radius:8px; padding:0.75rem 1rem; color:#fff; font-weight:800; text-align:center; width:100%;">
            📌 Helper Assigned (Accepted by ${helperName} - ${helperRole})
          </div>
        `;
      }
    }
  });
}

function logout() {
  SafeReach.clearAuth();
  window.location.href = '/login';
}

window.logout = logout;
window.acceptEmergencyAlert = acceptEmergencyAlert;
window.rejectEmergencyAlert = rejectEmergencyAlert;
window.resolveEmergencyAlert = resolveEmergencyAlert;
window.cancelActiveEmergency = cancelActiveEmergency;
window.openEditProfileModal = openEditProfileModal;
window.closeEditProfileModal = closeEditProfileModal;
window.handleSaveProfile = handleSaveProfile;
window.acceptLinkRequest = acceptLinkRequest;
window.rejectLinkRequest = rejectLinkRequest;
window.unlinkAccount = unlinkAccount;
window.openNotificationsModal = openNotificationsModal;
window.closeNotificationsModal = closeNotificationsModal;
window.filterNotifications = filterNotifications;
window.acceptNotificationAction = acceptNotificationAction;
window.declineNotificationAction = declineNotificationAction;

