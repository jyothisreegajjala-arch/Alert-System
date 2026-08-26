/* SafeReach - Leaflet & Google Maps Navigation Wrapper */

const SafeReachMap = {
  instance: null,
  markers: [],

  init: (containerId, lat = 12.9716, lng = 77.5946, zoom = 15) => {
    const container = document.getElementById(containerId);
    if (!container) return null;

    if (SafeReachMap.instance) {
      SafeReachMap.instance.remove();
      SafeReachMap.instance = null;
    }

    if (window.L) {
      SafeReachMap.instance = L.map(containerId).setView([lat, lng], zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; SafeReach Emergency Network',
        maxZoom: 19
      }).addTo(SafeReachMap.instance);
    }
    return SafeReachMap.instance;
  },

  addMarker: (lat, lng, title, popupContent, iconType = 'red') => {
    if (!SafeReachMap.instance || !window.L) return;

    let markerColor = '#ff3b30'; // red for victim
    if (iconType === 'blue') markerColor = '#007aff';
    if (iconType === 'green') markerColor = '#34c759';

    const customIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `<div style="background-color:${markerColor}; width:20px; height:20px; border-radius:50%; border:3px solid white; box-shadow:0 0 10px ${markerColor};"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const marker = L.marker([lat, lng], { icon: customIcon, title }).addTo(SafeReachMap.instance);
    if (popupContent) {
      marker.bindPopup(popupContent);
    }
    SafeReachMap.markers.push(marker);
    return marker;
  },

  getGoogleMapsUrl: (lat, lng) => {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }
};

window.SafeReachMap = SafeReachMap;
