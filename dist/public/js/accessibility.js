/* CareConnect - Accessibility Mode Controller */

const CareConnectAccessibility = {
  isEnabled: () => localStorage.getItem('careconnect_accessibility') === 'true',

  toggle: () => {
    const currentState = CareConnectAccessibility.isEnabled();
    const newState = !currentState;
    localStorage.setItem('careconnect_accessibility', newState ? 'true' : 'false');
    CareConnectAccessibility.applyState();
  },

  applyState: () => {
    const enabled = CareConnectAccessibility.isEnabled();
    if (enabled) {
      document.body.classList.add('accessibility-mode');
    } else {
      document.body.classList.remove('accessibility-mode');
    }

    const btn = document.getElementById('btn-toggle-accessibility');
    if (btn) {
      btn.innerHTML = enabled ? '👁️ High Contrast: ON' : '👁️ Accessibility';
      btn.className = enabled ? 'btn btn-warning btn-sm' : 'btn btn-outline-secondary btn-sm';
    }
  },

  // Haptic feedback trigger (Requirement 10)
  triggerHaptic: (pattern = [100, 50, 100]) => {
    if (navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  },

  // Attach haptic feedback to all touch interactions
  initHapticEvents: () => {
    document.addEventListener('click', (e) => {
      if (e.target.closest('button, .btn, a, select')) {
        CareConnectAccessibility.triggerHaptic([50]);
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  CareConnectAccessibility.applyState();
  CareConnectAccessibility.initHapticEvents();
});

window.CareConnectAccessibility = CareConnectAccessibility;
