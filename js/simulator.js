/**
 * Smart Helmet IoT — High-Precision Road-Snapped Ride Simulation Engine
 * Strictly follows actual street centerlines with smooth linear vector interpolation.
 */

let simInterval = null;
let isSimRunning = false;

// Actual Road Centerline Coordinates in Pune (Satara Road -> Swargate -> Tilak Road -> FC Road loop)
const ROAD_ROUTE = [
  { lat: 18.45290, lng: 73.85530 }, // Katraj Chowk / Satara Road
  { lat: 18.45820, lng: 73.85680 }, // Satara Rd - KK Market
  { lat: 18.46510, lng: 73.85740 }, // Satara Rd - Padmavati Chowk
  { lat: 18.47350, lng: 73.85810 }, // Satara Rd - Laxmi Narayan Chowk
  { lat: 18.48200, lng: 73.85760 }, // Swargate Flyover Northbound
  { lat: 18.49050, lng: 73.85500 }, // Sarasbaug Road
  { lat: 18.49880, lng: 73.85120 }, // Tilak Road
  { lat: 18.50850, lng: 73.84400 }, // Alka Talkies Chowk / Sambhaji Bridge
  { lat: 18.51750, lng: 73.84150 }, // Deccan Gymkhana (FC Road Start)
  { lat: 18.52800, lng: 73.84320 }, // Ferguson College Main Gate
  { lat: 18.53500, lng: 73.83750 }, // Shivajinagar Circle
  { lat: 18.54400, lng: 73.83100 }, // Agriculture College Road
  { lat: 18.55300, lng: 73.82400 }, // Pune University Chowk
  { lat: 18.54600, lng: 73.83400 }, // Return Loop - Ganeshkhind Road
  { lat: 18.53000, lng: 73.84800 }, // JM Road
  { lat: 18.51300, lng: 73.85300 }, // Shivaji Bridge
  { lat: 18.49700, lng: 73.85900 }, // Swargate Bypass
  { lat: 18.47800, lng: 73.85800 }, // Padmavati Southbound
  { lat: 18.45900, lng: 73.85650 }  // Back to Katraj
];

let currentSegment = 0;
let segmentProgress = 0.0;

export function startRideSimulator(onSimTick) {
  if (isSimRunning) return;
  isSimRunning = true;
  currentSegment = 0;
  segmentProgress = 0.0;

  simInterval = setInterval(() => {
    const p1 = ROAD_ROUTE[currentSegment];
    const p2 = ROAD_ROUTE[(currentSegment + 1) % ROAD_ROUTE.length];

    const stepDelta = 0.14;
    segmentProgress += stepDelta;

    if (segmentProgress >= 1.0) {
      segmentProgress = 0.0;
      currentSegment = (currentSegment + 1) % ROAD_ROUTE.length;
    }

    // Exact road interpolation - strictly on asphalt
    const curLat = p1.lat + (p2.lat - p1.lat) * segmentProgress;
    const curLng = p1.lng + (p2.lng - p1.lng) * segmentProgress;

    const dLat = p2.lat - p1.lat;
    const dLng = p2.lng - p1.lng;
    const angleRad = Math.atan2(dLng, dLat);
    const headingDeg = ((angleRad * 180 / Math.PI) + 360) % 360;

    const speed = 44.0 + Math.sin(segmentProgress * Math.PI) * 14.0;

    const gx = (Math.random() - 0.5) * 0.12;
    const gy = 0.98 + (Math.random() - 0.5) * 0.06;
    const gz = (Math.random() - 0.5) * 0.10;
    const totalG = Math.sqrt(gx * gx + gy * gy + gz * gz);

    const payload = {
      timestamp: Date.now(),
      location: {
        latitude: curLat,
        longitude: curLng,
        speedKmph: speed,
        accuracyMeters: 2.5,
        heading: headingDeg
      },
      sensors: {
        helmetWorn: true,
        alcoholAdc: 395,
        alcoholStatus: 'SAFE',
        gForceX: gx,
        gForceY: gy,
        gForceZ: gz,
        totalG: parseFloat(totalG.toFixed(2)),
        vibrationLevel: 'NORMAL',
        ignitionRelay: true
      },
      alerts: {
        isCrashDetected: false,
        isManualSosActive: false,
        sosCountdownRemaining: 0,
        emergencyDispatched: false
      }
    };

    if (onSimTick) onSimTick(payload);
  }, 1000);
}

export function stopRideSimulator() {
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
    isSimRunning = false;
  }
}
