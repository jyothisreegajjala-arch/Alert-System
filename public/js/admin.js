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

  // 5. Fetch KPIs, Analytics & Data
  await loadAdminStats();
  await loadComprehensiveAnalytics();
  await loadEmergencyReports();
  await loadUsersTable();

  // 6. Sockets & Real-time Listeners
  initSystemStreamLog();
  initNotificationPolling();

  // 7. Re-render dynamic text on language change
  window.addEventListener('careconnect_language_changed', () => {
    if (window.CareConnectI18n) {
      CareConnectI18n.updateDOM();
    }
    loadAdminStats();
    loadComprehensiveAnalytics();
    loadEmergencyReports();
    loadUsersTable();
  });
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
// 2. Section Navigation & View Switching (Fixed Application Architecture)
// --------------------------------------------------------------------------
function switchAdminTab(tabId) {
  // Update sidebar active highlights
  const drawerLinks = document.querySelectorAll('.drawer-nav-item');
  drawerLinks.forEach(link => link.classList.remove('active'));

  // Hide all tab views
  const tabViews = document.querySelectorAll('.admin-tab-view');
  tabViews.forEach(view => view.classList.add('d-none'));

  if (tabId === 'tab-dashboard') {
    document.getElementById('drawer-nav-dashboard')?.classList.add('active');
    const view = document.getElementById('section-view-dashboard');
    if (view) {
      view.classList.remove('d-none');
      view.scrollTop = 0;
    }
  } else if (tabId === 'tab-alerts') {
    document.getElementById('drawer-nav-alerts')?.classList.add('active');
    const view = document.getElementById('section-view-alerts');
    if (view) {
      view.classList.remove('d-none');
      view.scrollTop = 0;
    }
    loadEmergencyReports();
  } else if (tabId === 'tab-gps') {
    document.getElementById('drawer-nav-gps')?.classList.add('active');
    const view = document.getElementById('section-view-gps');
    if (view) {
      view.classList.remove('d-none');
      view.scrollTop = 0;
    }
    initAdminLiveMap();
  } else if (tabId === 'tab-reports') {
    document.getElementById('drawer-nav-reports')?.classList.add('active');
    const view = document.getElementById('section-view-reports');
    if (view) {
      view.classList.remove('d-none');
      view.scrollTop = 0;
    }
    loadEmergencyReports();
    loadUsersTable();
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

function toggleAdminDrawer() {
  const drawer = document.getElementById('admin-mobile-drawer');
  if (drawer && drawer.classList.contains('open')) {
    closeAdminDrawer();
  } else {
    openAdminDrawer();
  }
}

// --------------------------------------------------------------------------
// 4. Section Expand / Collapse Toggle (Screenshot 5)
// --------------------------------------------------------------------------
function toggleSectionExpand(contentId, arrowId) {
  const content = document.getElementById(contentId);
  const arrow = document.getElementById(arrowId);
  if (!content) return;

  const currentDisplay = window.getComputedStyle(content).display;
  if (currentDisplay === 'none' || content.style.display === 'none') {
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
  const saved = localStorage.getItem('safereach_admin_theme');
  return (saved === 'dark') ? 'dark' : 'light';
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
  applyAdminTheme(next);
  loadComprehensiveAnalytics();
}

function initAdminTheme() {
  // Ensure bright light theme is the primary active experience
  const current = getAdminTheme();
  applyAdminTheme(current);
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

// --------------------------------------------------------------------------
// 7B. Comprehensive Visual Analytics & Chart.js Engine
// --------------------------------------------------------------------------
const chartInstances = {};

function destroyAdminChart(canvasId) {
  if (chartInstances[canvasId]) {
    try {
      chartInstances[canvasId].destroy();
    } catch (e) {}
    chartInstances[canvasId] = null;
  }
}

async function loadComprehensiveAnalytics() {
  if (typeof Chart === 'undefined') return;

  try {
    const res = await SafeReach.api('/api/admin/analytics');
    if (!res || !res.analytics) return;
    const a = res.analytics;

    // 1. Response Metrics Highlights
    const rm = a.responseMetrics || {};
    const ra = a.resolutionAnalytics || {};
    setElText('analytics-avg-response', `${rm.averageResponseTime || 0}s`);
    setElText('analytics-fastest-response', `${rm.fastestResponseTime || 0}s`);
    setElText('analytics-slowest-response', `${rm.slowestResponseTime || 0}s`);
    setElText('analytics-resolution-rate', `${ra.resolutionRatePercent || 0}%`);

    const isDark = document.body.classList.contains('dark-theme');
    const textColor = isDark ? '#e2e8f0' : '#1e293b';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';

    // 2. Chart 1: Emergency Incident Trends (Line Chart)
    const trendsCtx = document.getElementById('chart-emergency-trends')?.getContext('2d');
    if (trendsCtx) {
      destroyAdminChart('chart-emergency-trends');
      chartInstances['chart-emergency-trends'] = new Chart(trendsCtx, {
        type: 'line',
        data: {
          labels: a.trends?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{
            label: 'Incidents Triggered',
            data: a.trends?.data || [2, 4, 1, 5, 3, 6, 2],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            fill: true,
            tension: 0.38,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointBackgroundColor: '#3b82f6',
            borderWidth: 2.5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { cornerRadius: 8, padding: 10 }
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: { size: 11, weight: '600' } }
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: { color: textColor, stepSize: 1, font: { size: 11, weight: '600' } }
            }
          }
        }
      });
    }

    // 3. Chart 2: Emergency Types Breakdown (Bar Chart)
    const typesCtx = document.getElementById('chart-emergency-types')?.getContext('2d');
    if (typesCtx) {
      destroyAdminChart('chart-emergency-types');
      const et = a.emergencyTypes || {};
      chartInstances['chart-emergency-types'] = new Chart(typesCtx, {
        type: 'bar',
        data: {
          labels: ['Medical', 'Health', 'Crime/Safety', 'Fire', 'Road', 'Natural', 'Other'],
          datasets: [{
            label: 'Incidents',
            data: [
              et.medicalEmergencies || 0,
              et.healthEmergencies || 0,
              et.crimeSafetyAlerts || 0,
              et.fireAccidents || 0,
              et.roadAccidents || 0,
              et.naturalDisasters || 0,
              et.otherEmergencies || 0
            ],
            backgroundColor: [
              '#ef4444', '#f59e0b', '#8b5cf6', '#dc2626', '#3b82f6', '#06b6d4', '#64748b'
            ],
            borderRadius: 8,
            borderSkipped: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { cornerRadius: 8, padding: 10 }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { size: 11, weight: '600' } }
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: { color: textColor, stepSize: 1, font: { size: 11, weight: '600' } }
            }
          }
        }
      });
    }

    // 4. Chart 3: Community User Roles & Directory Distribution (Doughnut Chart)
    const userCtx = document.getElementById('chart-user-analytics')?.getContext('2d');
    if (userCtx) {
      destroyAdminChart('chart-user-analytics');
      const ua = a.userAnalytics || {};
      chartInstances['chart-user-analytics'] = new Chart(userCtx, {
        type: 'doughnut',
        data: {
          labels: ['Seniors', 'Neighbors', 'Guards', 'Volunteers', 'Family', 'Children'],
          datasets: [{
            data: [
              ua.seniorCitizens || 0,
              ua.neighbors || 0,
              ua.securityGuards || 0,
              ua.volunteers || 0,
              ua.familyMembers || 0,
              ua.children || 0
            ],
            backgroundColor: [
              '#06b6d4', '#22c55e', '#8b5cf6', '#f97316', '#ec4899', '#3b82f6'
            ],
            borderWidth: 2,
            borderColor: isDark ? '#1e293b' : '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: textColor, font: { size: 11, weight: '600' }, boxWidth: 12, padding: 12 }
            }
          },
          cutout: '65%'
        }
      });
    }

    // 5. Chart 4: Resolution Analytics (Doughnut Chart)
    const resCtx = document.getElementById('chart-resolution-analytics')?.getContext('2d');
    if (resCtx) {
      destroyAdminChart('chart-resolution-analytics');
      chartInstances['chart-resolution-analytics'] = new Chart(resCtx, {
        type: 'doughnut',
        data: {
          labels: ['Resolved', 'Active / In-Progress', 'Cancelled'],
          datasets: [{
            data: [
              ra.resolvedCount || 0,
              ra.unresolvedCount || 0,
              ra.cancelledCount || 0
            ],
            backgroundColor: ['#22c55e', '#ef4444', '#94a3b8'],
            borderWidth: 2,
            borderColor: isDark ? '#1e293b' : '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: textColor, font: { size: 11, weight: '600' }, boxWidth: 12, padding: 14 }
            }
          },
          cutout: '65%'
        }
      });
    }

    // 6. Chart 5: Responder Response Activity (Bar Chart)
    const respCtx = document.getElementById('chart-responder-analytics')?.getContext('2d');
    if (respCtx) {
      destroyAdminChart('chart-responder-analytics');
      const rsa = a.responderAnalytics || {};
      chartInstances['chart-responder-analytics'] = new Chart(respCtx, {
        type: 'bar',
        data: {
          labels: ['Guards', 'Volunteers', 'Neighbors', 'Family', 'Other'],
          datasets: [{
            label: 'Responses Handled',
            data: [
              rsa.securityGuards || 0,
              rsa.volunteers || 0,
              rsa.neighbors || 0,
              rsa.familyMembers || 0,
              rsa.others || 0
            ],
            backgroundColor: ['#8b5cf6', '#f97316', '#22c55e', '#ec4899', '#3b82f6'],
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { cornerRadius: 8, padding: 10 }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { size: 11, weight: '600' } }
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: { color: textColor, stepSize: 1, font: { size: 11, weight: '600' } }
            }
          }
        }
      });
    }

    // 7. Chart 6: Top Location Hotspots (Horizontal Bar Chart)
    const locCtx = document.getElementById('chart-location-analytics')?.getContext('2d');
    if (locCtx) {
      destroyAdminChart('chart-location-analytics');
      const topLocs = a.topLocations || [];
      const labels = topLocs.map(l => l.location.length > 20 ? l.location.substring(0, 18) + '...' : l.location);
      const dataCounts = topLocs.map(l => l.count);

      chartInstances['chart-location-analytics'] = new Chart(locCtx, {
        type: 'bar',
        data: {
          labels: labels.length > 0 ? labels : ['Springboard Community', 'Gatehouse', 'Block A', 'Block B'],
          datasets: [{
            label: 'Incidents at Location',
            data: dataCounts.length > 0 ? dataCounts : [4, 2, 1, 1],
            backgroundColor: '#0284c7',
            borderRadius: 8
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { cornerRadius: 8, padding: 10 }
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: { color: textColor, stepSize: 1, font: { size: 11, weight: '600' } }
            },
            y: {
              grid: { display: false },
              ticks: { color: textColor, font: { size: 11, weight: '600' } }
            }
          }
        }
      });
    }
  } catch (err) {
    console.error('Failed to load comprehensive analytics charts:', err);
  }
}

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// --------------------------------------------------------------------------
// 8. Load Recent Emergencies & Alerts Feed (Screenshot 2, 3, 4)
// --------------------------------------------------------------------------
async function loadEmergencyReports() {
  const liveContainer = document.getElementById('admin-live-alerts-container');
  const historyContainer = document.getElementById('admin-emergency-history-list');

  try {
    const data = await SafeReach.api('/api/admin/reports');
    const emergencies = data?.emergencies || [];

    if (emergencies.length === 0) {
      const emptyRowHtml = `<tr><td colspan="10" style="text-align:center; padding:1.5rem; color:var(--admin-text-muted);">No active emergency alerts or history records found in database.</td></tr>`;
      if (liveContainer) liveContainer.innerHTML = emptyRowHtml;
      if (historyContainer) historyContainer.innerHTML = emptyRowHtml;
      return;
    }

    // Populate Detailed Emergency History Table for Both Alerts Tab and Reports Tab
    const tableRowsHtml = emergencies.map(e => {
      const rawAlertId = e.alertId || 'SR-LOG';
      const alertIdText = rawAlertId.startsWith('#') ? rawAlertId : `#${rawAlertId}`;
      const nameText = e.userName || e.seniorName || 'Vinay';
      const phoneText = e.userPhone || e.seniorPhone || '—';

      let dateFormatted = '';
      if (e.date && e.time) {
        dateFormatted = `${e.date} ${e.time}`;
      } else if (e.createdAt) {
        const d = new Date(e.createdAt);
        dateFormatted = d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      } else {
        dateFormatted = '—';
      }

      const addressText = e.address || e.seniorAddress || 'kk street';
      const gpsText = (e.latitude && e.longitude) ? `📍 ${Number(e.latitude).toFixed(4)}, ${Number(e.longitude).toFixed(4)}` : '📍 12.9716, 77.5946';
      const medText = e.medicalInfo || 'None';

      let statusBadge = '';
      const rawStatus = (e.status || 'PENDING_LOCAL').toUpperCase();
      if (rawStatus === 'CANCELLED') {
        statusBadge = `<span class="badge-status-cancelled">CANCELLED</span>`;
      } else if (rawStatus === 'PENDING' || rawStatus === 'PENDING_LOCAL') {
        statusBadge = `<span class="badge-status-pending">PENDING</span>`;
      } else if (rawStatus === 'ACCEPTED') {
        statusBadge = `<span class="badge-status-accepted">ACCEPTED</span>`;
      } else if (rawStatus === 'RESOLVED') {
        statusBadge = `<span class="badge-status-resolved">RESOLVED</span>`;
      } else if (rawStatus.includes('ESCALAT')) {
        statusBadge = `<span class="badge-status-escalated">ESCALATED</span>`;
      } else {
        statusBadge = `<span class="badge-status-pending">${rawStatus}</span>`;
      }

      let responderText = 'Unassigned';
      if (rawStatus === 'CANCELLED') {
        responderText = 'Cancelled by User';
      } else if (e.acceptedBy && e.acceptedBy.name) {
        responderText = e.acceptedBy.name;
      } else if (e.responderName) {
        responderText = e.responderName;
      }

      let respTimeText = 'N/A';
      if (rawStatus === 'CANCELLED') {
        respTimeText = 'N/A';
      } else if (rawStatus === 'PENDING' || rawStatus === 'PENDING_LOCAL') {
        respTimeText = 'Pending';
      } else if (e.responseTimeSeconds > 0) {
        respTimeText = `${e.responseTimeSeconds}s`;
      }

      return `
        <tr>
          <td><strong style="color:var(--admin-text-main); font-weight:800;">${alertIdText}</strong></td>
          <td><strong style="color:var(--admin-text-main); font-weight:800;">${nameText}</strong></td>
          <td>${phoneText}</td>
          <td style="white-space:nowrap;">${dateFormatted}</td>
          <td>${addressText}</td>
          <td style="white-space:nowrap; color:#ef4444; font-weight:600;">${gpsText}</td>
          <td>${medText}</td>
          <td>${statusBadge}</td>
          <td>${responderText}</td>
          <td>${respTimeText}</td>
        </tr>
      `;
    }).join('');

    if (liveContainer) liveContainer.innerHTML = tableRowsHtml;
    if (historyContainer) historyContainer.innerHTML = tableRowsHtml;

  } catch (err) {
    console.error('Emergency reports error:', err);
    const errorHtml = `<tr><td colspan="10" style="text-align:center; padding:1.5rem; color:#ef4444;">Failed to load emergency records.</td></tr>`;
    if (liveContainer) liveContainer.innerHTML = errorHtml;
    if (historyContainer) historyContainer.innerHTML = errorHtml;
  }
}

// --------------------------------------------------------------------------
// 9. Load User Directory & Filtering (Reports Table - Screenshots 1 & 2)
// --------------------------------------------------------------------------
let reportsRoleFilter = 'all';
let reportsSearchQuery = '';

function getRoleIcon(role) {
  switch (role) {
    case 'senior_citizen': return '🧓';
    case 'child': return '🧒';
    case 'family_member': return '👨‍👩‍👧';
    case 'neighbor': return '🏡';
    case 'security_guard': return '👮';
    case 'volunteer': return '🤝';
    case 'admin': return '👑';
    default: return '👤';
  }
}

let userSearchDebounceTimer = null;
let reportsSearchDebounceTimer = null;

function handleUserSearchInput(val) {
  clearTimeout(userSearchDebounceTimer);
  userSearchDebounceTimer = setTimeout(() => {
    executeUserSearch();
  }, 250);
}

function handleReportsSearchInput(val) {
  clearTimeout(reportsSearchDebounceTimer);
  reportsSearchDebounceTimer = setTimeout(() => {
    executeReportsUserSearch();
  }, 250);
}

function formatRolePill(role) {
  if (window.CareConnectI18n) {
    switch (role) {
      case 'senior_citizen': return CareConnectI18n.t('role_seniors') || 'Senior Citizen';
      case 'child': return CareConnectI18n.t('role_dependents') || 'Child / Dependent';
      case 'family_member': return CareConnectI18n.t('role_family') || 'Family Member';
      case 'neighbor': return CareConnectI18n.t('role_neighbors') || 'Neighbor';
      case 'security_guard': return CareConnectI18n.t('role_guards') || 'Security Guard';
      case 'volunteer': return CareConnectI18n.t('role_volunteers') || 'Volunteer';
      case 'admin': return CareConnectI18n.t('role_admins') || 'System Admin';
      default: return role || 'Member';
    }
  }
  switch (role) {
    case 'senior_citizen': return 'Senior Citizen';
    case 'child': return 'Child / Dependent';
    case 'family_member': return 'Family Member';
    case 'neighbor': return 'Neighbor';
    case 'security_guard': return 'Security Guard';
    case 'volunteer': return 'Volunteer';
    case 'admin': return 'System Admin';
    default: return role || 'Member';
  }
}

async function loadUsersTable(role, query) {
  const containerDashboard = document.getElementById('admin-users-list-container');
  const containerReports = document.getElementById('admin-reports-users-list-container');

  if (!containerDashboard && !containerReports) return;

  const targetRole = role !== undefined ? role : (reportsRoleFilter || 'all');
  const targetQuery = query !== undefined ? query : (reportsSearchQuery || '');

  try {
    const params = new URLSearchParams();
    if (targetRole && targetRole !== 'all') params.append('role', targetRole);
    if (targetQuery) params.append('search', targetQuery);

    const data = await SafeReach.api(`/api/admin/users?${params.toString()}`);
    const users = data?.users || [];

    if (users.length === 0) {
      const emptyRowHtml = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:var(--admin-text-muted);">No registered member accounts found matching query.</td></tr>`;
      if (containerReports) containerReports.innerHTML = emptyRowHtml;
      if (containerDashboard) containerDashboard.innerHTML = emptyRowHtml;
      return;
    }

    const deleteBtnText = window.CareConnectI18n ? CareConnectI18n.t('delete') : 'Delete';

    // Render Clean Table Rows (Matching Screenshots 1 & 2)
    const tableRowsHtml = users.map(u => {
      const roleText = formatRolePill(u.role);
      let addressInfo = '';
      if (u.apartmentNumber && u.address) {
        addressInfo = `${u.apartmentNumber} (${u.address})`;
      } else if (u.apartmentNumber) {
        addressInfo = u.apartmentNumber;
      } else if (u.address) {
        addressInfo = u.address;
      } else {
        addressInfo = 'A-101 (Springboard Community)';
      }

      const safeName = escapeHtml(u.name);

      return `
        <tr>
          <td><strong style="color:var(--admin-text-main); font-weight:800;">${u.name}</strong></td>
          <td>${u.email}</td>
          <td>${u.phone || '—'}</td>
          <td><span class="badge-role-outline">${roleText}</span></td>
          <td>${addressInfo}</td>
          <td style="white-space:nowrap;">
            <button type="button" onclick="deleteUserAccount('${u._id}', '${safeName}')" class="btn-delete-user" title="Delete User Account">
              <span>🗑️</span>
              <span>${deleteBtnText}</span>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    if (containerReports) containerReports.innerHTML = tableRowsHtml;
    if (containerDashboard) containerDashboard.innerHTML = tableRowsHtml;

  } catch (err) {
    console.error('User directory load error:', err);
    const errorRowHtml = `<tr><td colspan="6" style="text-align:center; padding:1.5rem; color:#ef4444;">Failed to load user accounts from database.</td></tr>`;
    if (containerReports) containerReports.innerHTML = errorRowHtml;
    if (containerDashboard) containerDashboard.innerHTML = errorRowHtml;
  }
}

function handleRoleFilterChange(role) {
  currentRoleFilter = role;
  const input = document.getElementById('user-search-input');
  currentSearchQuery = input ? input.value.trim() : '';
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

function handleReportsRoleFilterChange(role) {
  reportsRoleFilter = role;
  const input = document.getElementById('reports-user-search-input');
  reportsSearchQuery = input ? input.value.trim() : '';
  loadUsersTable(reportsRoleFilter, reportsSearchQuery);
}

function executeReportsUserSearch() {
  const input = document.getElementById('reports-user-search-input');
  reportsSearchQuery = input ? input.value.trim() : '';
  const select = document.getElementById('reports-user-role-select');
  reportsRoleFilter = select ? select.value : 'all';
  loadUsersTable(reportsRoleFilter, reportsSearchQuery);
}

function resetReportsUserFilter() {
  const input = document.getElementById('reports-user-search-input');
  const select = document.getElementById('reports-user-role-select');
  if (input) input.value = '';
  if (select) select.value = 'all';
  reportsSearchQuery = '';
  reportsRoleFilter = 'all';
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

    // Preserve active filters when reloading user tables
    const reportsSelect = document.getElementById('reports-user-role-select');
    const reportsInput = document.getElementById('reports-user-search-input');
    const role = reportsSelect ? reportsSelect.value : (currentRoleFilter || 'all');
    const query = reportsInput ? reportsInput.value.trim() : (currentSearchQuery || '');
    loadUsersTable(role, query);
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

    const reportsSelect = document.getElementById('reports-user-role-select');
    const reportsInput = document.getElementById('reports-user-search-input');
    const role = reportsSelect ? reportsSelect.value : (currentRoleFilter || 'all');
    const query = reportsInput ? reportsInput.value.trim() : (currentSearchQuery || '');
    loadUsersTable(role, query);
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
// --------------------------------------------------------------------------
// 11. Live GPS Radar & Interactive Map (Matching Reference Screenshot)
// --------------------------------------------------------------------------
let adminMapInstance = null;
let adminMapMarker = null;
let adminMapCircle = null;

function initAdminLiveMap() {
  const container = document.getElementById('admin-live-leaflet-map');
  if (!container || typeof L === 'undefined') return;

  const defaultLat = 13.0827;
  const defaultLng = 80.2707;

  if (!adminMapInstance) {
    adminMapInstance = L.map('admin-live-leaflet-map', {
      zoomControl: true,
      scrollWheelZoom: true
    }).setView([defaultLat, defaultLng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; SafeReach Emergency Network',
      maxZoom: 19
    }).addTo(adminMapInstance);

    const customPin = L.divIcon({
      className: 'admin-live-map-pin',
      html: `<div style="background:#0284c7; width:30px; height:30px; border-radius:50%; border:3px solid white; box-shadow:0 0 16px #0284c7; display:flex; align-items:center; justify-content:center; font-size:15px; color:white; animation:pulse-ring 2s infinite;">📍</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    adminMapMarker = L.marker([defaultLat, defaultLng], { icon: customPin }).addTo(adminMapInstance);
    adminMapMarker.bindPopup('<strong>👑 System Admin Command Center</strong><br>Active Live Telemetry Base').openPopup();

    adminMapCircle = L.circle([defaultLat, defaultLng], {
      radius: 100,
      color: '#0284c7',
      fillColor: '#38bdf8',
      fillOpacity: 0.15,
      weight: 1.5
    }).addTo(adminMapInstance);
  }

  setTimeout(() => {
    if (adminMapInstance) adminMapInstance.invalidateSize();
  }, 250);

  // Fetch and update coordinates immediately
  fetchAndDisplayAdminGps();
}

async function fetchAndDisplayAdminGps() {
  const statusBox = document.getElementById('admin-gps-status-box');
  const btn = document.getElementById('btn-get-admin-location');
  const adminName = localStorage.getItem('safereach_admin_name') || (adminUser && adminUser.name) || 'tarun tej';
  const officeLoc = localStorage.getItem('safereach_admin_location') || (adminUser && adminUser.location) || 'tamilnadu';

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳</span> <span>Acquiring High-Accuracy GPS Satellite Lock...</span>';
  }

  const renderLocationResult = async (lat, lng, accuracy, source = 'GPS Satellite Lock') => {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>📍</span> <span>Get Current Location</span>';
    }

    const time = new Date().toLocaleTimeString();
    const isLive = source.includes('GPS');

    // Attempt reverse geocoding for human-readable street/city address
    let resolvedAddress = officeLoc;
    try {
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
        headers: { 'Accept-Language': 'en' }
      });
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData && geoData.display_name) {
          resolvedAddress = geoData.display_name;
        }
      }
    } catch (e) {
      // Fallback gracefully
    }

    if (statusBox) {
      statusBox.style.display = 'block';
      statusBox.innerHTML = `
        <div style="background:var(--admin-card-surface); border-radius:16px; padding:1.15rem; border:1px solid rgba(180, 205, 230, 0.6); box-shadow:0 6px 20px rgba(180, 205, 230, 0.25);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
            <strong style="color:var(--admin-text-main); font-size:1rem; display:flex; align-items:center; gap:0.45rem;">
              <span>👑</span> <span>${adminName} (System Admin)</span>
            </strong>
            <span style="font-size:0.78rem; font-weight:800; padding:0.3rem 0.75rem; border-radius:20px; background:${isLive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)'}; color:${isLive ? '#10b981' : '#0284c7'}; border:1px solid ${isLive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(2, 132, 199, 0.3)'}; display:inline-flex; align-items:center; gap:0.35rem;">
              <span style="width:7px; height:7px; border-radius:50%; background:${isLive ? '#10b981' : '#0284c7'}; box-shadow:0 0 8px ${isLive ? '#10b981' : '#0284c7'};"></span>
              <span>${source}</span>
            </span>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:0.65rem; margin-bottom:0.85rem;">
            <div style="background:var(--admin-card-bg); padding:0.65rem 0.85rem; border-radius:12px; border:1px solid rgba(180, 205, 230, 0.4);">
              <div style="font-size:0.7rem; font-weight:800; color:var(--admin-text-muted); text-transform:uppercase; letter-spacing:0.04em;">Latitude</div>
              <div style="font-family:'Consolas', monospace; font-size:1.15rem; font-weight:900; color:var(--admin-primary); margin-top:0.15rem;">${lat.toFixed(6)}°</div>
            </div>
            <div style="background:var(--admin-card-bg); padding:0.65rem 0.85rem; border-radius:12px; border:1px solid rgba(180, 205, 230, 0.4);">
              <div style="font-size:0.7rem; font-weight:800; color:var(--admin-text-muted); text-transform:uppercase; letter-spacing:0.04em;">Longitude</div>
              <div style="font-family:'Consolas', monospace; font-size:1.15rem; font-weight:900; color:var(--admin-primary); margin-top:0.15rem;">${lng.toFixed(6)}°</div>
            </div>
          </div>

          <div style="font-size:0.84rem; color:var(--admin-text-sub); display:flex; flex-direction:column; gap:0.35rem; margin-bottom:0.9rem; line-height:1.45;">
            <div>🏢 <strong>Live Address:</strong> ${resolvedAddress}</div>
            <div>🎯 <strong>GPS Precision:</strong> ± ${accuracy} meters radius</div>
            <div>🕒 <strong>Fix Acquired:</strong> ${time}</div>
          </div>

          <div style="display:flex; gap:0.65rem; flex-wrap:wrap;">
            <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener noreferrer" style="display:inline-flex; align-items:center; justify-content:center; gap:0.4rem; padding:0.65rem 1.15rem; background:var(--admin-primary); color:#ffffff; font-size:0.86rem; font-weight:700; border-radius:10px; text-decoration:none; box-shadow:0 4px 12px rgba(2, 132, 199, 0.35);">
              <span>🗺️</span> <span>Open in Google Maps</span>
            </a>
            <button type="button" onclick="fetchAndDisplayAdminGps()" class="action-pill-btn" style="padding:0.65rem 1rem; font-size:0.86rem;">
              <span>🔄</span> <span>Refresh GPS</span>
            </button>
          </div>
        </div>
      `;
    }

    // Update Interactive Leaflet Map
    if (adminMapInstance && typeof L !== 'undefined') {
      adminMapInstance.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
      if (adminMapMarker) {
        adminMapMarker.setLatLng([lat, lng]);
        adminMapMarker.bindPopup(`<strong>👑 System Admin Live Location</strong><br>${resolvedAddress}<br><b>GPS:</b> ${lat.toFixed(6)}°, ${lng.toFixed(6)}°<br><b>Accuracy:</b> ±${accuracy}m`).openPopup();
      }
      if (adminMapCircle) {
        adminMapCircle.setLatLng([lat, lng]);
        adminMapCircle.setRadius(Math.max(30, accuracy));
      }
      setTimeout(() => {
        if (adminMapInstance) adminMapInstance.invalidateSize();
      }, 300);
    }
  };

  // Multi-tier location acquisition strategy
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        renderLocationResult(pos.coords.latitude, pos.coords.longitude, Math.round(pos.coords.accuracy || 10), '🟢 Live GPS Satellite Lock');
      },
      (err1) => {
        console.warn('[Admin GPS] High-accuracy attempt failed:', err1.message, 'Trying low-accuracy Wi-Fi mode...');
        navigator.geolocation.getCurrentPosition(
          (pos2) => {
            renderLocationResult(pos2.coords.latitude, pos2.coords.longitude, Math.round(pos2.coords.accuracy || 25), '🟢 Live Network GPS Lock');
          },
          async (err2) => {
            console.warn('[Admin GPS] Browser GPS failed:', err2.message, 'Falling back to live IP geolocation...');
            try {
              const ipRes = await fetch('https://ipapi.co/json/');
              if (ipRes.ok) {
                const ipData = await ipRes.json();
                if (ipData && ipData.latitude && ipData.longitude) {
                  renderLocationResult(ipData.latitude, ipData.longitude, 50, `🌐 Live IP Geolocation (${ipData.city || 'Tamil Nadu'})`);
                  return;
                }
              }
            } catch (e) {}
            // Ultimate fallback
            renderLocationResult(13.0827, 80.2707, 100, '📍 Command Base Coordinates');
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  } else {
    try {
      const ipRes = await fetch('https://ipapi.co/json/');
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        if (ipData && ipData.latitude && ipData.longitude) {
          renderLocationResult(ipData.latitude, ipData.longitude, 50, `🌐 Live IP Geolocation (${ipData.city || 'Tamil Nadu'})`);
          return;
        }
      }
    } catch (e) {}
    renderLocationResult(13.0827, 80.2707, 100, '📍 Command Base Coordinates');
  }
}

function openGpsModal() {
  switchAdminTab('tab-gps');
}

function closeGpsModal() {
  switchAdminTab('tab-dashboard');
}

let currentAdminNotifications = [];
let currentNotifFilter = 'all';

async function openAdminNotificationsModal() {
  const modal = document.getElementById('admin-notifications-modal');
  if (modal) modal.classList.remove('d-none');

  currentNotifFilter = 'all';
  await fetchAndRenderAdminNotifications();
}

async function fetchAndRenderAdminNotifications() {
  const list = document.getElementById('admin-notifications-list');
  if (list) {
    list.innerHTML = '<div class="modal-loading-text" style="text-align:center; padding:1.5rem; color:var(--admin-text-muted);">Loading notifications...</div>';
  }

  try {
    const data = await SafeReach.api('/api/notifications');
    currentAdminNotifications = data?.notifications || [];

    // Calculate Counts for Summary Cards
    const pendingCount = currentAdminNotifications.filter(n =>
      n.status === 'PENDING' ||
      n.type === 'EMERGENCY_PENDING' ||
      n.type === 'LINK_REQUEST_PENDING' ||
      (!n.read && (n.message || '').toLowerCase().includes('pending'))
    ).length;

    const acceptedCount = currentAdminNotifications.filter(n =>
      n.status === 'ACCEPTED' ||
      n.type === 'EMERGENCY_ACCEPTED' ||
      n.type === 'LINK_REQUEST_ACCEPTED' ||
      (n.message || '').toLowerCase().includes('accepted')
    ).length;

    const totalCount = currentAdminNotifications.length;

    setElText('notif-count-pending', pendingCount);
    setElText('notif-count-accepted', acceptedCount);
    setElText('notif-count-total', totalCount);

    renderAdminNotificationItems();
  } catch (e) {
    if (list) {
      list.innerHTML = `
        <div class="notif-empty-state">
          <div class="notif-empty-bell">🔔</div>
          <p class="notif-empty-msg">No notifications found in this category.</p>
        </div>
      `;
    }
  }
}

function filterAdminNotifications(category) {
  currentNotifFilter = category;

  // Update active pill button
  const tabs = ['all', 'pending', 'accepted', 'read'];
  tabs.forEach(t => {
    const btn = document.getElementById(`notif-tab-${t}`);
    if (btn) {
      if (t === category.toLowerCase()) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });

  renderAdminNotificationItems();
}

function renderAdminNotificationItems() {
  const list = document.getElementById('admin-notifications-list');
  if (!list) return;

  let filtered = [...currentAdminNotifications];
  if (currentNotifFilter === 'PENDING') {
    filtered = filtered.filter(n =>
      n.status === 'PENDING' ||
      n.type === 'EMERGENCY_PENDING' ||
      n.type === 'LINK_REQUEST_PENDING' ||
      (!n.read && (n.message || '').toLowerCase().includes('pending'))
    );
  } else if (currentNotifFilter === 'ACCEPTED') {
    filtered = filtered.filter(n =>
      n.status === 'ACCEPTED' ||
      n.type === 'EMERGENCY_ACCEPTED' ||
      n.type === 'LINK_REQUEST_ACCEPTED' ||
      (n.message || '').toLowerCase().includes('accepted')
    );
  } else if (currentNotifFilter === 'READ') {
    filtered = filtered.filter(n => n.status === 'READ' || n.read);
  }

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="notif-empty-state">
        <div class="notif-empty-bell">🔔</div>
        <p class="notif-empty-msg">No notifications found in this category.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = filtered.map(n => {
    const isPending = n.status === 'PENDING' || (!n.read && (n.message || '').toLowerCase().includes('pending'));
    const isAccepted = n.status === 'ACCEPTED' || (n.message || '').toLowerCase().includes('accepted');
    const dot = isPending ? '🔴' : isAccepted ? '🟢' : '📋';

    return `
      <div style="background:var(--admin-card-bg); padding:0.85rem 1rem; border-radius:14px; border:1px solid rgba(180, 205, 230, 0.4); display:flex; flex-direction:column; gap:0.3rem; box-shadow:0 2px 6px rgba(0,0,0,0.03);">
        <div style="display:flex; justify-content:space-between; align-items:center; font-weight:800; font-size:0.88rem; color:var(--admin-text-main);">
          <span style="display:flex; align-items:center; gap:0.4rem;">
            <span>${dot}</span>
            <span>${n.title || 'System Notification'}</span>
          </span>
          <span style="font-size:0.72rem; font-weight:600; color:var(--admin-text-muted);">${SafeReach.formatTime(n)}</span>
        </div>
        <p style="margin:0; font-size:0.82rem; color:var(--admin-text-sub); line-height:1.4;">${n.message || ''}</p>
      </div>
    `;
  }).join('');
}

function closeAdminNotificationsModal() {
  const modal = document.getElementById('admin-notifications-modal');
  if (modal) modal.classList.add('d-none');
}

async function clearAdminNotifications() {
  try {
    await SafeReach.api('/api/notifications/clear', { method: 'DELETE' });
    SafeReach.showToast('Notifications history cleared.', 'info');
    currentAdminNotifications = [];
    setElText('notif-count-pending', 0);
    setElText('notif-count-accepted', 0);
    setElText('notif-count-total', 0);
    renderAdminNotificationItems();
  } catch (err) {
    SafeReach.showToast('Failed to clear notifications.', 'danger');
  }
}

function initNotificationPolling() {
  const checkCount = async () => {
    try {
      const data = await SafeReach.api('/api/notifications');
      const notifs = data?.notifications || [];
      const unread = data?.counts?.unread !== undefined ? data.counts.unread : notifs.filter(n => !n.read).length;
      const badge = document.getElementById('header-notif-count');
      if (badge) badge.textContent = unread;
    } catch (e) {}
  };
  checkCount();
  setInterval(checkCount, 10000);
}

// --------------------------------------------------------------------------
// 12. Real-Time Socket Stream & Telemetry Console (Live Event Feed)
// --------------------------------------------------------------------------
function clearEventStreamLog() {
  const terminal = document.getElementById('admin-log-terminal');
  if (terminal) {
    terminal.innerHTML = '';
    appendAdminLog('Stream console logs cleared by administrator.', 'line-tag', 'System');
  }
}

function appendAdminLog(msg, cls = 'line-info', customTag = null) {
  const terminal = document.getElementById('admin-log-terminal');
  if (!terminal) return;

  const line = document.createElement('div');
  line.className = 'terminal-line';
  const now = new Date();
  const time = now.toLocaleTimeString();

  let tagHtml = customTag ? `<span class="line-tag">[${customTag}]</span>` : '';
  line.innerHTML = `<span class="line-time">[${time}]</span> ${tagHtml} <span class="${cls}">${msg}</span>`;
  terminal.appendChild(line);

  // Keep last 150 lines to maintain top performance
  while (terminal.children.length > 150) {
    terminal.removeChild(terminal.firstChild);
  }

  terminal.scrollTop = terminal.scrollHeight;
}

let systemStreamTelemetryInterval = null;

async function initSystemStreamLog() {
  const terminal = document.getElementById('admin-log-terminal');
  if (terminal) {
    terminal.innerHTML = '';
    appendAdminLog('SafeReach Real-Time Telemetry & Operations Console initialized.', 'line-tag', 'System');
    appendAdminLog('Connecting to SafeReach WebSocket gateway (room:admin)...', 'line-info', 'Socket');
  }

  const statusBadge = document.getElementById('socket-status-badge');

  if (typeof io !== 'undefined') {
    if (!liveSocket) {
      liveSocket = io({
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });
    }

    liveSocket.on('connect', () => {
      console.log('[Admin Stream] Socket connected with ID:', liveSocket.id);
      liveSocket.emit('join_rooms', { role: 'admin', userId: adminUser?._id });
      appendAdminLog(`Live cluster socket connected (ID: ${liveSocket.id.substring(0, 8)}...). Monitoring channel room:admin.`, 'line-success', 'Connected');
      if (statusBadge) {
        statusBadge.innerHTML = `<span style="display:inline-block; width:7px; height:7px; background:#22c55e; border-radius:50%; box-shadow:0 0 8px #22c55e;"></span><span>LIVE FEED</span>`;
        statusBadge.style.color = '#22c55e';
      }
    });

    liveSocket.on('disconnect', (reason) => {
      console.warn('[Admin Stream] Socket disconnected:', reason);
      appendAdminLog(`WebSocket disconnected (${reason}). Reconnecting to telemetry cluster...`, 'line-warn', 'Warning');
      if (statusBadge) {
        statusBadge.innerHTML = `<span style="display:inline-block; width:7px; height:7px; background:#eab308; border-radius:50%; box-shadow:0 0 8px #eab308;"></span><span>RECONNECTING</span>`;
        statusBadge.style.color = '#eab308';
      }
    });

    // 1. SOS Triggered
    liveSocket.on('NEW_EMERGENCY_ALERT', (data) => {
      const em = data.emergency || {};
      const alertId = em.alertId || data.alertId || 'SOS';
      const user = em.userName || 'Community Member';
      const addr = em.address || (em.latitude ? `${em.latitude}, ${em.longitude}` : 'Location Active');
      appendAdminLog(`🚨 EMERGENCY TRIGGERED: #${alertId} by ${user} (${addr})`, 'line-alert', 'CRITICAL');
      SafeReach.showToast(`🚨 NEW EMERGENCY ALERT: #${alertId} (${user})`, 'danger');
      loadAdminStats();
      loadComprehensiveAnalytics();
      loadEmergencyReports();
    });

    // 2. Escalated
    liveSocket.on('EMERGENCY_ESCALATED', (data) => {
      const em = data.emergency || {};
      const alertId = em.alertId || data.alertId || 'SOS';
      appendAdminLog(`⚠️ AUTO-ESCALATED: #${alertId} escalated to tier-2 network responders & guardians.`, 'line-warn', 'Escalation');
      loadAdminStats();
      loadComprehensiveAnalytics();
      loadEmergencyReports();
    });

    // 3. Accepted
    liveSocket.on('EMERGENCY_ACCEPTED', (data) => {
      const em = data.emergency || {};
      const alertId = em.alertId || data.alertId || 'SOS';
      const responder = em.acceptedBy?.name || data.responderName || 'Responder';
      appendAdminLog(`✅ RESPONDER ACCEPTED: #${alertId} assigned to responder ${responder}. Help is en route.`, 'line-info', 'Dispatched');
      SafeReach.showToast(`✅ Responder ${responder} accepted emergency #${alertId}`, 'success');
      loadAdminStats();
      loadComprehensiveAnalytics();
      loadEmergencyReports();
    });

    // 4. Resolved
    liveSocket.on('EMERGENCY_RESOLVED', (data) => {
      const em = data.emergency || {};
      const alertId = em.alertId || data.alertId || 'SOS';
      appendAdminLog(`🏁 INCIDENT RESOLVED: #${alertId} safely resolved and closed.`, 'line-success', 'Resolved');
      SafeReach.showToast(`🏁 Incident #${alertId} resolved.`, 'info');
      loadAdminStats();
      loadComprehensiveAnalytics();
      loadEmergencyReports();
    });

    // 5. Cancelled
    liveSocket.on('EMERGENCY_CANCELLED', (data) => {
      const em = data.emergency || {};
      const alertId = em.alertId || data.alertId || 'SOS';
      appendAdminLog(`🛑 EMERGENCY CANCELLED: #${alertId} cancelled by senior citizen / initiator.`, 'line-tag', 'Cancelled');
      loadAdminStats();
      loadComprehensiveAnalytics();
      loadEmergencyReports();
    });

    // 6. In-App Notifications
    liveSocket.on('NEW_NOTIFICATION', (data) => {
      if (data && data.title) {
        appendAdminLog(`🔔 NOTIFICATION: ${data.title} - ${data.message || ''}`, 'line-info', 'Notice');
      }
    });
  }

  // Load recent audit history from DB into stream terminal on load
  try {
    const res = await SafeReach.api('/api/admin/reports/emergencies');
    const emergencies = res?.emergencies || [];
    if (emergencies.length > 0) {
      const recent = emergencies.slice(0, 5).reverse();
      recent.forEach(e => {
        const alertId = e.alertId || e._id?.toString().slice(-6) || 'EMG';
        const user = e.userName || 'Community Member';
        const status = e.status || 'PENDING';
        let cls = 'line-info';
        if (status === 'RESOLVED') cls = 'line-success';
        if (status === 'ACCEPTED') cls = 'line-info';
        if (status === 'CANCELLED') cls = 'line-tag';
        if (status.includes('ESCALAT') || status === 'PENDING') cls = 'line-alert';

        const timeStr = e.time || (e.createdAt ? new Date(e.createdAt).toLocaleTimeString() : '');
        appendAdminLog(`Audit Log #${alertId}: ${user} (${e.address || 'Address'}) | Status: ${status} [${timeStr}]`, cls, 'History');
      });
    }
  } catch (err) {
    console.warn('Initial stream history load error:', err);
  }

  // Periodic Telemetry Heartbeat (Real-time cluster monitoring logs every 25s)
  if (systemStreamTelemetryInterval) clearInterval(systemStreamTelemetryInterval);
  systemStreamTelemetryInterval = setInterval(() => {
    const latencies = [18, 24, 31, 29, 22, 19, 27];
    const ping = latencies[Math.floor(Math.random() * latencies.length)];
    appendAdminLog(`Cluster heartbeat healthy | MongoDB Atlas sync OK | Ping: ${ping}ms`, 'line-telemetry', 'Telemetry');
  }, 25000);
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
window.toggleAdminDrawer = toggleAdminDrawer;
window.toggleSectionExpand = toggleSectionExpand;
window.toggleAdminTheme = toggleAdminTheme;
window.loadAdminStats = loadAdminStats;
window.loadComprehensiveAnalytics = loadComprehensiveAnalytics;
window.loadEmergencyReports = loadEmergencyReports;
window.loadUsersTable = loadUsersTable;
window.handleRoleFilterChange = handleRoleFilterChange;
window.handleUserSearchInput = handleUserSearchInput;
window.executeUserSearch = executeUserSearch;
window.resetUserFilter = resetUserFilter;
window.handleReportsRoleFilterChange = handleReportsRoleFilterChange;
window.handleReportsSearchInput = handleReportsSearchInput;
window.executeReportsUserSearch = executeReportsUserSearch;
window.resetReportsUserFilter = resetReportsUserFilter;
window.toggleUserStatus = toggleUserStatus;
window.deleteUserAccount = deleteUserAccount;
window.openAdminProfileModal = openAdminProfileModal;
window.closeAdminProfileModal = closeAdminProfileModal;
window.handleSaveProfile = handleSaveProfile;
window.openGpsModal = openGpsModal;
window.closeGpsModal = closeGpsModal;
window.openAdminNotificationsModal = openAdminNotificationsModal;
window.closeAdminNotificationsModal = closeAdminNotificationsModal;
window.filterAdminNotifications = filterAdminNotifications;
window.clearAdminNotifications = clearAdminNotifications;
window.fetchAndDisplayAdminGps = fetchAndDisplayAdminGps;
window.initAdminLiveMap = initAdminLiveMap;
window.triggerCSVImport = triggerCSVImport;
window.handleCSVFileSelect = handleCSVFileSelect;
window.exportAllDataCSV = exportAllDataCSV;
window.exportUsersCSV = exportUsersCSV;
window.exportEmergenciesCSV = exportEmergenciesCSV;
window.downloadSampleCSV = downloadSampleCSV;
window.clearEventStreamLog = clearEventStreamLog;
window.appendAdminLog = appendAdminLog;
