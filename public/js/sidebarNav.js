/* CareConnect - Unified Sidebar Navigation & Tab Switching System */

const CareConnectNav = (() => {
  let activeTabId = 'tab-dashboard';

  function init() {
    // 1. Check URL hash for initial tab selection
    const hash = window.location.hash ? window.location.hash.replace('#', '') : '';
    if (hash) {
      const targetTab = 'tab-' + hash;
      if (document.getElementById(targetTab)) {
        activeTabId = targetTab;
      }
    }

    switchTab(activeTabId, false);

    // 2. Hashchange listener
    window.addEventListener('hashchange', () => {
      const newHash = window.location.hash.replace('#', '');
      if (newHash && document.getElementById('tab-' + newHash)) {
        switchTab('tab-' + newHash, false);
      }
    });

    // 3. Mobile backdrop setup
    const backdrop = document.getElementById('sidebar-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', closeMobileSidebar);
    }
  }

  function switchTab(tabId, updateHash = true) {
    const targetPanel = document.getElementById(tabId);
    if (!targetPanel) return;

    activeTabId = tabId;

    // Hide all tab panels
    const panels = document.querySelectorAll('.dashboard-tab-panel');
    panels.forEach(panel => {
      panel.classList.remove('active');
      panel.style.display = 'none';
    });

    // Show target panel
    targetPanel.classList.add('active');
    targetPanel.style.display = 'block';

    // Update active class on sidebar links
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach(item => {
      if (item.getAttribute('data-tab') === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update URL hash without scroll jumps
    if (updateHash) {
      const cleanName = tabId.replace('tab-', '');
      history.replaceState(null, '', '#' + cleanName);
    }

    // Trigger Leaflet map resize if map tab is active
    if (tabId === 'tab-gps' || tabId === 'tab-alerts') {
      setTimeout(() => {
        if (window.SafeReachMap && window.SafeReachMap.invalidateMapSize) {
          window.SafeReachMap.invalidateMapSize();
        }
      }, 150);
    }

    // Close mobile drawer if open
    closeMobileSidebar();
  }

  function toggleMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) {
      sidebar.classList.toggle('open');
    }
    if (backdrop) {
      backdrop.classList.toggle('active');
    }
  }

  function closeMobileSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) {
      sidebar.classList.remove('open');
    }
    if (backdrop) {
      backdrop.classList.remove('active');
    }
  }

  return {
    init,
    switchTab,
    toggleMobileSidebar,
    closeMobileSidebar
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  CareConnectNav.init();
});
