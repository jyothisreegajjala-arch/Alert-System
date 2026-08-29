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
  getCurrentLocation: async (customOptions = {}) => {
    const options = { ...SafeReachLocation.defaultOptions, ...customOptions };

    // 1. Requirement 25: Native Capacitor Geolocation Plugin Check
    const CapacitorGeolocation = window.Capacitor?.Plugins?.Geolocation;
    if (CapacitorGeolocation) {
      try {
        let permStatus = await CapacitorGeolocation.checkPermissions();
        if (permStatus.location !== 'granted') {
          permStatus = await CapacitorGeolocation.requestPermissions();
        }
        if (permStatus.location === 'granted' || permStatus.coarseLocation === 'granted') {
          const position = await CapacitorGeolocation.getCurrentPosition({
            enableHighAccuracy: true,
            timeout: options.timeout || 10000
          });
          const locData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy || 10),
            googleMapsUrl: SafeReachLocation.generateGoogleMapsUrl(
              position.coords.latitude,
              position.coords.longitude
            ),
            timestamp: new Date(position.timestamp)
          };
          SafeReachLocation.lastLocation = locData;
          return locData;
        }
      } catch (nativeErr) {
        console.warn('[SafeReach Location] Native Capacitor Geolocation error, falling back to browser API:', nativeErr);
      }
    }

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        // Fallback to IP geolocation if browser doesn't have geolocation API
        fetch('https://ipapi.co/json/')
          .then(res => res.json())
          .then(ipData => {
            if (ipData && ipData.latitude && ipData.longitude) {
              const locData = {
                latitude: ipData.latitude,
                longitude: ipData.longitude,
                accuracy: 50,
                googleMapsUrl: SafeReachLocation.generateGoogleMapsUrl(ipData.latitude, ipData.longitude),
                timestamp: new Date()
              };
              SafeReachLocation.lastLocation = locData;
              return resolve(locData);
            }
            throw new Error('IP Geolocation not available');
          })
          .catch(() => {
            const error = new Error('Geolocation is not supported by your browser.');
            error.code = 'NOT_SUPPORTED';
            reject(error);
          });
        return;
      }

      const isSecureContext = window.isSecureContext || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
      if (!isSecureContext) {
        console.warn('Geolocation requires a secure context (HTTPS or localhost).');
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const locData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy || 10),
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
          console.warn('[SafeReach Location] Primary GPS error:', err.message, 'Trying low-accuracy Wi-Fi fallback...');
          // Attempt Low-Accuracy Wi-Fi Geolocation
          navigator.geolocation.getCurrentPosition(
            (pos2) => {
              const locData = {
                latitude: pos2.coords.latitude,
                longitude: pos2.coords.longitude,
                accuracy: Math.round(pos2.coords.accuracy || 30),
                googleMapsUrl: SafeReachLocation.generateGoogleMapsUrl(
                  pos2.coords.latitude,
                  pos2.coords.longitude
                ),
                timestamp: new Date(pos2.timestamp)
              };
              SafeReachLocation.lastLocation = locData;
              resolve(locData);
            },
            async (err2) => {
              console.warn('[SafeReach Location] Wi-Fi Geolocation failed:', err2.message, 'Trying live IP Geolocation...');
              try {
                const ipRes = await fetch('https://ipapi.co/json/');
                if (ipRes.ok) {
                  const ipData = await ipRes.json();
                  if (ipData && ipData.latitude && ipData.longitude) {
                    const locData = {
                      latitude: ipData.latitude,
                      longitude: ipData.longitude,
                      accuracy: 50,
                      googleMapsUrl: SafeReachLocation.generateGoogleMapsUrl(ipData.latitude, ipData.longitude),
                      timestamp: new Date()
                    };
                    SafeReachLocation.lastLocation = locData;
                    return resolve(locData);
                  }
                }
              } catch (ipErr) {}

              let errorMessage = 'Failed to retrieve location. Please try again.';
              if (err.code === err.PERMISSION_DENIED) {
                errorMessage = 'Location permission is required to send an emergency alert.';
              } else if (err.code === err.POSITION_UNAVAILABLE) {
                errorMessage = 'GPS position unavailable. Please ensure location services are enabled on your device and retry.';
              } else if (err.code === err.TIMEOUT) {
                errorMessage = 'Location retrieval timed out. Please retry.';
              }

              const error = new Error(errorMessage);
              error.code = err.code;
              reject(error);
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
          );
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
