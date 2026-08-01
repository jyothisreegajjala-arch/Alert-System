/* SafeReach - Admin Management Console Controller */

document.addEventListener('DOMContentLoaded', async () => {
  const user = SafeReach.getUser();
  if (!user || user.role !== 'admin') {
    SafeReach.showToast('Access denied: Admin authorization required.', 'danger');
    window.location.href = '/dashboard';
    return;
  }

  loadAdminStats();
  loadUsersTable();
  initSearchAndFilter();
  initSystemStreamLog();
});

// Load KPI Metrics
async function loadAdminStats() {
  try {
    const data = await SafeReach.api('/api/admin/stats');
    const stats = data.stats;

    document.getElementById('kpi-total-users').textContent = stats.totalUsers || 0;
    document.getElementById('kpi-neighbors').textContent = stats.totalNeighbors || 0;
    document.getElementById('kpi-guards').textContent = stats.totalSecurityGuards || 0;
    document.getElementById('kpi-volunteers').textContent = stats.totalVolunteers || 0;
    document.getElementById('kpi-active-sos').textContent = stats.activeEmergencies || 0;
    document.getElementById('kpi-avg-response').textContent = `${stats.avgResponseTimeSec || 0}s`;
  } catch (err) {
    console.error('Failed to load admin stats:', err);
  }
}

// Load Users Management Table
async function loadUsersTable(roleFilter = 'all', searchQuery = '') {
  try {
    const query = new URLSearchParams();
    if (roleFilter !== 'all') query.append('role', roleFilter);
    if (searchQuery) query.append('search', searchQuery);

    const data = await SafeReach.api(`/api/admin/users?${query.toString()}`);
    const tbody = document.getElementById('admin-users-table-body');
    if (!tbody) return;

    if (!data.users || data.users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:var(--dark-muted); padding:1.5rem;">No users found matching query.</td></tr>`;
      return;
    }

    tbody.innerHTML = '';
    data.users.forEach(u => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>${u.phone}</td>
        <td><span class="badge badge-accepted">${SafeReach.formatRole(u.role)}</span></td>
        <td>${u.apartmentNumber || u.address || '—'}</td>
        <td>
          <button onclick="toggleUserStatus('${u._id}')" class="btn btn-sm ${u.active ? 'btn-success' : 'btn-secondary'}">
            ${u.active ? '🟢 Active' : '🔴 Deactivated'}
          </button>
        </td>
        <td>
          <button onclick="deleteUserAccount('${u._id}', '${u.name}')" class="btn btn-outline-danger btn-sm">🗑️ Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

// Search and Pill Filters
function initSearchAndFilter() {
  const searchInput = document.getElementById('user-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const activePill = document.querySelector('.pill-btn.active')?.dataset.role || 'all';
      loadUsersTable(activePill, e.target.value);
    });
  }

  const pills = document.querySelectorAll('.pill-btn');
  pills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      pills.forEach(p => p.classList.remove('active'));
      e.target.classList.add('active');
      const role = e.target.dataset.role;
      const searchVal = document.getElementById('user-search-input')?.value || '';
      loadUsersTable(role, searchVal);
    });
  });
}

// User Actions
async function toggleUserStatus(userId) {
  try {
    const data = await SafeReach.api(`/api/admin/users/${userId}/toggle-status`, { method: 'PUT' });
    SafeReach.showToast(data.message, 'success');
    loadAdminStats();
    loadUsersTable();
  } catch (err) {
    SafeReach.showToast(err.message, 'danger');
  }
}

async function deleteUserAccount(userId, name) {
  if (!confirm(`Are you sure you want to permanently delete user account: ${name}?`)) return;
  try {
    const data = await SafeReach.api(`/api/admin/users/${userId}`, { method: 'DELETE' });
    SafeReach.showToast(data.message, 'success');
    loadAdminStats();
    loadUsersTable();
  } catch (err) {
    SafeReach.showToast(err.message, 'danger');
  }
}

// Real-Time Socket Log Stream
function initSystemStreamLog() {
  const logTerminal = document.getElementById('admin-log-terminal');
  if (!logTerminal) return;

  const appendLog = (msg, type = 'info') => {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="log-time">[${time}]</span> <span class="log-msg-${type}">${msg}</span>`;
    logTerminal.appendChild(entry);
    logTerminal.scrollTop = logTerminal.scrollHeight;
  };

  appendLog('SafeReach Operations Console Initialized.', 'success');

  if (typeof io !== 'undefined') {
    const socket = io();
    socket.emit('join_rooms', { role: 'admin' });

    socket.on('NEW_EMERGENCY_ALERT', (data) => {
      appendLog(`🚨 EMERGENCY TRIGGERED: ${data.message}`, 'alert');
      loadAdminStats();
    });

    socket.on('EMERGENCY_ESCALATED', (data) => {
      appendLog(`⚠️ AUTO-ESCALATED (60s Timeout): ${data.message}`, 'alert');
      loadAdminStats();
    });

    socket.on('EMERGENCY_ACCEPTED', (data) => {
      appendLog(`✅ EMERGENCY ACCEPTED: ${data.message}`, 'info');
      loadAdminStats();
    });

    socket.on('EMERGENCY_RESOLVED', (data) => {
      appendLog(`🏁 EMERGENCY RESOLVED: ${data.message}`, 'success');
      loadAdminStats();
    });
  }
}

window.toggleUserStatus = toggleUserStatus;
window.deleteUserAccount = deleteUserAccount;
