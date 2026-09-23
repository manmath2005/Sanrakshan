/**
 * Smart Helmet IoT — High-Reliability Dual-Engine GPS Tracker
 * Supports:
 * 1. Google Maps JavaScript API (Official Hybrid Satellite, Styled Dark, Roadmap, Terrain, Traffic)
 * 2. Ultra-Reliable Leaflet Fallback (Esri World HD Satellite, CARTO Dark Matter, OpenStreetMap HD)
 * Features: Rotating Motorcycle Marker, Live Radar Ping, Smooth Trail, Speed/Heading HUD.
 */

export const GOOGLE_MAPS_KEY = "AIzaSyDt1_C36R10m8sa1wmfD4H3xAi1yOCVLN4";

let activeEngine = 'none'; // 'google' | 'leaflet'
let gMapInstance = null;
let lMapInstance = null;

// Google Maps Artifacts
let gMarker = null;
let gAccuracyCircle = null;
let gPathPolyline = null;
let gTrafficLayer = null;
let isTrafficVisible = false;

// Leaflet Artifacts
let lMarker = null;
let lAccuracyCircle = null;
let lPathPolyline = null;
let lTileLayer = null;

let pathCoordinates = [];
let isAutoFollow = true;
let currentBasemap = 'satellite';
let lastLat = 18.4529;
let lastLng = 73.8553;

// High-Tech Dark Style for Google Maps
const GOOGLE_DARK_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0b0f19" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0f19" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#00e5ff" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#94a3b8" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#0f172a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#0f172a" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#cbd5e1" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#2563eb" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1e3a8a" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#1e293b" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#020617" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#38bdf8" }] }
];

// Leaflet Tile Layers Providers (No Watermark, Fast CDN)
const LEAFLET_PROVIDERS = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: { maxZoom: 19, attribution: 'Esri World Satellite Imagery HD' }
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    options: { maxZoom: 19, subdomains: 'abcd', attribution: 'CARTO Dark Matter' }
  },
  roadmap: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 19, attribution: 'OpenStreetMap' }
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 17, attribution: 'OpenTopoMap' }
  }
};

/**
 * Initialize Map Engine (tries Google Maps, falls back to Leaflet automatically)
 */
export function initMap(containerId = 'map', initialLat = 18.4529, initialLng = 73.8553) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  lastLat = initialLat;
  lastLng = initialLng;

  // Global Auth Failure listener for Google Maps
  window.gm_authFailure = () => {
    console.warn('[MapTracker] Google Maps Auth issue detected. Switching to Leaflet Satellite Engine...');
    initLeafletEngine(container, initialLat, initialLng);
  };

  // 1. Try Google Maps if available and loaded
  if (window.google && window.google.maps && window.google.maps.Map) {
    try {
      initGoogleMapEngine(container, initialLat, initialLng);
      activeEngine = 'google';
      console.log('[MapTracker] Initialized with Google Maps Engine');
      return gMapInstance;
    } catch (e) {
      console.warn('[MapTracker] Google Maps init error, falling back to Leaflet:', e);
    }
  }

  // 2. Fallback to Leaflet OpenStreetMap & Satellite
  initLeafletEngine(container, initialLat, initialLng);
  activeEngine = 'leaflet';
  console.log('[MapTracker] Initialized with Leaflet Satellite Fallback Engine');
  return lMapInstance;
}

function initGoogleMapEngine(container, lat, lng) {
  const centerLatLng = { lat, lng };

  gMapInstance = new google.maps.Map(container, {
    center: centerLatLng,
    zoom: 17,
    mapTypeId: google.maps.MapTypeId.HYBRID,
    disableDefaultUI: true,
    zoomControl: true,
    zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_TOP }
  });

  gTrafficLayer = new google.maps.TrafficLayer();

  // Create Rider Marker using Google Maps Overlay
  createGoogleRiderOverlay(lat, lng);

  // Accuracy Circle
  gAccuracyCircle = new google.maps.Circle({
    strokeColor: '#00e5ff',
    strokeOpacity: 0.8,
    strokeWeight: 1.5,
    fillColor: '#00e5ff',
    fillOpacity: 0.15,
    map: gMapInstance,
    center: centerLatLng,
    radius: 8
  });

  // Polyline
  gPathPolyline = new google.maps.Polyline({
    path: [centerLatLng],
    geodesic: true,
    strokeColor: '#00e5ff',
    strokeOpacity: 0.9,
    strokeWeight: 4,
    map: gMapInstance
  });
}

function createGoogleRiderOverlay(lat, lng) {
  if (!window.google || !window.google.maps) return;

  class BikeOverlay extends google.maps.OverlayView {
    constructor(lat, lng) {
      super();
      this.lat = lat;
      this.lng = lng;
      this.heading = 0;
      this.isEmergency = false;
      this.div = null;
    }
    onAdd() {
      this.div = document.createElement('div');
      this.div.style.position = 'absolute';
      this.div.style.transform = 'translate(-50%, -50%)';
      this.div.style.zIndex = '100';
      this.updateHtml();
      this.getPanes().overlayMouseTarget.appendChild(this.div);
    }
    updateHtml() {
      if (!this.div) return;
      const color = this.isEmergency ? '#ef4444' : '#00e5ff';
      const pingClass = this.isEmergency ? 'radar-ping-emergency' : 'radar-ping';
      this.div.innerHTML = `
        <div class="relative flex items-center justify-center w-12 h-12">
          <div class="${pingClass}"></div>
          <div class="w-8 h-8 rounded-full bg-slate-950 border-2 shadow-2xl flex items-center justify-center z-10 transition-transform duration-300"
               style="border-color: ${color}; transform: rotate(${this.heading}deg); box-shadow: 0 0 16px ${color};">
            <i class="fa-solid fa-motorcycle text-xs" style="color: ${color};"></i>
          </div>
        </div>
      `;
    }
    draw() {
      if (!this.div || !this.getProjection()) return;
      const latLng = new google.maps.LatLng(this.lat, this.lng);
      const point = this.getProjection().fromLatLngToDivPixel(latLng);
      if (point) {
        this.div.style.left = point.x + 'px';
        this.div.style.top = point.y + 'px';
      }
    }
    setPosition(lat, lng, heading, isEmergency) {
      this.lat = lat;
      this.lng = lng;
      this.heading = heading;
      this.isEmergency = isEmergency;
      this.updateHtml();
      this.draw();
    }
  }

  gMarker = new BikeOverlay(lat, lng);
  gMarker.setMap(gMapInstance);
}

function initLeafletEngine(container, lat, lng) {
  if (!window.L) {
    console.error('[MapTracker] Leaflet library not found on page');
    return;
  }

  // Clear existing container content
  container.innerHTML = '';

  lMapInstance = L.map(container, {
    center: [lat, lng],
    zoom: 17,
    zoomControl: true
  });

  // Default Esri World Satellite
  const p = LEAFLET_PROVIDERS.satellite;
  lTileLayer = L.tileLayer(p.url, p.options).addTo(lMapInstance);

  // Custom Leaflet Animated Marker
  const customIcon = L.divIcon({
    className: 'custom-leaflet-rider',
    html: `
      <div class="relative flex items-center justify-center w-12 h-12" id="leaflet-rider-wrapper">
        <div class="radar-ping" id="leaflet-ping"></div>
        <div id="leaflet-rider-circle" class="w-8 h-8 rounded-full bg-slate-950 border-2 border-cyan-400 shadow-2xl flex items-center justify-center z-10"
             style="box-shadow: 0 0 16px #00e5ff;">
          <i class="fa-solid fa-motorcycle text-xs text-cyan-400" id="leaflet-bike-icon"></i>
        </div>
      </div>
    `,
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });

  lMarker = L.marker([lat, lng], { icon: customIcon }).addTo(lMapInstance);

  lAccuracyCircle = L.circle([lat, lng], {
    radius: 8,
    color: '#00e5ff',
    fillColor: '#00e5ff',
    fillOpacity: 0.15,
    weight: 1.5
  }).addTo(lMapInstance);

  lPathPolyline = L.polyline([[lat, lng]], {
    color: '#00e5ff',
    weight: 4,
    opacity: 0.9
  }).addTo(lMapInstance);

  activeEngine = 'leaflet';
}

/**
 * Update Rider GPS Location on whichever Map Engine is active
 */
export function updateRiderLocation(lat, lng, heading = 0, accuracy = 5, speedKmph = 0, isEmergency = false) {
  if (!lat || !lng) return;
  lastLat = lat;
  lastLng = lng;

  const color = isEmergency ? '#ef4444' : '#00e5ff';

  // 1. Update Google Maps Engine
  if (activeEngine === 'google' && gMapInstance) {
    const latLng = new google.maps.LatLng(lat, lng);
    if (gMarker && gMarker.setPosition) {
      gMarker.setPosition(lat, lng, heading, isEmergency);
    }
    if (gAccuracyCircle) {
      gAccuracyCircle.setCenter(latLng);
      gAccuracyCircle.setRadius(accuracy || 5);
      gAccuracyCircle.setOptions({ strokeColor: color, fillColor: color });
    }
    pathCoordinates.push(latLng);
    if (pathCoordinates.length > 300) pathCoordinates.shift();
    if (gPathPolyline) {
      gPathPolyline.setPath(pathCoordinates);
      gPathPolyline.setOptions({ strokeColor: color });
    }
    if (isAutoFollow) {
      gMapInstance.panTo(latLng);
    }
  }

  // 2. Update Leaflet Engine
  if (activeEngine === 'leaflet' && lMapInstance) {
    const lPos = [lat, lng];
    if (lMarker) {
      lMarker.setLatLng(lPos);
      const circleEl = document.getElementById('leaflet-rider-circle');
      const pingEl = document.getElementById('leaflet-ping');
      const iconEl = document.getElementById('leaflet-bike-icon');
      if (circleEl) {
        circleEl.style.transform = `rotate(${heading}deg)`;
        circleEl.style.borderColor = color;
        circleEl.style.boxShadow = `0 0 16px ${color}`;
      }
      if (pingEl) {
        pingEl.className = isEmergency ? 'radar-ping-emergency' : 'radar-ping';
      }
      if (iconEl) {
        iconEl.style.color = color;
      }
    }
    if (lAccuracyCircle) {
      lAccuracyCircle.setLatLng(lPos);
      lAccuracyCircle.setRadius(accuracy || 5);
      lAccuracyCircle.setStyle({ color: color, fillColor: color });
    }
    if (lPathPolyline) {
      lPathPolyline.addLatLng(lPos);
      lPathPolyline.setStyle({ color: color });
    }
    if (isAutoFollow) {
      lMapInstance.panTo(lPos);
    }
  }

  // 3. Update HUD Elements
  const speedEl = document.getElementById('map-speed');
  const headingIcon = document.getElementById('heading-icon');
  const headingText = document.getElementById('map-heading-text');
  const coordsText = document.getElementById('map-coords-text');
  const accuracyText = document.getElementById('map-accuracy-text');

  if (speedEl) speedEl.textContent = Math.round(speedKmph);
  if (headingIcon) headingIcon.style.transform = `rotate(${heading}deg)`;
  if (headingText) headingText.textContent = `Heading (${Math.round(heading)}°)`;
  if (coordsText) coordsText.textContent = `${lat.toFixed(5)}° N, ${lng.toFixed(5)}° E`;
  if (accuracyText) accuracyText.textContent = `GPS Accuracy: ±${(accuracy || 3.5).toFixed(1)}m`;
}

/**
 * Recenter Map on Rider
 */
export function centerOnRider() {
  isAutoFollow = true;
  if (activeEngine === 'google' && gMapInstance) {
    gMapInstance.panTo({ lat: lastLat, lng: lastLng });
    gMapInstance.setZoom(18);
  } else if (activeEngine === 'leaflet' && lMapInstance) {
    lMapInstance.setView([lastLat, lastLng], 18);
  }
}

/**
 * Switch Basemaps (Satellite, Dark, Road, Terrain)
 */
export function switchBasemap(style = 'satellite') {
  currentBasemap = style;

  if (activeEngine === 'google' && gMapInstance) {
    if (style === 'satellite') {
      gMapInstance.setMapTypeId(google.maps.MapTypeId.HYBRID);
      gMapInstance.setOptions({ styles: [] });
    } else if (style === 'dark') {
      gMapInstance.setMapTypeId(google.maps.MapTypeId.ROADMAP);
      gMapInstance.setOptions({ styles: GOOGLE_DARK_STYLE });
    } else if (style === 'roadmap') {
      gMapInstance.setMapTypeId(google.maps.MapTypeId.ROADMAP);
      gMapInstance.setOptions({ styles: [] });
    } else if (style === 'terrain') {
      gMapInstance.setMapTypeId(google.maps.MapTypeId.TERRAIN);
      gMapInstance.setOptions({ styles: [] });
    }
  }

  if (activeEngine === 'leaflet' && lMapInstance) {
    const prov = LEAFLET_PROVIDERS[style] || LEAFLET_PROVIDERS.satellite;
    if (lTileLayer) {
      lMapInstance.removeLayer(lTileLayer);
    }
    lTileLayer = L.tileLayer(prov.url, prov.options).addTo(lMapInstance);
  }
}

/**
 * Toggle Traffic Layer
 */
export function toggleTraffic() {
  if (activeEngine === 'google' && gTrafficLayer && gMapInstance) {
    isTrafficVisible = !isTrafficVisible;
    gTrafficLayer.setMap(isTrafficVisible ? gMapInstance : null);
    return isTrafficVisible;
  }
  return false;
}

/**
 * Toggle Path Polyline Trail
 */
export function toggleTrail() {
  if (activeEngine === 'google' && gPathPolyline) {
    const isVis = gPathPolyline.getMap() !== null;
    gPathPolyline.setMap(isVis ? null : gMapInstance);
    return !isVis;
  }
  if (activeEngine === 'leaflet' && lPathPolyline) {
    const hasLayer = lMapInstance.hasLayer(lPathPolyline);
    if (hasLayer) {
      lMapInstance.removeLayer(lPathPolyline);
      return false;
    } else {
      lPathPolyline.addTo(lMapInstance);
      return true;
    }
  }
  return true;
}
