/* SafeReach - FCM Push Notification & Android Channel Controller */

const SafeReachFCM = {
  isInitialized: false,

  init: async () => {
    if (SafeReachFCM.isInitialized) return;
    
    const PushNotifications = window.Capacitor?.Plugins?.PushNotifications;
    if (!PushNotifications) {
      console.log('[SafeReach FCM] PushNotifications plugin not available in browser environment.');
      return;
    }

    try {
      SafeReachFCM.isInitialized = true;

      // 1. Requirement 21: Create Android Notification Channel
      if (window.Capacitor?.getPlatform() === 'android') {
        try {
          await PushNotifications.createChannel({
            id: 'safereach_emergency_channel',
            name: 'SafeReach Emergency Alerts',
            description: 'High priority community emergency notifications for senior citizen SOS alerts',
            importance: 5, // IMPORTANCE_HIGH
            visibility: 1, // VISIBILITY_PUBLIC
            sound: 'default',
            vibration: true
          });
          console.log('[SafeReach FCM] Android notification channel initialized.');
        } catch (chanErr) {
          console.warn('[SafeReach FCM] Channel creation warning:', chanErr);
        }
      }

      // 2. Requirement 20: Request Notification Permission
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive !== 'granted') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive === 'granted') {
        await PushNotifications.register();
      } else {
        console.warn('[SafeReach FCM] Push notification permission denied by user.');
        if (window.SafeReach?.showToast) {
          SafeReach.showToast('Notification permission disabled. Enable in Settings for emergency alerts.', 'warning');
        }
      }

      // 3. Handle FCM Token Registration Success
      PushNotifications.addListener('registration', async (token) => {
        console.log('[SafeReach FCM] Device Token received:', token.value);
        localStorage.setItem('safereach_fcm_token', token.value);

        const user = window.SafeReach ? SafeReach.getUser() : null;
        if (user && window.SafeReach?.getToken()) {
          try {
            await SafeReach.api('/api/notifications/fcm-token', {
              method: 'POST',
              body: JSON.stringify({ token: token.value, platform: 'android' })
            });
            console.log('[SafeReach FCM] Token registered with backend server successfully.');
          } catch (apiErr) {
            console.error('[SafeReach FCM] Failed to send FCM token to backend:', apiErr);
          }
        }
      });

      // Handle FCM Token Registration Error
      PushNotifications.addListener('registrationError', (error) => {
        console.error('[SafeReach FCM] Token registration error:', error);
      });

      // 4. Requirement 19: Foreground Notification Received
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[SafeReach FCM] Notification received in foreground:', notification);
        const title = notification.title || '🚨 SafeReach Emergency Alert';
        const body = notification.body || 'Immediate assistance may be required.';

        if (window.SafeReach?.showToast) {
          SafeReach.showToast(`<b>${title}</b><br>${body}`, 'danger');
        }
      });

      // 5. Requirement 39 & 40: Notification Tap / Deep Link Action Routing
      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[SafeReach FCM] Notification tapped:', notification);
        const data = notification.notification?.data || {};
        const emergencyId = data.emergencyId || data.alertId;

        const path = window.location.pathname;
        const targetPage = path.includes('.html') ? 'dashboard.html' : '/dashboard';

        if (emergencyId) {
          localStorage.setItem('safereach_pending_emergency_id', emergencyId);
        }

        if (!path.includes('dashboard')) {
          window.location.href = `${targetPage}#emergency-${emergencyId || 'active'}`;
        } else if (typeof window.loadActiveEmergencies === 'function') {
          window.loadActiveEmergencies();
        }
      });

    } catch (err) {
      console.error('[SafeReach FCM Initialization Error]:', err);
    }
  }
};

window.SafeReachFCM = SafeReachFCM;

// Initialize FCM when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  if (window.SafeReach?.getToken()) {
    SafeReachFCM.init();
  }
});
