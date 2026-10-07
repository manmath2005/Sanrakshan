/**
 * Smart Helmet IoT — High-Precision Realistic Motorcycle Ride Simulation Engine
 * True distance-based physics (~38-46 km/h, ~11.5 m/s) along Pune arterial road centerlines.
 */

let simInterval = null;
let isSimRunning = false;

// High-Precision Real Pune Arterial Road Centerline Waypoints
const ROAD_ROUTE = [
  { lat: 18.45290, lng: 73.85530 }, // Katraj Chowk / Satara Road
  { lat: 18.45550, lng: 73.85610 }, // Mohan Nagar
  { lat: 18.45820, lng: 73.85680 }, // KK Market
  { lat: 18.46150, lng: 73.85710 }, // Balaji Nagar
  { lat: 18.46510, lng: 73.85740 }, // Padmavati Chowk
  { lat: 18.46950, lng: 73.85780 }, // Bibvewadi Corner
  { lat: 18.47350, lng: 73.85810 }, // Laxmi Narayan Chowk
  { lat: 18.47800, lng: 73.85790 }, // Swargate South Ramp
  { lat: 18.48200, lng: 73.85760 }, // Swargate Flyover
  { lat: 18.48600, lng: 73.85650 }, // Jedhe Chowk
  { lat: 18.49050, lng: 73.85500 }, // Sarasbaug Road
  { lat: 18.49450, lng: 73.85320 }, // Hirabaug
  { lat: 18.49880, lng: 73.85120 }, // Tilak Road / SP College
  { lat: 18.50350, lng: 73.84750 }, // Abhinav Kala Mahavidyalaya
  { lat: 18.50850, lng: 73.84400 }, // Alka Talkies / Sambhaji Bridge
  { lat: 18.51300, lng: 73.84250 }, // Deccan Corner
  { lat: 18.51750, lng: 73.84150 }, // Deccan Gymkhana
  { lat: 18.52250, lng: 73.84220 }, // Goodluck Chowk
  { lat: 18.52800, lng: 73.84320 }, // FC Road Main Gate
  { lat: 18.53200, lng: 73.84100 }, // FC Road North
  { lat: 18.53500, lng: 73.83750 }, // Shivajinagar Circle
  { lat: 18.53950, lng: 73.83400 }, // COEP Corner
  { lat: 18.54400, lng: 73.83100 }, // Agriculture College Road
  { lat: 18.54900, lng: 73.82750 }, // Range Hills Corner
  { lat: 18.55300, lng: 73.82400 }, // Pune University Chowk
  { lat: 18.54950, lng: 73.82900 }, // Ganeshkhind Road Return
  { lat: 18.54600, lng: 73.83400 }, // E-Square Junction
  { lat: 18.53800, lng: 73.84200 }, // Sancheti Hospital
  { lat: 18.53000, lng: 73.84800 }, // JM Road South
  { lat: 18.52150, lng: 73.85100 }, // Balgandharva Ranga Mandir
  { lat: 18.51300, lng: 73.85300 }, // Shivaji Bridge South
  { lat: 18.50500, lng: 73.85600 }, // Bajirao Road
  { lat: 18.49700, lng: 73.85900 }, // Swargate Bypass
  { lat: 18.48800, lng: 73.85850 }, // Satara Rd Southbound
  { lat: 18.47800, lng: 73.85800 }, // Padmavati South
  { lat: 18.46800, lng: 73.85750 }, // KK Market South
  { lat: 18.45900, lng: 73.85650 }, // Satara Rd Approach
  { lat: 18.45290, lng: 73.85530 }  // Katraj Chowk Loop Return
];

function calculateHaversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

let currentSegment = 0;
let distanceAlongSegmentMeters = 0.0;
let currentSpeedKmph = 38.0;

export function startRideSimulator(onSimTick) {
  if (isSimRunning) return;
  isSimRunning = true;
  currentSegment = 0;
  distanceAlongSegmentMeters = 0.0;
  currentSpeedKmph = 38.0;

  simInterval = setInterval(() => {
    // 1. Realistic Motorcycle Speed Dynamics (oscillates naturally 37 - 45 km/h)
    const targetSpeed = 41.0 + Math.sin(Date.now() / 4000) * 4.5;
    const speedDiff = targetSpeed - currentSpeedKmph;
    currentSpeedKmph += Math.sign(speedDiff) * Math.min(Math.abs(speedDiff), 1.8);

    // Physical distance traversed in 1 second (~10.5 - 12.5 meters)
    const metersMoved = currentSpeedKmph * (1000.0 / 3600.0);
    distanceAlongSegmentMeters += metersMoved;

    let p1 = ROAD_ROUTE[currentSegment];
    let p2 = ROAD_ROUTE[(currentSegment + 1) % ROAD_ROUTE.length];
    let segDist = calculateHaversineMeters(p1.lat, p1.lng, p2.lat, p2.lng);
    if (segDist < 1.0) segDist = 1.0;

    while (distanceAlongSegmentMeters >= segDist) {
      distanceAlongSegmentMeters -= segDist;
      currentSegment = (currentSegment + 1) % ROAD_ROUTE.length;
      p1 = ROAD_ROUTE[currentSegment];
      p2 = ROAD_ROUTE[(currentSegment + 1) % ROAD_ROUTE.length];
      segDist = calculateHaversineMeters(p1.lat, p1.lng, p2.lat, p2.lng);
      if (segDist < 1.0) segDist = 1.0;
    }

    // Precise sub-meter linear interpolation
    const fraction = Math.max(0, Math.min(1, distanceAlongSegmentMeters / segDist));
    const curLat = p1.lat + (p2.lat - p1.lat) * fraction;
    const curLng = p1.lng + (p2.lng - p1.lng) * fraction;

    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(p2.lat * Math.PI / 180);
    const x = Math.cos(p1.lat * Math.PI / 180) * Math.sin(p2.lat * Math.PI / 180) -
              Math.sin(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.cos(dLng);
    const headingDeg = ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;

    const gx = (Math.random() - 0.5) * 0.08;
    const gy = 0.99 + (Math.random() - 0.5) * 0.04;
    const gz = (Math.random() - 0.5) * 0.06;
    const totalG = Math.sqrt(gx * gx + gy * gy + gz * gz);

    const payload = {
      timestamp: Date.now(),
      location: {
        latitude: curLat,
        longitude: curLng,
        speedKmph: parseFloat(currentSpeedKmph.toFixed(1)),
        accuracyMeters: 2.5,
        heading: parseFloat(headingDeg.toFixed(1))
      },
      sensors: {
        helmetWorn: true,
        alcoholAdc: 385,
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
  }
  isSimRunning = false;
}
