/* SafeReach - Core Frontend Utilities & API Manager */

const SafeReach = {
  // Store authentication token
  getToken: () => localStorage.getItem('safereach_token'),
  setToken: (token) => localStorage.setItem('safereach_token', token),
  clearAuth: () => {
    localStorage.removeItem('safereach_token');
    localStorage.removeItem('safereach_user');
  },
  logout: () => {
    SafeReach.clearAuth();
    if (typeof SafeReach.showToast === 'function') {
      SafeReach.showToast('Signed out successfully.', 'info');
    }
    setTimeout(() => {
      window.location.href = '/login';
    }, 150);
  },
  getUser: () => {
    const u = localStorage.getItem('safereach_user');
    return u ? JSON.parse(u) : null;
  },
  setUser: (user) => localStorage.setItem('safereach_user', JSON.stringify(user)),

  // Persistent Session Validator & Auto-Redirect Engine
  checkPersistentSession: async () => {
    const token = SafeReach.getToken();
    if (!token) return null;

    try {
      const data = await SafeReach.api('/api/auth/me');
      if (data && data.user) {
        SafeReach.setUser(data.user);
        return data.user;
      }
    } catch (err) {
      console.warn('[SafeReach Auth] Session invalid or expired. Clearing stored credentials.');
      SafeReach.clearAuth();
    }
    return null;
  },

  autoRedirectIfLoggedIn: async () => {
    const path = window.location.pathname;
    // Only auto-redirect on login page, allowing free access to the Home Entrance page (/) with Title & App details
    const isLoginPage = path === '/login' || path.endsWith('/login.html');
    if (!isLoginPage) return;

    const token = SafeReach.getToken();
    if (!token) return;

    const user = await SafeReach.checkPersistentSession();
    if (user) {
      if (user.role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/dashboard';
      }
    }
  },

  // Global Toast Notifications
  showToast: (message, type = 'info') => {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'danger') icon = '🚨';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  // Authorized API Fetch wrapper
  api: async (endpoint, options = {}) => {
    const token = SafeReach.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    try {
      const response = await fetch(endpoint, { ...options, headers });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          SafeReach.clearAuth();
          if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/register') && window.location.pathname !== '/') {
            window.location.href = '/login';
          }
        }
        throw new Error(data.message || 'API request failed');
      }
      return data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  },

  // Format Role Display Name (Multilingual Translated)
  formatRole: (role) => {
    if (window.CareConnectI18n) {
      const i18nKeys = {
        senior_citizen: 'senior_citizen',
        child: 'child_dependent',
        family_member: 'guardian',
        neighbor: 'neighbor',
        security_guard: 'security',
        volunteer: 'volunteer',
        admin: 'admin'
      };
      const key = i18nKeys[role];
      if (key) return CareConnectI18n.t(key);
    }
    const roles = {
      senior_citizen: 'Senior Citizen',
      child: 'Child / Dependent',
      family_member: 'Family Member',
      neighbor: 'Nearby Neighbor',
      security_guard: 'Security Guard',
      volunteer: 'Community Volunteer',
      admin: 'System Administrator'
    };
    return roles[role] || role;
  },

  // Format Time in IST (Asia/Kolkata, UTC+5:30)
  formatTime: (item) => {
    if (!item) return '';

    // 1. Convert UTC Date timestamp to Asia/Kolkata (IST) time
    const ts = typeof item === 'object' ? (item.createdAt || item.timestamp || item.updatedAt) : null;
    if (ts) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
      }
    }

    // 2. Convert raw UTC time string (e.g. "06:32:14 PM" or "18:32:14") to IST
    const timeStr = typeof item === 'string' ? item : item?.time;
    if (timeStr) {
      const match = String(timeStr).match(/^(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?$/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const seconds = parseInt(match[3], 10);
        const ampm = match[4] ? match[4].toUpperCase() : null;

        if (ampm === 'PM' && hours < 12) hours += 12;
        if (ampm === 'AM' && hours === 12) hours = 0;

        const now = new Date();
        const utcDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hours, minutes, seconds));
        if (!isNaN(utcDate.getTime())) {
          return utcDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
        }
      }
      return timeStr;
    }

    // 3. Fallback: current system Date converted once to IST
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  },

  // Format Date in IST (Asia/Kolkata, UTC+5:30)
  formatDate: (item) => {
    if (!item) return '';

    // Convert UTC Date timestamp to Asia/Kolkata (IST) date
    const ts = typeof item === 'object' ? (item.createdAt || item.timestamp || item.updatedAt) : null;
    if (ts) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' });
      }
    }

    const dateStr = typeof item === 'string' ? item : item?.date;
    if (dateStr) return dateStr;

    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Kolkata' });
  }
};

/* CareConnect Theme Controller (Light/Dark Mode Engine) */
const CareConnectTheme = {
  getTheme: () => localStorage.getItem('safereach_theme') || 'dark',
  
  setTheme: (theme) => {
    localStorage.setItem('safereach_theme', theme);
    CareConnectTheme.applyTheme(theme);
  },

  toggle: () => {
    const current = CareConnectTheme.getTheme();
    const next = current === 'light' ? 'dark' : 'light';
    CareConnectTheme.setTheme(next);
    if (window.SafeReach && SafeReach.showToast) {
      SafeReach.showToast(`Switched to ${next === 'light' ? 'Light' : 'Dark'} Mode`, 'info');
    }
  },

  applyTheme: (theme) => {
    const isLight = theme === 'light';
    if (isLight) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }

    const iconEls = document.querySelectorAll('.theme-toggle-icon');
    const textEls = document.querySelectorAll('.theme-toggle-text');

    iconEls.forEach(el => { el.textContent = isLight ? '☀️' : '🌙'; });
    textEls.forEach(el => { el.textContent = isLight ? 'Light' : 'Dark'; });
  },

  init: () => {
    const savedTheme = CareConnectTheme.getTheme();
    CareConnectTheme.applyTheme(savedTheme);
  }
};

window.togglePasswordVisibility = function(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.innerHTML = '🙈';
    btn.setAttribute('aria-label', 'Hide password');
  } else {
    input.type = 'password';
    btn.innerHTML = '👁️';
    btn.setAttribute('aria-label', 'Show password');
  }
};

window.CareConnectTheme = CareConnectTheme;
window.logout = function() {
  SafeReach.logout();
};

window.toggleReportsSection = function(contentId, arrowId) {
  const contentEl = document.getElementById(contentId);
  const arrowEl = document.getElementById(arrowId);
  if (!contentEl) return;

  if (contentEl.style.display === 'none') {
    contentEl.style.display = 'block';
    if (arrowEl) arrowEl.textContent = '▼';
  } else {
    contentEl.style.display = 'none';
    if (arrowEl) arrowEl.textContent = '▶';
  }
};

// Apply theme preference immediately
if (document.body) {
  CareConnectTheme.init();
}

// Check for persistent login & theme initialization on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  CareConnectTheme.init();
  SafeReach.autoRedirectIfLoggedIn();
});
