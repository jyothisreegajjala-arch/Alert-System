/* SafeReach - Core Frontend Utilities & API Manager */

const SafeReach = {
  // Configurable API Base URL for Capacitor Android App & Production Web
  getBaseUrl: () => {
    if (window.SAFEREACH_API_URL) return window.SAFEREACH_API_URL;
    const isCapacitorNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    const isFileProtocol = window.location.protocol === 'file:';
    if (isCapacitorNative || isFileProtocol) {
      return 'https://safereach-alert-system.vercel.app';
    }
    return '';
  },

  getSocketUrl: () => {
    const base = SafeReach.getBaseUrl();
    return base || window.location.origin;
  },

  // Token & User Persistence Engine (Capacitor Preferences + LocalStorage fallback)
  getToken: () => localStorage.getItem('safereach_token'),
  setToken: (token) => {
    localStorage.setItem('safereach_token', token);
    if (window.Capacitor?.Plugins?.Preferences) {
      window.Capacitor.Plugins.Preferences.set({ key: 'safereach_token', value: token });
    }
  },
  getUser: () => {
    const u = localStorage.getItem('safereach_user');
    return u ? JSON.parse(u) : null;
  },
  setUser: (user) => {
    localStorage.setItem('safereach_user', JSON.stringify(user));
    if (window.Capacitor?.Plugins?.Preferences) {
      window.Capacitor.Plugins.Preferences.set({ key: 'safereach_user', value: JSON.stringify(user) });
    }
  },
  clearAuth: () => {
    localStorage.removeItem('safereach_token');
    localStorage.removeItem('safereach_user');
    if (window.Capacitor?.Plugins?.Preferences) {
      window.Capacitor.Plugins.Preferences.remove({ key: 'safereach_token' });
      window.Capacitor.Plugins.Preferences.remove({ key: 'safereach_user' });
    }
  },

  // Sync Preferences from native storage on mobile startup
  syncNativeStorage: async () => {
    if (window.Capacitor?.Plugins?.Preferences) {
      try {
        const tokenRes = await window.Capacitor.Plugins.Preferences.get({ key: 'safereach_token' });
        const userRes = await window.Capacitor.Plugins.Preferences.get({ key: 'safereach_user' });
        if (tokenRes?.value) localStorage.setItem('safereach_token', tokenRes.value);
        if (userRes?.value) localStorage.setItem('safereach_user', userRes.value);
      } catch (e) {
        console.warn('[SafeReach Storage] Native preferences sync error:', e);
      }
    }
  },

  // Logout & Deactivate FCM Token
  logout: async () => {
    try {
      const fcmToken = localStorage.getItem('safereach_fcm_token');
      if (fcmToken) {
        await SafeReach.api('/api/notifications/fcm-token', {
          method: 'DELETE',
          body: JSON.stringify({ token: fcmToken })
        }).catch(() => {});
      }
    } catch (err) {}

    SafeReach.clearAuth();
    if (window.socket && typeof window.socket.disconnect === 'function') {
      window.socket.disconnect();
    }

    if (typeof SafeReach.showToast === 'function') {
      SafeReach.showToast('Signed out successfully.', 'info');
    }

    setTimeout(() => {
      const path = window.location.pathname;
      if (path.endsWith('login.html') || path.includes('/login')) {
        window.location.reload();
      } else {
        window.location.href = window.location.href.includes('.html') ? 'login.html' : '/login';
      }
    }, 200);
  },

  // Persistent Session Validator & Auto-Redirect Engine
  checkPersistentSession: async () => {
    await SafeReach.syncNativeStorage();
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

  // Mobile & Webview Safe Route Navigation Engine
  navigate: (targetRoute) => {
    const isCapacitorNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
    const isLocalHost = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    if (isCapacitorNative || isLocalHost) {
      if (targetRoute.startsWith('/login/')) {
        window.location.href = 'login.html';
        return;
      }
      const pageMap = {
        '/': 'index.html',
        '/login': 'login.html',
        '/register': 'register.html',
        '/dashboard': 'dashboard.html',
        '/admin': 'admin.html',
        '/language': 'language.html'
      };
      const dest = pageMap[targetRoute] || (targetRoute.endsWith('.html') ? targetRoute.replace(/^\//, '') : `${targetRoute.replace(/^\//, '')}.html`);
      window.location.href = dest || 'index.html';
    } else {
      window.location.href = targetRoute;
    }
  },

  autoRedirectIfLoggedIn: async () => {
    const path = window.location.pathname;
    const isLoginPage = path === '/login' || path.endsWith('/login.html') || path === '/' || path.endsWith('/index.html');
    if (!isLoginPage) return;

    await SafeReach.syncNativeStorage();
    const token = SafeReach.getToken();
    if (!token) return;

    // Show persistent session validation splash if element exists
    const splashEl = document.getElementById('session-bootstrap-splash');
    if (splashEl) splashEl.style.display = 'flex';

    const user = await SafeReach.checkPersistentSession();
    if (user) {
      const target = user.role === 'admin' ? '/admin' : '/dashboard';
      SafeReach.navigate(target);
    } else if (splashEl) {
      splashEl.style.display = 'none';
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

  // Authorized API Fetch wrapper with Base URL prepend
  api: async (endpoint, options = {}) => {
    const token = SafeReach.getToken();
    const baseUrl = SafeReach.getBaseUrl();
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    try {
      const response = await fetch(fullUrl, { ...options, headers });
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          SafeReach.clearAuth();
          const path = window.location.pathname;
          if (!path.includes('/login') && !path.includes('/register') && path !== '/' && !path.endsWith('index.html')) {
            window.location.href = path.includes('.html') ? 'login.html' : '/login';
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

    const ts = typeof item === 'object' ? (item.createdAt || item.timestamp || item.updatedAt) : null;
    if (ts) {
      const d = new Date(ts);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
      }
    }

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

    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' });
  },

  // Format Date in IST (Asia/Kolkata, UTC+5:30)
  formatDate: (item) => {
    if (!item) return '';

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

/* CareConnect Theme Controller */
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
    if (document.body) {
      if (isLight) {
        document.body.classList.add('light-theme');
      } else {
        document.body.classList.remove('light-theme');
      }
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

window.SafeReach = SafeReach;
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
document.addEventListener('DOMContentLoaded', async () => {
  CareConnectTheme.init();
  await SafeReach.autoRedirectIfLoggedIn();
});

// Global Link Navigation Interceptor for Native App & Local File Protocols
document.addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  const href = a.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('tel:') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;

  const isCapacitorNative = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
  const isLocalHost = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (isCapacitorNative || isLocalHost) {
    e.preventDefault();
    SafeReach.navigate(href);
  }
});
