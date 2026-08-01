/* SafeReach - HTML5 Geolocation API Manager */

const SafeReachLocation = {
  // Requirement 3: enableHighAccuracy: true, timeout: 10000, maximumAge: 0
  defaultOptions: {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0
  },

  lastLocation: null,

  // Requirement 7: Generate a Google Maps URL in format https://www.google.com/maps?q=latitude,longitude
  generateGoogleMapsUrl: (latitude, longitude) => {
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  },

  // Requirement 1 & 11: Get fresh location using HTML5 Geolocation API
  getCurrentLocation: (customOptions = {}) => {
    return new Promise((resolve, reject) => {
      // Requirement 14: Check HTTPS / Localhost context
      if (!navigator.geolocation) {
        const error = new Error('Geolocation is not supported by your browser.');
        error.code = 'NOT_SUPPORTED';
        return reject(error);
      }

      const isSecureContext = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      if (!isSecureContext) {
        console.warn('Geolocation requires a secure context (HTTPS or localhost).');
      }

      const options = { ...SafeReachLocation.defaultOptions, ...customOptions };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy),
            googleMapsUrl: SafeReachLocation.generateGoogleMapsUrl(
              position.coords.latitude,
              position.coords.longitude
            ),
            timestamp: new Date(position.timestamp)
          };
          SafeReachLocation.lastLocation = locData;
          resolve(locData);
        },
        (err) => {
          let errorMessage = 'Failed to retrieve location. Please try again.';
          
          // Requirement 9: Permission denied exact message
          if (err.code === err.PERMISSION_DENIED) {
            errorMessage = 'Location permission is required to send an emergency alert.';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            // Requirement 10: GPS unavailable error
            errorMessage = 'GPS position unavailable. Please ensure location services are enabled on your device and retry.';
          } else if (err.code === err.TIMEOUT) {
            // Requirement 10: Location timeout
            errorMessage = 'Location retrieval timed out. Please retry.';
          }

          const error = new Error(errorMessage);
          error.code = err.code;
          reject(error);
        },
        options
      );
    });
  },

  // Requirement 2: Request location permission on load or trigger
  requestPermissionOnLoad: async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        if (result.state === 'granted' || result.state === 'prompt') {
          // Attempt silent quick load to prime location cache
          SafeReachLocation.getCurrentLocation().catch(() => {});
        }
      } else {
        SafeReachLocation.getCurrentLocation().catch(() => {});
      }
    } catch (e) {
      // Fallback
      SafeReachLocation.getCurrentLocation().catch(() => {});
    }
  },

  // Requirement 12: Helper to handle "Get Current Location" action and update UI widget
  refreshLocationWidget: async () => {
    const outputContainer = document.getElementById('location-info-display');
    const statusEl = document.getElementById('location-status-text');
    const btn = document.getElementById('btn-get-location');

    if (btn) btn.disabled = true;
    if (statusEl) {
      statusEl.textContent = '📡 Requesting high-accuracy GPS location...';
      statusEl.className = 'location-status status-loading';
    }

    try {
      const loc = await SafeReachLocation.getCurrentLocation();

      if (outputContainer) {
        outputContainer.classList.remove('d-none');
        outputContainer.innerHTML = `
          <div class="location-card glass-card-sm">
            <div class="location-card-header">
              <span class="location-badge">📍 GPS Location Active</span>
              <span class="accuracy-pill">Accuracy: ±${loc.accuracy}m</span>
            </div>
            <div class="location-grid">
              <div class="location-item">
                <span class="location-label">Latitude</span>
                <span class="location-value">${loc.latitude.toFixed(6)}</span>
              </div>
              <div class="location-item">
                <span class="location-label">Longitude</span>
                <span class="location-value">${loc.longitude.toFixed(6)}</span>
              </div>
            </div>
            <div id="location-widget-map" style="height: 220px; width: 100%; border-radius: 8px; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.15);"></div>
            <div class="location-actions">
              <a href="${loc.googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
                🗺️ Open in Google Maps
              </a>
              <button type="button" onclick="SafeReachLocation.refreshLocationWidget()" class="btn btn-secondary btn-sm">
                🔄 Refresh Location
              </button>
            </div>
          </div>
        `;

        if (window.SafeReachMap && window.L) {
          setTimeout(() => {
            SafeReachMap.init('location-widget-map', loc.latitude, loc.longitude, 16);
            SafeReachMap.addMarker(
              loc.latitude,
              loc.longitude,
              'Your Live Location',
              `<b>Your Current Location</b><br>Lat: ${loc.latitude.toFixed(6)}<br>Lng: ${loc.longitude.toFixed(6)}<br>Accuracy: ±${loc.accuracy}m`,
              'blue'
            );
          }, 100);
        }
      }

      if (statusEl) {
        statusEl.textContent = `✅ Location updated (Accuracy: ±${loc.accuracy}m)`;
        statusEl.className = 'location-status status-success';
      }
      return loc;
    } catch (err) {
      if (statusEl) {
        // Requirement 9 & 10 error display
        statusEl.textContent = `❌ ${err.message}`;
        statusEl.className = 'location-status status-error';
      }

      if (outputContainer) {
        outputContainer.classList.remove('d-none');
        
        const isPermissionDenied = err.code === 1; // PERMISSION_DENIED
        const instructionHelp = isPermissionDenied ? `
          <div style="font-size:0.85rem; color:#cbd5e1; margin-bottom:0.75rem; background:rgba(0,0,0,0.25); padding:0.6rem; border-radius:6px;">
            <strong>💡 How to allow location access in your browser:</strong><br>
            1. Click the Tune / Padlock icon 🔒 near the address bar (left of <code>http://localhost:3000</code>).<br>
            2. Change <strong>Location</strong> setting from <em>Block</em> to <em>Allow</em>.<br>
            3. Click <strong>Retry Location Retrieval</strong> below.
          </div>
        ` : '';

        outputContainer.innerHTML = `
          <div class="location-error-card">
            <p class="error-msg">⚠️ ${err.message}</p>
            ${instructionHelp}
            <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
              <button type="button" onclick="SafeReachLocation.refreshLocationWidget()" class="btn btn-warning btn-sm">
                🔄 Retry Location Retrieval
              </button>
              <button type="button" onclick="SafeReachLocation.useFallbackProfileLocation()" class="btn btn-secondary btn-sm">
                📍 Use Registered Address Location
              </button>
            </div>
          </div>
        `;
      }
      throw err;
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  // Fallback to user registered profile coordinates if GPS permission blocked
  useFallbackProfileLocation: () => {
    const outputContainer = document.getElementById('location-info-display');
    const statusEl = document.getElementById('location-status-text');
    const user = window.SafeReach ? window.SafeReach.getUser() : null;

    const lat = (user && user.latitude) ? Number(user.latitude) : 12.9716;
    const lng = (user && user.longitude) ? Number(user.longitude) : 77.5946;
    const googleMapsUrl = SafeReachLocation.generateGoogleMapsUrl(lat, lng);

    const loc = {
      latitude: lat,
      longitude: lng,
      accuracy: 50,
      googleMapsUrl: googleMapsUrl,
      isFallback: true
    };

    SafeReachLocation.lastLocation = loc;

    if (outputContainer) {
      outputContainer.classList.remove('d-none');
      outputContainer.innerHTML = `
        <div class="location-card glass-card-sm">
          <div class="location-card-header">
            <span class="location-badge" style="color:#facc15;">📍 Registered Profile Location (Default)</span>
            <span class="accuracy-pill">Community Address</span>
          </div>
          <div class="location-grid">
            <div class="location-item">
              <span class="location-label">Latitude</span>
              <span class="location-value">${lat.toFixed(6)}</span>
            </div>
            <div class="location-item">
              <span class="location-label">Longitude</span>
              <span class="location-value">${lng.toFixed(6)}</span>
            </div>
          </div>
          <div id="location-widget-map" style="height: 220px; width: 100%; border-radius: 8px; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.15);"></div>
          <div class="location-actions">
            <a href="${googleMapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">
              🗺️ Open in Google Maps
            </a>
            <button type="button" onclick="SafeReachLocation.refreshLocationWidget()" class="btn btn-secondary btn-sm">
              🔄 Try GPS Again
            </button>
          </div>
        </div>
      `;

      if (window.SafeReachMap && window.L) {
        setTimeout(() => {
          SafeReachMap.init('location-widget-map', lat, lng, 16);
          SafeReachMap.addMarker(
            lat,
            lng,
            'Registered Profile Location',
            `<b>Registered Address Location</b><br>Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`,
            'blue'
          );
        }, 100);
      }
    }

    if (statusEl) {
      statusEl.textContent = 'ℹ️ Using registered profile address location for alerts.';
      statusEl.className = 'location-status status-loading';
    }

    return loc;
  }
};

window.SafeReachLocation = SafeReachLocation;
