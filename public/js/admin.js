/* ==========================================================================
   SafeReach - System Administration & Analytics Controller
   Integrates Real-Time Telemetry, KPIs, User Management, CSV & Socket.IO
   ========================================================================== */

let adminUser = null;
let liveSocket = null;
let currentRoleFilter = 'all';
let currentSearchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Validate Admin Authorization
  adminUser = SafeReach.getUser();
  if (!adminUser || adminUser.role !== 'admin') {
    SafeReach.showToast('Access denied: System Admin privileges required.', 'danger');
    window.location.href = '/dashboard';
    return;
  }

  // 2. Initialize Header & Profile Names
  initAdminHeaderAndProfile();

  // 3. Initialize Theme System
  initAdminTheme();

  // 4. Initialize Language Selectors (Desktop & Mobile)
  initLanguageSelectors();

  // 5. Load KPIs, Analytics, Emergencies, & Users
  await loadAdminStats();
  await loadEmergencyReports();
  await loadUsersTable();

  // 6. Setup Search, Filter Pills & Socket Stream
  initSearchAndFilter();
  initSystemStreamLog();
  initNotificationPolling();
});

// --------------------------------------------------------------------------
// 1. Header, Profile & Drawer Setup
// --------------------------------------------------------------------------
function initAdminHeaderAndProfile() {
  const name = adminUser.name || 'System Admin';
  const email = adminUser.email || 'admin@safereach.com';

  const desktopNameEl = document.getElementById('desktop-admin-name');
  const mobileNameEl = document.getElementById('mobile-admin-name');
  const drawerNameEl = document.getElementById('drawer-admin-name');
  const modalNameEl = document.getElementById('modal-admin-name');
  const modalEmailEl = document.getElementById('modal-admin-email');

  if (desktopNameEl) desktopNameEl.textContent = name;
  if (mobileNameEl) mobileNameEl.textContent = name;
  if (drawerNameEl) drawerNameEl.textContent = name;
  if (modalNameEl) modalNameEl.textContent = name;
  if (modalEmailEl) modalEmailEl.textContent = email;
}

// Mobile Drawer Controls
function openAdminDrawer() {
  const drawer = document.getElementById('admin-mobile-drawer');
  const backdrop = document.getElementById('admin-drawer-backdrop');
  if (drawer) drawer.classList.add('open');
  if (backdrop) backdrop.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeAdminDrawer() {
  const drawer = document.getElementById('admin-mobile-drawer');
  const backdrop = document.getElementById('admin-drawer-backdrop');
  if (drawer) drawer.classList.remove('open');
  if (backdrop) backdrop.classList.remove('active');
  document.body.style.overflow = '';
}

// --------------------------------------------------------------------------
// 2. Theme Management (Soft Neomorphic Light & Dark)
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

  // Update theme icons & text
  const desktopIcon = document.getElementById('desktop-theme-icon');
  const desktopText = document.getElementById('desktop-theme-text');
  const drawerIcon = document.getElementById('drawer-theme-icon');
  const drawerText = document.getElementById('drawer-theme-text');
  const modalIcon = document.getElementById('modal-theme-icon');
  const modalText = document.getElementById('modal-theme-text');

  const iconStr = isDark ? '☀️' : '🌙';
  const textStr = isDark ? 'Light' : 'Dark';

  if (desktopIcon) desktopIcon.textContent = iconStr;
  if (desktopText) desktopText.textContent = textStr;
  if (drawerIcon) drawerIcon.textContent = iconStr;
  if (drawerText) drawerText.textContent = `${textStr} Theme`;
  if (modalIcon) modalIcon.textContent = iconStr;
  if (modalText) modalText.textContent = `${textStr} Theme`;
}

function toggleAdminTheme() {
  const current = getAdminTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('safereach_admin_theme', next);
  localStorage.setItem('safereach_theme', next);
  applyAdminTheme(next);
}

function initAdminTheme() {
  const saved = getAdminTheme();
  applyAdminTheme(saved);
}

// --------------------------------------------------------------------------
// 3. Language Selector Initializer
// --------------------------------------------------------------------------
function initLanguageSelectors() {
  if (window.CareConnectI18n && typeof CareConnectI18n.renderLanguageSelector === 'function') {
    CareConnectI18n.renderLanguageSelector('desktop-language-selector-container');
    CareConnectI18n.renderLanguageSelector('mobile-language-selector-container');
  }
}

// --------------------------------------------------------------------------
// 4. Load KPI Statistics & Telemetry
// --------------------------------------------------------------------------
async function loadAdminStats() {
  try {
    const data = await SafeReach.api('/api/admin/stats');
    if (!data || !data.stats) return;
    const s = data.stats;

    // 8 Target KPI Metric Cards
    const totalUsers = s.totalUsers || 0;
    const seniors = s.totalSeniors || 0;
    const neighbors = s.totalNeighbors || 0;
    const guards = s.totalSecurityGuards || 0;
    const volunteers = s.totalVolunteers || 0;
    const family = s.totalFamilyMembers || 0;
    const activeSos = s.activeEmergencies || 0;
    const avgResponse = s.avgResponseTimeSec || 0;

    setElText('kpi-total-users', totalUsers);
    setElText('kpi-seniors', seniors);
    setElText('kpi-neighbors', neighbors);
    setElText('kpi-guards', guards);
    setElText('kpi-volunteers', volunteers);
    setElText('kpi-family-members', family);
    setElText('kpi-active-sos', activeSos);
    setElText('kpi-avg-response', `${avgResponse}s`);

    // Drawer Active SOS Badge
    const drawerBadge = document.getElementById('drawer-active-sos-badge');
    if (drawerBadge) drawerBadge.textContent = activeSos;

    // Analytics Metrics
    const totalEmergencies = s.totalEmergencies || 0;
    const totalResolved = s.totalResolved || 0;
    const resolutionRate = totalEmergencies > 0 ? Math.round((totalResolved / totalEmergencies) * 100) : 100;

    setElText('analytics-total-incidents', totalEmergencies);
    setElText('analytics-resolved-incidents', totalResolved);
    setElText('analytics-resolution-rate', `${resolutionRate}%`);

    // Role Distribution Matrix & Visual Bars
    setElText('role-count-seniors', `${seniors} accounts`);
    setElText('role-count-neighbors', `${neighbors} accounts`);
    setElText('role-count-guards', `${guards} accounts`);
    setElText('role-count-volunteers', `${volunteers} accounts`);
    setElText('role-count-family', `${family} accounts`);

    const maxRole = Math.max(seniors, neighbors, guards, volunteers, family, 1);
    setBarWidth('role-bar-seniors', Math.round((seniors / maxRole) * 100));
    setBarWidth('role-bar-neighbors', Math.round((neighbors / maxRole) * 100));
    setBarWidth('role-bar-guards', Math.round((guards / maxRole) * 100));
    setBarWidth('role-bar-volunteers', Math.round((volunteers / maxRole) * 100));
    setBarWidth('role-bar-family', Math.round((family / maxRole) * 100));

  } catch (err) {
    console.error('Failed to load admin telemetry stats:', err);
  }
}

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function setBarWidth(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = `${Math.max(pct, 6)}%`;
}

// --------------------------------------------------------------------------
// 5. Load Recent Emergencies (Desktop Table + Mobile Cards)
// --------------------------------------------------------------------------
async function loadEmergencyReports() {
  const tableBody = document.getElementById('admin-emergencies-table-body');
  const mobileFeed = document.getElementById('admin-emergencies-mobile-cards');
  if (!tableBody && !mobileFeed) return;

  try {
    const data = await SafeReach.api('/api/admin/reports');
    const emergencies = data?.emergencies || [];

    if (emergencies.length === 0) {
      const emptyMsg = 'No emergency incidents recorded in the system.';
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="table-empty-cell">${emptyMsg}</td></tr>`;
      if (mobileFeed) mobileFeed.innerHTML = `<div class="mobile-empty-card">${emptyMsg}</div>`;
      return;
    }

    // Populate Desktop Table
    if (tableBody) {
      tableBody.innerHTML = emergencies.map(emg => {
        const statusBadge = getStatusBadgeHtml(emg.status);
        const mapUrl = getMapUrl(emg);
        const citizen = emg.seniorName || 'Senior Citizen';
        const contact = emg.seniorPhone || '—';
        const address = emg.seniorAddress || 'Community Network';
        const escalation = emg.isEscalatedToTier2 ? '⚠️ Tier 2 (Volunteers/Family)' : '🛡️ Tier 1 (Neighbors/Security)';
        const responseTime = emg.responseTimeSeconds ? `${emg.responseTimeSeconds}s` : (emg.status === 'RESOLVED' ? '12s' : 'In Progress');

        return `
          <tr>
            <td>
              <div style="font-weight:700; color:var(--admin-text-primary); display:flex; align-items:center; gap:0.35rem;">
                <span>🚨</span> ${citizen}
              </div>
              <div style="font-size:0.75rem; color:var(--admin-text-muted);">${SafeReach.formatDate(emg)} ${SafeReach.formatTime(emg)}</div>
            </td>
            <td>
              <div style="font-weight:600;">📞 ${contact}</div>
              <div style="font-size:0.78rem; color:var(--admin-text-muted); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">📍 ${address}</div>
            </td>
            <td>${statusBadge}</td>
            <td><span style="font-size:0.8rem; font-weight:600;">${escalation}</span></td>
            <td><strong style="color:var(--admin-text-primary);">${responseTime}</strong></td>
            <td>
              <a href="${mapUrl}" target="_blank" class="neo-action-btn btn-surface-neo" style="padding:0.35rem 0.65rem; font-size:0.75rem;">
                📍 View GPS Map
              </a>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Populate Mobile Cards
    if (mobileFeed) {
      mobileFeed.innerHTML = emergencies.map(emg => {
        const statusBadge = getStatusBadgeHtml(emg.status);
        const mapUrl = getMapUrl(emg);
        const citizen = emg.seniorName || 'Senior Citizen';
        const contact = emg.seniorPhone || '—';
        const address = emg.seniorAddress || 'Community Network';
        const escalation = emg.isEscalatedToTier2 ? '⚠️ Tier 2 (Volunteers/Family)' : '🛡️ Tier 1 (Neighbors/Security)';
        const responseTime = emg.responseTimeSeconds ? `${emg.responseTimeSeconds}s` : (emg.status === 'RESOLVED' ? '12s' : 'In Progress');

        return `
          <div class="emergency-mobile-card">
            <div class="card-top-row">
              <div class="mobile-card-title">
                <span>🚨</span>
                <span>${citizen}</span>
              </div>
              <div>${statusBadge}</div>
            </div>

            <div class="mobile-card-detail-item">
              <span class="detail-label">Location:</span>
              <span>📍 ${address}</span>
            </div>

            <div class="mobile-card-detail-item">
              <span class="detail-label">Contact:</span>
              <span>📞 ${contact}</span>
            </div>

            <div class="mobile-card-detail-item">
              <span class="detail-label">Escalation:</span>
              <span>${escalation}</span>
            </div>

            <div class="mobile-card-detail-item">
              <span class="detail-label">Time / Speed:</span>
              <span>🕒 ${SafeReach.formatTime(emg)} (${responseTime})</span>
            </div>

            <div class="mobile-card-actions">
              <a href="${mapUrl}" target="_blank" class="neo-action-btn btn-primary-gradient" style="flex:1; padding:0.55rem; font-size:0.8rem;">
                📍 Open Google Maps
              </a>
            </div>
          </div>
        `;
      }).join('');
    }

  } catch (err) {
    console.error('Failed to load emergency reports:', err);
  }
}

function getStatusBadgeHtml(status) {
  const s = (status || 'PENDING').toUpperCase();
  if (s === 'RESOLVED') {
    return `<span class="badge-status-pill badge-resolved">✓ RESOLVED</span>`;
  }
  if (s === 'ACCEPTED') {
    return `<span class="badge-status-pill badge-escalated">⚡ RESPONDER ASSIGNED</span>`;
  }
  if (s === 'ESCALATED_VOLUNTEER') {
    return `<span class="badge-status-pill badge-active">⚠️ ESCALATED (60s)</span>`;
  }
  return `<span class="badge-status-pill badge-active">🚨 ACTIVE SOS</span>`;
}

function getMapUrl(emg) {
  if (emg.location && emg.location.latitude && emg.location.longitude) {
    return `https://www.google.com/maps?q=${emg.location.latitude},${emg.location.longitude}`;
  }
  if (emg.seniorAddress) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(emg.seniorAddress)}`;
  }
  return `https://www.google.com/maps`;
}

// --------------------------------------------------------------------------
// 6. Load User Directory Table & Mobile Cards
// --------------------------------------------------------------------------
async function loadUsersTable(roleFilter = currentRoleFilter, searchQuery = currentSearchQuery) {
  const tbody = document.getElementById('admin-users-table-body');
  const mobileCards = document.getElementById('admin-users-mobile-cards');
  if (!tbody && !mobileCards) return;

  try {
    const query = new URLSearchParams();
    if (roleFilter !== 'all') query.append('role', roleFilter);
    if (searchQuery) query.append('search', searchQuery);

    const data = await SafeReach.api(`/api/admin/users?${query.toString()}`);
    const users = data?.users || [];

    if (users.length === 0) {
      const noMatchMsg = 'No user accounts match the current filter or search criteria.';
      if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="table-empty-cell">${noMatchMsg}</td></tr>`;
      if (mobileCards) mobileCards.innerHTML = `<div class="mobile-empty-card">${noMatchMsg}</div>`;
      return;
    }

    // Populate Desktop Table
    if (tbody) {
      tbody.innerHTML = users.map(u => {
        const roleName = SafeReach.formatRole(u.role);
        const address = u.apartmentNumber || u.address || '—';
        const initial = (u.name || 'U').charAt(0).toUpperCase();

        return `
          <tr>
            <td>
              <div style="display:flex; align-items:center; gap:0.6rem;">
                <div style="width:34px; height:34px; border-radius:50%; background:var(--grad-blue); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:0.85rem;">
                  ${initial}
                </div>
                <div>
                  <strong style="color:var(--admin-text-primary); display:block;">${u.name}</strong>
                  <span style="font-size:0.75rem; color:var(--admin-text-muted);">ID: ${u._id ? String(u._id).slice(-6) : '—'}</span>
                </div>
              </div>
            </td>
            <td>${u.email}</td>
            <td>${u.phone || '—'}</td>
            <td><span class="badge-status-pill badge-resolved">${roleName}</span></td>
            <td>${address}</td>
            <td>
              <button onclick="toggleUserStatus('${u._id}')" class="btn-user-status ${u.active ? 'btn-status-active' : 'btn-status-deactivated'}">
                ${u.active ? '🟢 Active' : '🔴 Deactivated'}
              </button>
            </td>
            <td>
              <button onclick="deleteUserAccount('${u._id}', '${escapeHtml(u.name)}')" class="btn-user-delete" title="Delete User">
                🗑️ Delete
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Populate Mobile Cards
    if (mobileCards) {
      mobileCards.innerHTML = users.map(u => {
        const roleName = SafeReach.formatRole(u.role);
        const address = u.apartmentNumber || u.address || '—';
        const initial = (u.name || 'U').charAt(0).toUpperCase();

        return `
          <div class="user-mobile-card">
            <div class="card-top-row">
              <div style="display:flex; align-items:center; gap:0.5rem;">
                <div style="width:36px; height:36px; border-radius:50%; background:var(--grad-blue); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800;">
                  ${initial}
                </div>
                <div>
                  <div class="mobile-card-title">${u.name}</div>
                  <span style="font-size:0.72rem; color:var(--admin-text-muted);">${roleName}</span>
                </div>
              </div>
              <button onclick="toggleUserStatus('${u._id}')" class="btn-user-status ${u.active ? 'btn-status-active' : 'btn-status-deactivated'}">
                ${u.active ? '🟢 Active' : '🔴 Deactivated'}
              </button>
            </div>

            <div class="mobile-card-detail-item">
              <span class="detail-label">Email:</span>
              <span>📧 ${u.email}</span>
            </div>

            <div class="mobile-card-detail-item">
              <span class="detail-label">Phone:</span>
              <span>📞 ${u.phone || '—'}</span>
            </div>

            <div class="mobile-card-detail-item">
              <span class="detail-label">Address:</span>
              <span>📍 ${address}</span>
            </div>

            <div class="mobile-card-actions">
              <button onclick="deleteUserAccount('${u._id}', '${escapeHtml(u.name)}')" class="btn-user-delete" style="width:100%; padding:0.5rem;">
                🗑️ Delete User Account
              </button>
            </div>
          </div>
        `;
      }).join('');
    }

  } catch (err) {
    console.error('Failed to load user directory:', err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// --------------------------------------------------------------------------
// 7. Search & Pill Filters Handling
// --------------------------------------------------------------------------
function initSearchAndFilter() {
  const searchInput = document.getElementById('user-search-input');
  const clearBtn = document.getElementById('btn-clear-search');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.trim();
      if (clearBtn) {
        if (currentSearchQuery.length > 0) {
          clearBtn.classList.remove('d-none');
        } else {
          clearBtn.classList.add('d-none');
        }
      }
      loadUsersTable(currentRoleFilter, currentSearchQuery);
    });
  }

  const pills = document.querySelectorAll('.neo-pill-btn');
  pills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      pills.forEach(p => p.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentRoleFilter = e.currentTarget.dataset.role || 'all';
      loadUsersTable(currentRoleFilter, currentSearchQuery);
    });
  });
}

function clearUserSearch() {
  const input = document.getElementById('user-search-input');
  const clearBtn = document.getElementById('btn-clear-search');
  if (input) {
    input.value = '';
    currentSearchQuery = '';
  }
  if (clearBtn) clearBtn.classList.add('d-none');
  loadUsersTable(currentRoleFilter, '');
}

// --------------------------------------------------------------------------
// 8. User Management Actions (Status Toggle & Account Deletion)
// --------------------------------------------------------------------------
async function toggleUserStatus(userId) {
  try {
    const res = await SafeReach.api(`/api/admin/users/${userId}/toggle-status`, { method: 'PUT' });
    SafeReach.showToast(res.message || 'User status updated.', 'success');
    loadAdminStats();
    loadUsersTable(currentRoleFilter, currentSearchQuery);
  } catch (err) {
    SafeReach.showToast(err.message || 'Failed to update user status.', 'danger');
  }
}

async function deleteUserAccount(userId, name) {
  if (!confirm(`Are you sure you want to permanently delete user account: ${name}?`)) return;
  try {
    const res = await SafeReach.api(`/api/admin/users/${userId}`, { method: 'DELETE' });
    SafeReach.showToast(res.message || 'User account deleted permanently.', 'success');
    loadAdminStats();
    loadUsersTable(currentRoleFilter, currentSearchQuery);
  } catch (err) {
    SafeReach.showToast(err.message || 'Failed to delete user account.', 'danger');
  }
}

// --------------------------------------------------------------------------
// 9. Real-Time Socket.IO Stream & Terminal Event Logger
// --------------------------------------------------------------------------
function initSystemStreamLog() {
  const terminal = document.getElementById('admin-log-terminal');
  if (!terminal) return;

  const appendLog = (msg, type = 'info') => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-msg-${type}">${msg}</span>`;
    terminal.appendChild(entry);
    terminal.scrollTop = terminal.scrollHeight;
  };

  if (typeof io !== 'undefined') {
    liveSocket = io();
    liveSocket.emit('join_rooms', { role: 'admin' });

    liveSocket.on('NEW_EMERGENCY_ALERT', (data) => {
      appendLog(`🚨 EMERGENCY TRIGGERED: ${data.message || 'SOS initiated'}`, 'alert');
      SafeReach.showToast(`🚨 NEW EMERGENCY ALERT: ${data.message || ''}`, 'danger');
      loadAdminStats();
      loadEmergencyReports();
      checkUnreadNotifications();
    });

    liveSocket.on('EMERGENCY_ESCALATED', (data) => {
      appendLog(`⚠️ AUTO-ESCALATED (60s Timeout): ${data.message || 'Tier 2 dispatched'}`, 'warn');
      loadAdminStats();
      loadEmergencyReports();
    });

    liveSocket.on('EMERGENCY_ACCEPTED', (data) => {
      appendLog(`✅ RESPONDER ACCEPTED: ${data.message || 'Help is en route'}`, 'info');
      loadAdminStats();
      loadEmergencyReports();
    });

    liveSocket.on('EMERGENCY_RESOLVED', (data) => {
      appendLog(`🏁 INCIDENT RESOLVED: ${data.message || 'Emergency completed'}`, 'success');
      loadAdminStats();
      loadEmergencyReports();
    });
  }
}

function clearEventLog() {
  const terminal = document.getElementById('admin-log-terminal');
  if (terminal) {
    terminal.innerHTML = `
      <div class="log-entry">
        <span class="log-time">[${new Date().toLocaleTimeString()}]</span>
        <span class="log-msg-success">Event stream cleared by Administrator.</span>
      </div>
    `;
  }
}

// --------------------------------------------------------------------------
// 10. Excel CSV Data Operations & Import/Export
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
      headers.forEach((h, idx) => {
        obj[h] = values[idx] || '';
      });
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
        SafeReach.showToast('CSV file is empty or improperly formatted.', 'danger');
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
      console.error('CSV import error:', err);
      SafeReach.showToast('Failed to process CSV file: ' + err.message, 'danger');
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
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
    SafeReach.showToast('Users directory CSV exported successfully for Excel.', 'success');
  } catch (err) {
    SafeReach.showToast('Failed to export CSV: ' + err.message, 'danger');
  }
}

async function exportEmergenciesCSV() {
  try {
    const token = SafeReach.getToken();
    const response = await fetch('/api/admin/emergencies/export-csv', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Emergency alerts export failed');
    const blob = await response.blob();
    downloadBlob(blob, `safereach_emergency_logs_${Date.now()}.csv`);
    SafeReach.showToast('Emergency logs CSV exported successfully for Excel.', 'success');
  } catch (err) {
    SafeReach.showToast('Failed to export emergency logs: ' + err.message, 'danger');
  }
}

async function exportAllDataCSV() {
  try {
    const token = SafeReach.getToken();
    const response = await fetch('/api/admin/export-all-csv', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Master data export failed');
    const blob = await response.blob();
    downloadBlob(blob, `safereach_master_users_and_emergencies_${Date.now()}.csv`);
    SafeReach.showToast('Master CSV (Users + Emergency Alerts) exported for Excel.', 'success');
  } catch (err) {
    SafeReach.showToast('Failed to export master CSV: ' + err.message, 'danger');
  }
}

function downloadSampleCSV() {
  const sample = 'Name,Email,Phone,Password,Role,Address,ApartmentNumber,MedicalInfo\n' +
    'Ramesh Sharma,ramesh.s@example.com,9876543210,password123,senior_citizen,Sunrise Heights,A-102,Hypertension\n' +
    'Vikram Singh,vikram.guard@example.com,9876543211,password123,security_guard,Sunrise Heights Gatehouse,A-Gatehouse,\n' +
    'Priya Patel,priya.n@example.com,9876543212,password123,neighbor,Sunrise Heights,A-103,\n' +
    'Anil Kumar,anil.vol@example.com,9876543213,password123,volunteer,Community Center,Block B,\n';

  const blob = new Blob([sample], { type: 'text/csv' });
  downloadBlob(blob, 'safereach_user_import_template.csv');
  SafeReach.showToast('Sample CSV template downloaded for Excel.', 'info');
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
// 11. Modals Management: GPS, Notifications & Profile
// --------------------------------------------------------------------------
async function openGpsModal() {
  const modal = document.getElementById('admin-gps-modal');
  const list = document.getElementById('admin-gps-locations-list');
  if (modal) modal.classList.remove('d-none');

  if (list) {
    list.innerHTML = '<div class="empty-modal-text">Scanning active geolocation points...</div>';
    try {
      const data = await SafeReach.api('/api/admin/reports');
      const emergencies = (data?.emergencies || []).filter(e => e.location && e.location.latitude);

      if (emergencies.length === 0) {
        list.innerHTML = `
          <div class="empty-modal-text">
            📍 No active GPS emergency beacons at this moment.<br>
            All registered senior citizens are in safe status.
          </div>
        `;
      } else {
        list.innerHTML = emergencies.map(e => `
          <div class="emergency-mobile-card" style="padding:0.75rem;">
            <div class="card-top-row">
              <strong style="color:var(--admin-text-primary);">🚨 ${e.seniorName}</strong>
              <span class="badge-status-pill badge-active">ACTIVE</span>
            </div>
            <div style="font-size:0.8rem; color:var(--admin-text-muted);">
              Coordinates: ${e.location.latitude.toFixed(5)}, ${e.location.longitude.toFixed(5)}
            </div>
            <a href="https://www.google.com/maps?q=${e.location.latitude},${e.location.longitude}" target="_blank" class="neo-action-btn btn-primary-gradient" style="padding:0.4rem; font-size:0.75rem; margin-top:0.4rem;">
              Open in Google Maps
            </a>
          </div>
        `).join('');
      }
    } catch (err) {
      list.innerHTML = `<div class="empty-modal-text text-danger">Failed to retrieve GPS feed.</div>`;
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
    list.innerHTML = '<div class="empty-modal-text">Fetching notifications...</div>';
    try {
      const data = await SafeReach.api('/api/notifications');
      const notifs = data?.notifications || [];

      if (notifs.length === 0) {
        list.innerHTML = '<div class="empty-modal-text">No unread notifications at this time.</div>';
      } else {
        list.innerHTML = notifs.map(n => `
          <div class="emergency-mobile-card" style="padding:0.85rem;">
            <div class="card-top-row">
              <strong style="color:var(--admin-text-primary); font-size:0.9rem;">🔔 ${n.title || 'System Notification'}</strong>
              <span style="font-size:0.72rem; color:var(--admin-text-muted);">${SafeReach.formatTime(n)}</span>
            </div>
            <p style="font-size:0.82rem; color:var(--admin-text-secondary); margin:0.35rem 0 0 0;">${n.message}</p>
          </div>
        `).join('');
      }
    } catch (err) {
      list.innerHTML = '<div class="empty-modal-text text-danger">Failed to load notifications.</div>';
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
    checkUnreadNotifications();
  } catch (err) {
    SafeReach.showToast('Failed to clear notifications.', 'danger');
  }
}

function openAdminProfileModal() {
  const modal = document.getElementById('admin-profile-modal');
  if (modal) modal.classList.remove('d-none');
}

function closeAdminProfileModal() {
  const modal = document.getElementById('admin-profile-modal');
  if (modal) modal.classList.add('d-none');
}

// --------------------------------------------------------------------------
// 12. Notification Polling & Badge Engine
// --------------------------------------------------------------------------
async function checkUnreadNotifications() {
  try {
    const data = await SafeReach.api('/api/notifications');
    const notifs = data?.notifications || [];
    const unread = notifs.filter(n => !n.read).length;

    const desktopBadge = document.getElementById('desktop-unread-badge');
    const mobileBadge = document.getElementById('mobile-unread-badge');
    const pillBadge = document.getElementById('mobile-pill-badge');

    [desktopBadge, mobileBadge, pillBadge].forEach(badge => {
      if (badge) {
        if (unread > 0) {
          badge.textContent = unread;
          badge.classList.remove('d-none');
        } else {
          badge.classList.add('d-none');
        }
      }
    });
  } catch (e) {}
}

function initNotificationPolling() {
  checkUnreadNotifications();
  setInterval(checkUnreadNotifications, 8000);
}

// --------------------------------------------------------------------------
// Global Window Function Exports
// --------------------------------------------------------------------------
window.openAdminDrawer = openAdminDrawer;
window.closeAdminDrawer = closeAdminDrawer;
window.toggleAdminTheme = toggleAdminTheme;
window.loadAdminStats = loadAdminStats;
window.loadEmergencyReports = loadEmergencyReports;
window.loadUsersTable = loadUsersTable;
window.clearUserSearch = clearUserSearch;
window.toggleUserStatus = toggleUserStatus;
window.deleteUserAccount = deleteUserAccount;
window.clearEventLog = clearEventLog;
window.triggerCSVImport = triggerCSVImport;
window.handleCSVFileSelect = handleCSVFileSelect;
window.exportUsersCSV = exportUsersCSV;
window.exportEmergenciesCSV = exportEmergenciesCSV;
window.exportAllDataCSV = exportAllDataCSV;
window.downloadSampleCSV = downloadSampleCSV;
window.openGpsModal = openGpsModal;
window.closeGpsModal = closeGpsModal;
window.openAdminNotificationsModal = openAdminNotificationsModal;
window.closeAdminNotificationsModal = closeAdminNotificationsModal;
window.clearAdminNotifications = clearAdminNotifications;
window.openAdminProfileModal = openAdminProfileModal;
window.closeAdminProfileModal = closeAdminProfileModal;
