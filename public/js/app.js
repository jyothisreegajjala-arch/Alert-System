/* SafeReach - Core Frontend Utilities & API Manager */

const SafeReach = {
  // Store authentication token
  getToken: () => localStorage.getItem('safereach_token'),
  setToken: (token) => localStorage.setItem('safereach_token', token),
  clearAuth: () => {
    localStorage.removeItem('safereach_token');
    localStorage.removeItem('safereach_user');
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
  }
};

// Check for persistent login automatically on script load
document.addEventListener('DOMContentLoaded', () => {
  SafeReach.autoRedirectIfLoggedIn();
});
