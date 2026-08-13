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

// CSV File Operations & Integration with Excel

function triggerCSVImport() {
  const fileInput = document.getElementById('csv-file-input');
  if (fileInput) {
    fileInput.click();
  }
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
      const csvText = e.target.result;
      const parsedData = parseCSVText(csvText);

      if (parsedData.length === 0) {
        SafeReach.showToast('CSV file is empty or formatted incorrectly.', 'warning');
        return;
      }

      SafeReach.showToast(`Importing ${parsedData.length} records into database...`, 'info');

      const res = await SafeReach.api('/api/admin/users/import-csv', {
        method: 'POST',
        body: JSON.stringify({ usersData: parsedData })
      });

      if (res.success) {
        SafeReach.showToast(res.message, 'success');
        loadAdminStats();
        loadUsersTable();
      } else {
        SafeReach.showToast(res.message || 'Import failed', 'danger');
      }
    } catch (err) {
      console.error('CSV parse error:', err);
      SafeReach.showToast('Failed to process CSV file: ' + err.message, 'danger');
    } finally {
      event.target.value = '';
    }
  };

  reader.readAsText(file);
}

// Download/Export Users CSV for Excel
async function exportUsersCSV() {
  try {
    const token = SafeReach.getToken();
    const response = await fetch('/api/admin/users/export-csv', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safereach_users_directory_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    SafeReach.showToast('Users directory CSV downloaded successfully for Excel.', 'success');
  } catch (err) {
    SafeReach.showToast('Failed to export CSV: ' + err.message, 'danger');
  }
}

// Download/Export Emergency Logs CSV for Excel
async function exportEmergenciesCSV() {
  try {
    const token = SafeReach.getToken();
    const response = await fetch('/api/admin/emergencies/export-csv', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safereach_emergency_logs_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    SafeReach.showToast('Emergency logs CSV downloaded successfully for Excel.', 'success');
  } catch (err) {
    SafeReach.showToast('Failed to export emergency logs: ' + err.message, 'danger');
  }
}

// Download/Export Master CSV File (All User Details + All Emergency Alerts)
async function exportAllDataCSV() {
  try {
    const token = SafeReach.getToken();
    const response = await fetch('/api/admin/export-all-csv', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Master export failed');
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safereach_master_users_and_emergencies_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    SafeReach.showToast('Master CSV (Users + Emergency Alerts) downloaded successfully for Excel.', 'success');
  } catch (err) {
    SafeReach.showToast('Failed to export master CSV data: ' + err.message, 'danger');
  }
}

// Download Sample CSV Template
function downloadSampleCSV() {
  const sampleCSV = 'Name,Email,Phone,Password,Role,Address,ApartmentNumber,MedicalInfo\n' +
    'Ramesh Sharma,ramesh.s@example.com,9876543210,password123,senior_citizen,Sunrise Heights,A-102,Hypertension\n' +
    'Vikram Singh,vikram.guard@example.com,9876543211,password123,security_guard,Sunrise Heights Gatehouse,A-Gatehouse,\n' +
    'Priya Patel,priya.n@example.com,9876543212,password123,neighbor,Sunrise Heights,A-103,\n' +
    'Anil Kumar,anil.vol@example.com,9876543213,password123,volunteer,Community Center,Block B,\n';

  const blob = new Blob([sampleCSV], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'safereach_user_import_template.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  SafeReach.showToast('CSV import template downloaded for Excel.', 'info');
}

window.toggleUserStatus = toggleUserStatus;
window.deleteUserAccount = deleteUserAccount;
window.triggerCSVImport = triggerCSVImport;
window.handleCSVFileSelect = handleCSVFileSelect;
window.exportUsersCSV = exportUsersCSV;
window.exportEmergenciesCSV = exportEmergenciesCSV;
window.exportAllDataCSV = exportAllDataCSV;
window.downloadSampleCSV = downloadSampleCSV;
