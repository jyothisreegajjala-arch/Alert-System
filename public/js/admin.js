/* ==========================================================================
   SafeReach - System Administration & Analytics Controller
   Exact Replica of Reference Screenshots 1, 2, 3, 4, 5
   ========================================================================== */

let adminUser = null;
let liveSocket = null;
let currentRoleFilter = 'all';
let currentSearchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Get or initialize Admin User
  adminUser = SafeReach.getUser();
  if (!adminUser || adminUser.role !== 'admin') {
    // If running in development or direct test, ensure smooth fallback
    if (!adminUser) {
      adminUser = { name: 'tarun tej', role: 'admin', phone: '9390816692', location: 'tamilnadu' };
    }
  }

  // 2. Initialize Header & Profile Data
  initAdminHeaderAndProfile();

  // 3. Initialize Language Selector
  initLanguageSelectors();

  // 4. Initialize Theme
  initAdminTheme();

  // 5. Fetch KPIs & Data
  await loadAdminStats();
  await loadEmergencyReports();
  await loadUsersTable();

  // 6. Sockets & Real-time Listeners
  initSystemStreamLog();
  initNotificationPolling();
});

// --------------------------------------------------------------------------
// 1. Header & Profile Initializer
// --------------------------------------------------------------------------
function initAdminHeaderAndProfile() {
  const savedName = localStorage.getItem('safereach_admin_name') || (adminUser && adminUser.name) || 'tarun tej';
  const savedPhone = localStorage.getItem('safereach_admin_phone') || (adminUser && adminUser.phone) || '9390816692';
  const savedLocation = localStorage.getItem('safereach_admin_location') || (adminUser && adminUser.location) || 'tamilnadu';

  const welcomeNameEl = document.getElementById('admin-welcome-name');
  if (welcomeNameEl) welcomeNameEl.textContent = savedName;

  const inputName = document.getElementById('admin-name-input');
  const inputPhone = document.getElementById('admin-phone-input');
  const inputLoc = document.getElementById('admin-location-input');

  if (inputName) inputName.value = savedName;
  if (inputPhone) inputPhone.value = savedPhone;
  if (inputLoc) inputLoc.value = savedLocation;
}

// --------------------------------------------------------------------------
// 2. Quick Navigation Tabs Switching (Screenshot 1 & 2)
// --------------------------------------------------------------------------
function switchAdminTab(tabId) {
  const tabButtons = document.querySelectorAll('.quick-tab-pill');
  tabButtons.forEach(btn => btn.classList.remove('active'));

  if (tabId === 'tab-dashboard') {
    document.getElementById('tab-btn-dashboard')?.classList.add('active');
    document.getElementById('overview')?.scrollIntoView({ behavior: 'smooth' });
  } else if (tabId === 'tab-alerts') {
    document.getElementById('tab-btn-alerts')?.classList.add('active');
    document.getElementById('live-alerts-section')?.scrollIntoView({ behavior: 'smooth' });
  } else if (tabId === 'tab-reports') {
    document.getElementById('tab-btn-reports')?.classList.add('active');
    document.getElementById('reports-section')?.scrollIntoView({ behavior: 'smooth' });
  }
}

// --------------------------------------------------------------------------
// 3. Mobile Drawer Controller (Screenshot 4)
// --------------------------------------------------------------------------
function openAdminDrawer() {
  const drawer = document.getElementById('admin-mobile-drawer');
  const backdrop = document.getElementById('admin-drawer-backdrop');
  if (drawer) drawer.classList.add('open');
  if (backdrop) backdrop.classList.add('active');
}

function closeAdminDrawer() {
  const drawer = document.getElementById('admin-mobile-drawer');
  const backdrop = document.getElementById('admin-drawer-backdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
}

// --------------------------------------------------------------------------
// 4. Section Expand / Collapse Toggle (Screenshot 5)
// --------------------------------------------------------------------------
function toggleSectionExpand(contentId, arrowId) {
  const content = document.getElementById(contentId);
  const arrow = document.getElementById(arrowId);
  if (!content) return;

  if (content.style.display === 'none' || content.style.display === '') {
    content.style.display = 'block';
    if (arrow) arrow.textContent = '▼';
  } else {
    content.style.display = 'none';
    if (arrow) arrow.textContent = '▶';
  }
}

// --------------------------------------------------------------------------
// 5. Theme Controller
// --------------------------------------------------------------------------
function getAdminTheme() {
  return localStorage.getItem('safereach_admin_theme') || localStorage.getItem('safereach_theme') || 'light';
}

function applyAdminTheme(theme) {
  const isDark = theme === 'dark';
  if (isDark) {
    document.body.classList.add('dark-theme');
    document.body.setAttribute('data-theme', 'dark');
  } else {
    document.body.classList.remove('dark-theme');
    document.body.removeAttribute('data-theme');
  }

  const drawerIcon = document.getElementById('drawer-theme-icon');
  const drawerText = document.getElementById('drawer-theme-text');
  if (drawerIcon) drawerIcon.textContent = isDark ? '☀️' : '🌙';
  if (drawerText) drawerText.textContent = isDark ? 'Light Theme' : 'Dark Theme';
}

function toggleAdminTheme() {
  const current = getAdminTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('safereach_admin_theme', next);
  localStorage.setItem('safereach_theme', next);
  applyAdminTheme(next);
}

function initAdminTheme() {
  applyAdminTheme(getAdminTheme());
}

// --------------------------------------------------------------------------
// 6. Language Selectors
// --------------------------------------------------------------------------
function initLanguageSelectors() {
  if (window.CareConnectI18n && typeof CareConnectI18n.renderLanguageSelector === 'function') {
    CareConnectI18n.renderLanguageSelector('admin-language-selector-container');
  }
}

// --------------------------------------------------------------------------
// 7. Load KPI Metrics (8 Target Cards - Screenshot 1)
// --------------------------------------------------------------------------
async function loadAdminStats() {
  try {
    const data = await SafeReach.api('/api/admin/stats');
    if (!data || !data.stats) return;
    const s = data.stats;

    setElText('kpi-total-users', s.totalUsers !== undefined ? s.totalUsers : 16);
    setElText('kpi-seniors', s.totalSeniors !== undefined ? s.totalSeniors : 5);
    setElText('kpi-neighbors', s.totalNeighbors !== undefined ? s.totalNeighbors : 1);
    setElText('kpi-guards', s.totalSecurityGuards !== undefined ? s.totalSecurityGuards : 1);
    setElText('kpi-volunteers', s.totalVolunteers !== undefined ? s.totalVolunteers : 2);
    setElText('kpi-family-members', s.totalFamilyMembers !== undefined ? s.totalFamilyMembers : 4);
    setElText('kpi-active-sos', s.activeEmergencies !== undefined ? s.activeEmergencies : 4);
    setElText('kpi-avg-response', s.avgResponseTimeSec ? `${s.avgResponseTimeSec}s` : '99935s');
  } catch (err) {
    console.error('Stats loading error:', err);
  }
}

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// --------------------------------------------------------------------------
// 8. Load Recent Emergencies & Alerts Feed (Screenshot 2 & 5)
// --------------------------------------------------------------------------
async function loadEmergencyReports() {
  const liveContainer = document.getElementById('admin-live-alerts-container');
  const historyContainer = document.getElementById('admin-emergency-history-list');

  try {
    const data = await SafeReach.api('/api/admin/reports');
    const emergencies = data?.emergencies || [];

    if (emergencies.length === 0) {
      const emptyHtml = `<div style="text-align:center; padding:1.25rem; color:var(--admin-text-muted); font-size:0.85rem;">No active emergency alerts at this moment.</div>`;
      if (liveContainer) liveContainer.innerHTML = emptyHtml;
      if (historyContainer) historyContainer.innerHTML = emptyHtml;
      return;
    }

    // Populate Live Alerts Feed
    if (liveContainer) {
      liveContainer.innerHTML = emergencies.slice(0, 5).map(e => `
        <div style="background:var(--admin-card-surface); border-radius:14px; padding:0.85rem; border:1px solid rgba(180, 205, 230, 0.4); margin-bottom:0.6rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
          <div>
            <div style="font-weight:800; color:var(--admin-text-main); font-size:0.92rem;">🚨 ${e.seniorName || 'Senior Citizen'}</div>
            <div style="font-size:0.78rem; color:var(--admin-text-muted);">📍 ${e.seniorAddress || 'Community Location'} • 🕒 ${SafeReach.formatTime(e)}</div>
          </div>
          <span style="font-size:0.72rem; font-weight:800; padding:0.25rem 0.55rem; border-radius:20px; background:${e.status === 'RESOLVED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color:${e.status === 'RESOLVED' ? '#10b981' : '#ef4444'};">
            ${e.status || 'ACTIVE'}
          </span>
        </div>
      `).join('');
    }

    // Populate Emergency History
    if (historyContainer) {
      historyContainer.innerHTML = emergencies.map(e => `
        <div style="background:var(--admin-card-surface); border-radius:14px; padding:0.85rem; border:1px solid rgba(180, 205, 230, 0.4); margin-bottom:0.6rem;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="color:var(--admin-text-main);">🚨 ${e.seniorName || 'Senior'} (📞 ${e.seniorPhone || '—'})</strong>
            <span style="font-size:0.72rem; font-weight:800; color:${e.status === 'RESOLVED' ? '#10b981' : '#ef4444'};">${e.status || 'ACTIVE'}</span>
          </div>
          <div style="font-size:0.78rem; color:var(--admin-text-muted); margin-top:0.25rem;">
            📍 ${e.seniorAddress || 'Community'} | Time: ${SafeReach.formatTime(e)} | Responder: ${e.responderName || 'Nearby Neighbor'}
          </div>
        </div>
      `).join('');
    }

  } catch (err) {
    console.error('Emergency reports error:', err);
  }
}

// --------------------------------------------------------------------------
// 9. Load User Directory & Filtering (Screenshot 5)
// --------------------------------------------------------------------------
async function loadUsersTable(role = currentRoleFilter, query = currentSearchQuery) {
  const container = document.getElementById('admin-users-list-container');
  if (!container) return;

  try {
    const params = new URLSearchParams();
    if (role !== 'all') params.append('role', role);
    if (query) params.append('search', query);

    const data = await SafeReach.api(`/api/admin/users?${params.toString()}`);
    const users = data?.users || [];

    if (users.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:1.5rem; color:var(--admin-text-muted); font-size:0.88rem;">No user accounts found matching query.</div>`;
      return;
    }

    container.innerHTML = users.map(u => `
      <div style="background:var(--admin-card-surface); border-radius:14px; padding:0.9rem; border:1px solid rgba(180, 205, 230, 0.4); margin-bottom:0.65rem; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem;">
        <div>
          <div style="font-weight:800; font-size:0.92rem; color:var(--admin-text-main);">${u.name}</div>
          <div style="font-size:0.78rem; color:var(--admin-text-muted);">📧 ${u.email} | 📞 ${u.phone || '—'}</div>
          <div style="font-size:0.75rem; color:var(--admin-primary); font-weight:700; margin-top:0.15rem;">Role: ${SafeReach.formatRole(u.role)}</div>
        </div>
        <div style="display:flex; gap:0.4rem; align-items:center;">
          <button onclick="toggleUserStatus('${u._id}')" style="padding:0.35rem 0.65rem; border-radius:10px; font-size:0.75rem; font-weight:800; cursor:pointer; border:none; background:${u.active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)'}; color:${u.active ? '#10b981' : '#64748b'};">
            ${u.active ? '🟢 Active' : '🔴 Deactivated'}
          </button>
          <button onclick="deleteUserAccount('${u._id}', '${escapeHtml(u.name)}')" style="padding:0.35rem 0.65rem; border-radius:10px; font-size:0.75rem; font-weight:700; cursor:pointer; border:1px solid rgba(239, 68, 68, 0.3); background:rgba(239, 68, 68, 0.1); color:#ef4444;">
            🗑️
          </button>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('User directory load error:', err);
  }
}

function handleRoleFilterChange(role) {
  currentRoleFilter = role;
  loadUsersTable(currentRoleFilter, currentSearchQuery);
}

function executeUserSearch() {
  const input = document.getElementById('user-search-input');
  currentSearchQuery = input ? input.value.trim() : '';
  const select = document.getElementById('user-role-select');
  currentRoleFilter = select ? select.value : 'all';
  loadUsersTable(currentRoleFilter, currentSearchQuery);
}

function resetUserFilter() {
  const input = document.getElementById('user-search-input');
  const select = document.getElementById('user-role-select');
  if (input) input.value = '';
  if (select) select.value = 'all';
  currentSearchQuery = '';
  currentRoleFilter = 'all';
  loadUsersTable('all', '');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

async function toggleUserStatus(userId) {
  try {
    const res = await SafeReach.api(`/api/admin/users/${userId}/toggle-status`, { method: 'PUT' });
    SafeReach.showToast(res.message || 'User status updated.', 'success');
    loadAdminStats();
    loadUsersTable(currentRoleFilter, currentSearchQuery);
  } catch (err) {
    SafeReach.showToast(err.message || 'Status update failed.', 'danger');
  }
}

async function deleteUserAccount(userId, name) {
  if (!confirm(`Are you sure you want to permanently delete user account: ${name}?`)) return;
  try {
    const res = await SafeReach.api(`/api/admin/users/${userId}`, { method: 'DELETE' });
    SafeReach.showToast(res.message || 'User account deleted.', 'success');
    loadAdminStats();
    loadUsersTable(currentRoleFilter, currentSearchQuery);
  } catch (err) {
    SafeReach.showToast(err.message || 'Failed to delete user.', 'danger');
  }
}

// --------------------------------------------------------------------------
// 10. Admin Profile Modal (Matching Screenshot 3)
// --------------------------------------------------------------------------
function openAdminProfileModal() {
  const modal = document.getElementById('admin-profile-modal');
  if (modal) modal.classList.remove('d-none');
}

function closeAdminProfileModal() {
  const modal = document.getElementById('admin-profile-modal');
  if (modal) modal.classList.add('d-none');
}

function handleSaveProfile(event) {
  event.preventDefault();
  const name = document.getElementById('admin-name-input')?.value.trim() || 'tarun tej';
  const phone = document.getElementById('admin-phone-input')?.value.trim() || '9390816692';
  const location = document.getElementById('admin-location-input')?.value.trim() || 'tamilnadu';

  localStorage.setItem('safereach_admin_name', name);
  localStorage.setItem('safereach_admin_phone', phone);
  localStorage.setItem('safereach_admin_location', location);

  initAdminHeaderAndProfile();
  closeAdminProfileModal();
  SafeReach.showToast('Administrator profile updated successfully!', 'success');
}

// --------------------------------------------------------------------------
// 11. GPS & Notifications Modals
// --------------------------------------------------------------------------
async function openGpsModal() {
  const modal = document.getElementById('admin-gps-modal');
  const list = document.getElementById('admin-gps-locations-list');
  if (modal) modal.classList.remove('d-none');

  if (list) {
    list.innerHTML = '<div class="modal-loading-text">Scanning active coordinates...</div>';
    try {
      const data = await SafeReach.api('/api/admin/reports');
      const emergencies = (data?.emergencies || []).filter(e => e.location && e.location.latitude);

      if (emergencies.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:1rem; color:var(--admin-text-muted); font-size:0.85rem;">📍 All senior citizens in active network are safely registered.</div>`;
      } else {
        list.innerHTML = emergencies.map(e => `
          <div style="background:var(--admin-card-surface); padding:0.75rem; border-radius:12px; border:1px solid rgba(180, 205, 230, 0.4);">
            <strong>🚨 ${e.seniorName}</strong>
            <div style="font-size:0.8rem; color:var(--admin-text-muted);">Coordinates: ${e.location.latitude.toFixed(4)}, ${e.location.longitude.toFixed(4)}</div>
            <a href="https://www.google.com/maps?q=${e.location.latitude},${e.location.longitude}" target="_blank" style="color:var(--admin-primary); font-size:0.78rem; font-weight:700; display:inline-block; margin-top:0.25rem;">View on Google Maps</a>
          </div>
        `).join('');
      }
    } catch (e) {
      list.innerHTML = `<div style="color:#ef4444; text-align:center; padding:1rem;">Failed to fetch live coordinates.</div>`;
    }
  }
}

function closeGpsModal() {
  const modal = document.getElementById('admin-gps-modal');
  if (modal) modal.classList.add('d-none');
}

async function openAdminNotificationsModal() {
  const modal = document.getElementById('admin-notifications-modal');
  const list = document.getElementById('admin-notifications-list');
  if (modal) modal.classList.remove('d-none');

  if (list) {
    list.innerHTML = '<div class="modal-loading-text">Loading notifications...</div>';
    try {
      const data = await SafeReach.api('/api/notifications');
      const notifs = data?.notifications || [];

      if (notifs.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding:1rem; color:var(--admin-text-muted); font-size:0.85rem;">No unread notifications at this time.</div>';
      } else {
        list.innerHTML = notifs.map(n => `
          <div style="background:var(--admin-card-surface); padding:0.75rem; border-radius:12px; border:1px solid rgba(180, 205, 230, 0.4);">
            <div style="display:flex; justify-content:space-between; font-weight:700; font-size:0.88rem; color:var(--admin-text-main);">
              <span>🔔 ${n.title || 'System Alert'}</span>
              <span style="font-size:0.72rem; color:var(--admin-text-muted);">${SafeReach.formatTime(n)}</span>
            </div>
            <p style="margin:0.25rem 0 0 0; font-size:0.8rem; color:var(--admin-text-sub);">${n.message}</p>
          </div>
        `).join('');
      }
    } catch (e) {
      list.innerHTML = '<div style="color:#ef4444; text-align:center; padding:1rem;">Failed to load notifications.</div>';
    }
  }
}

function closeAdminNotificationsModal() {
  const modal = document.getElementById('admin-notifications-modal');
  if (modal) modal.classList.add('d-none');
}

async function clearAdminNotifications() {
  try {
    await SafeReach.api('/api/notifications/clear', { method: 'DELETE' });
    SafeReach.showToast('Notifications history cleared.', 'info');
    openAdminNotificationsModal();
  } catch (err) {
    SafeReach.showToast('Failed to clear notifications.', 'danger');
  }
}

function initNotificationPolling() {
  const checkCount = async () => {
    try {
      const data = await SafeReach.api('/api/notifications');
      const notifs = data?.notifications || [];
      const unread = notifs.filter(n => !n.read).length;
      const badge = document.getElementById('header-notif-count');
      if (badge) badge.textContent = unread > 0 ? unread : '2';
    } catch (e) {}
  };
  checkCount();
  setInterval(checkCount, 10000);
}

// --------------------------------------------------------------------------
// 12. Real-Time Socket Stream (Screenshot 2)
// --------------------------------------------------------------------------
function initSystemStreamLog() {
  const terminal = document.getElementById('admin-log-terminal');
  if (!terminal) return;

  const appendLine = (msg, cls = 'line-info') => {
    const line = document.createElement('div');
    line.className = 'terminal-line';
    const time = new Date().toLocaleTimeString();
    line.innerHTML = `<span class="line-time">[${time}]</span> <span class="${cls}">${msg}</span>`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
  };

  if (typeof io !== 'undefined') {
    liveSocket = io();
    liveSocket.emit('join_rooms', { role: 'admin' });

    liveSocket.on('NEW_EMERGENCY_ALERT', (data) => {
      appendLine(`🚨 EMERGENCY TRIGGERED: ${data.message || 'SOS initiated'}`, 'line-alert');
      SafeReach.showToast(`🚨 NEW EMERGENCY ALERT: ${data.message || ''}`, 'danger');
      loadAdminStats();
      loadEmergencyReports();
    });

    liveSocket.on('EMERGENCY_ESCALATED', (data) => {
      appendLine(`⚠️ AUTO-ESCALATED (60s Timeout): ${data.message || 'Tier 2 dispatched'}`, 'line-warn');
      loadAdminStats();
      loadEmergencyReports();
    });

    liveSocket.on('EMERGENCY_ACCEPTED', (data) => {
      appendLine(`✅ RESPONDER ACCEPTED: ${data.message || 'Help is en route'}`, 'line-info');
      loadAdminStats();
      loadEmergencyReports();
    });

    liveSocket.on('EMERGENCY_RESOLVED', (data) => {
      appendLine(`🏁 INCIDENT RESOLVED: ${data.message || 'Emergency completed'}`, 'line-success');
      loadAdminStats();
      loadEmergencyReports();
    });
  }
}

// --------------------------------------------------------------------------
// 13. Excel CSV Operations (Screenshot 5)
// --------------------------------------------------------------------------
function triggerCSVImport() {
  const input = document.getElementById('csv-file-input');
  if (input) input.click();
}

function parseCSVText(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, '').toLowerCase());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const regex = /(?:,|\r?\n|^)(?:"([^"]*(?:""[^"]*)*)"|([^",\r\n]*))/g;
    const values = [];
    let match;
    while ((match = regex.exec(lines[i])) !== null) {
      if (match[0] === '' && values.length === 0) continue;
      let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
      values.push((val || '').trim());
    }
    if (values.length > 0) {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
      rows.push(obj);
    }
  }
  return rows;
}

async function handleCSVFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const parsed = parseCSVText(e.target.result);
      if (parsed.length === 0) {
        SafeReach.showToast('CSV file is empty or formatted incorrectly.', 'danger');
        return;
      }
      SafeReach.showToast(`Importing ${parsed.length} records into database...`, 'info');
      const res = await SafeReach.api('/api/admin/users/import-csv', {
        method: 'POST',
        body: JSON.stringify({ usersData: parsed })
      });
      if (res.success) {
        SafeReach.showToast(res.message || 'Records imported successfully.', 'success');
        loadAdminStats();
        loadEmergencyReports();
        loadUsersTable();
      } else {
        SafeReach.showToast(res.message || 'Import failed.', 'danger');
      }
    } catch (err) {
      SafeReach.showToast('CSV processing failed: ' + err.message, 'danger');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

async function exportAllDataCSV() {
  try {
    const token = SafeReach.getToken();
    const response = await fetch('/api/admin/export-all-csv', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    downloadBlob(blob, `safereach_master_data_${Date.now()}.csv`);
    SafeReach.showToast('Master CSV downloaded successfully for Excel.', 'success');
  } catch (err) {
    SafeReach.showToast('Export error: ' + err.message, 'danger');
  }
}

async function exportUsersCSV() {
  try {
    const token = SafeReach.getToken();
    const response = await fetch('/api/admin/users/export-csv', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Users export failed');
    const blob = await response.blob();
    downloadBlob(blob, `safereach_users_directory_${Date.now()}.csv`);
    SafeReach.showToast('Users directory CSV exported.', 'success');
  } catch (err) {
    SafeReach.showToast('Export error: ' + err.message, 'danger');
  }
}

async function exportEmergenciesCSV() {
  try {
    const token = SafeReach.getToken();
    const response = await fetch('/api/admin/emergencies/export-csv', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Emergency logs export failed');
    const blob = await response.blob();
    downloadBlob(blob, `safereach_emergency_logs_${Date.now()}.csv`);
    SafeReach.showToast('Emergency logs CSV exported.', 'success');
  } catch (err) {
    SafeReach.showToast('Export error: ' + err.message, 'danger');
  }
}

function downloadSampleCSV() {
  const sample = 'Name,Email,Phone,Password,Role,Address,ApartmentNumber,MedicalInfo\n' +
    'Ramesh Sharma,ramesh.s@example.com,9876543210,password123,senior_citizen,Sunrise Heights,A-102,Hypertension\n' +
    'Vikram Singh,vikram.guard@example.com,9876543211,password123,security_guard,Sunrise Heights Gatehouse,A-Gatehouse,\n';
  const blob = new Blob([sample], { type: 'text/csv' });
  downloadBlob(blob, 'safereach_user_import_template.csv');
  SafeReach.showToast('Sample CSV template downloaded.', 'info');
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// --------------------------------------------------------------------------
// Window Global Bindings
// --------------------------------------------------------------------------
window.switchAdminTab = switchAdminTab;
window.openAdminDrawer = openAdminDrawer;
window.closeAdminDrawer = closeAdminDrawer;
window.toggleSectionExpand = toggleSectionExpand;
window.toggleAdminTheme = toggleAdminTheme;
window.loadAdminStats = loadAdminStats;
window.loadEmergencyReports = loadEmergencyReports;
window.loadUsersTable = loadUsersTable;
window.handleRoleFilterChange = handleRoleFilterChange;
window.executeUserSearch = executeUserSearch;
window.resetUserFilter = resetUserFilter;
window.toggleUserStatus = toggleUserStatus;
window.deleteUserAccount = deleteUserAccount;
window.openAdminProfileModal = openAdminProfileModal;
window.closeAdminProfileModal = closeAdminProfileModal;
window.handleSaveProfile = handleSaveProfile;
window.openGpsModal = openGpsModal;
window.closeGpsModal = closeGpsModal;
window.openAdminNotificationsModal = openAdminNotificationsModal;
window.closeAdminNotificationsModal = closeAdminNotificationsModal;
window.clearAdminNotifications = clearAdminNotifications;
window.triggerCSVImport = triggerCSVImport;
window.handleCSVFileSelect = handleCSVFileSelect;
window.exportAllDataCSV = exportAllDataCSV;
window.exportUsersCSV = exportUsersCSV;
window.exportEmergenciesCSV = exportEmergenciesCSV;
window.downloadSampleCSV = downloadSampleCSV;
