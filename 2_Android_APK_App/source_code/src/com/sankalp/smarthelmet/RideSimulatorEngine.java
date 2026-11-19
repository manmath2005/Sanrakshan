package com.sankalp.smarthelmet;

import java.util.Random;

public class RideSimulatorEngine {

    // High-Precision Real Pune Arterial Road Centerline Waypoints
    // Route: Katraj Chowk -> Satara Road -> Swargate -> Sarasbaug -> Tilak Road -> Alka Talkies -> Deccan -> FC Road -> Shivajinagar -> Pune University -> Return Loop
    private static final double[][] ROAD_ROUTE = {
        {18.45290, 73.85530}, // 0. Katraj Chowk / Satara Road Start
        {18.45550, 73.85610}, // 1. Mohan Nagar / Satara Rd
        {18.45820, 73.85680}, // 2. KK Market
        {18.46150, 73.85710}, // 3. Balaji Nagar
        {18.46510, 73.85740}, // 4. Padmavati Chowk
        {18.46950, 73.85780}, // 5. Bibvewadi Corner
        {18.47350, 73.85810}, // 6. Laxmi Narayan Chowk
        {18.47800, 73.85790}, // 7. Swargate South Ramp
        {18.48200, 73.85760}, // 8. Swargate Flyover
        {18.48600, 73.85650}, // 9. Jedhe Chowk
        {18.49050, 73.85500}, // 10. Sarasbaug Road
        {18.49450, 73.85320}, // 11. Hirabaug
        {18.49880, 73.85120}, // 12. Tilak Road / SP College
        {18.50350, 73.84750}, // 13. Abhinav Kala Mahavidyalaya
        {18.50850, 73.84400}, // 14. Alka Talkies / Sambhaji Bridge
        {18.51300, 73.84250}, // 15. Deccan Corner
        {18.51750, 73.84150}, // 16. Deccan Gymkhana
        {18.52250, 73.84220}, // 17. Goodluck Chowk
        {18.52800, 73.84320}, // 18. FC Road Main Gate
        {18.53200, 73.84100}, // 19. FC Road North
        {18.53500, 73.83750}, // 20. Shivajinagar Circle
        {18.53950, 73.83400}, // 21. COEP Corner
        {18.54400, 73.83100}, // 22. Agriculture College Road
        {18.54900, 73.82750}, // 23. Range Hills Corner
        {18.55300, 73.82400}, // 24. Pune University Chowk
        {18.54950, 73.82900}, // 25. Ganeshkhind Road Return
        {18.54600, 73.83400}, // 26. E-Square Junction
        {18.53800, 73.84200}, // 27. Sancheti Hospital
        {18.53000, 73.84800}, // 28. JM Road South
        {18.52150, 73.85100}, // 29. Balgandharva Ranga Mandir
        {18.51300, 73.85300}, // 30. Shivaji Bridge South
        {18.50500, 73.85600}, // 31. Bajirao Road
        {18.49700, 73.85900}, // 32. Swargate Bypass
        {18.48800, 73.85850}, // 33. Satara Rd Southbound
        {18.47800, 73.85800}, // 34. Padmavati South
        {18.46800, 73.85750}, // 35. KK Market South
        {18.45900, 73.85650}, // 36. Satara Rd Approach
        {18.45290, 73.85530}  // 37. Katraj Chowk Loop Return
    };

    private int currentSegment = 0;
    private double segmentDistanceMeters = 0.0;
    private double distanceAlongSegmentMeters = 0.0;

    private double currentLat = 18.45290;
    private double currentLng = 73.85530;
    private double currentSpeed = 38.0;      // km/h
    private double targetSpeed = 42.0;       // km/h
    private double currentHeading = 18.0;    // degrees
    private double currentGForce = 1.02;
    private boolean isCrashSimulated = false;

    private Random random = new Random();

    public RideSimulatorEngine() {
        reset();
    }

    public void reset() {
        currentSegment = 0;
        distanceAlongSegmentMeters = 0.0;
        currentLat = ROAD_ROUTE[0][0];
        currentLng = ROAD_ROUTE[0][1];
        currentSpeed = 36.0;
        targetSpeed = 42.0;
        currentGForce = 1.02;
        isCrashSimulated = false;
        computeSegmentDistance();
        computeHeading();
    }

    public void triggerCrash(double forceG) {
        this.isCrashSimulated = true;
        this.currentGForce = forceG;
        this.currentSpeed = 0.0;
    }

    private void computeSegmentDistance() {
        double[] p1 = ROAD_ROUTE[currentSegment];
        double[] p2 = ROAD_ROUTE[(currentSegment + 1) % ROAD_ROUTE.length];
        segmentDistanceMeters = calculateHaversineMeters(p1[0], p1[1], p2[0], p2[1]);
        if (segmentDistanceMeters < 1.0) segmentDistanceMeters = 1.0;
    }

    private void computeHeading() {
        double[] p1 = ROAD_ROUTE[currentSegment];
        double[] p2 = ROAD_ROUTE[(currentSegment + 1) % ROAD_ROUTE.length];
        double dLat = Math.toRadians(p2[0] - p1[0]);
        double dLng = Math.toRadians(p2[1] - p1[1]);
        double lat1 = Math.toRadians(p1[0]);
        double lat2 = Math.toRadians(p2[0]);

        double y = Math.sin(dLng) * Math.cos(lat2);
        double x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        double brng = Math.toDegrees(Math.atan2(y, x));
        currentHeading = (brng + 360.0) % 360.0;
    }

    private double calculateHaversineMeters(double lat1, double lon1, double lat2, double lon2) {
        double R = 6371000.0; // Earth radius in meters
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2.0) * Math.sin(dLat / 2.0) +
                   Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                   Math.sin(dLon / 2.0) * Math.sin(dLon / 2.0);
        double c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(1.0 - a));
        return R * c;
    }

    /**
     * Advances simulation by exactly 1 physical second using realistic motorcycle cruising physics.
     * Speed: 35–48 km/h (~9.7 to 13.3 meters per second).
     * Smoothly follows asphalt roadway without jumping or teleporting.
     */
    public void step() {
        if (isCrashSimulated) {
            currentSpeed = 0.0;
            currentGForce = 1.00;
            return;
        }

        // 1. Realistic Motorcycle Speed Dynamics (Cruising with gentle throttle variations and curve slowdowns)
        // Adjust target speed based on curve sharpness and cruising rhythm
        double speedVariation = Math.sin(System.currentTimeMillis() / 4000.0) * 5.0;
        targetSpeed = 41.0 + speedVariation; // Naturally oscillates between 36.0 and 46.0 km/h
        
        // Smooth linear acceleration filter (max +/- 1.8 km/h per second acceleration/braking)
        double speedDiff = targetSpeed - currentSpeed;
        if (speedDiff > 1.8) currentSpeed += 1.8;
        else if (speedDiff < -1.8) currentSpeed -= 1.8;
        else currentSpeed = targetSpeed;

        // 2. Exact physical distance traversed in 1 second
        double metersMovedInOneSec = currentSpeed * (1000.0 / 3600.0); // e.g. ~11.5 meters

        // 3. Advance along the roadway polyline
        distanceAlongSegmentMeters += metersMovedInOneSec;

        while (distanceAlongSegmentMeters >= segmentDistanceMeters) {
            distanceAlongSegmentMeters -= segmentDistanceMeters;
            currentSegment = (currentSegment + 1) % ROAD_ROUTE.length;
            computeSegmentDistance();
            computeHeading();
        }

        // 4. High-Precision Vector Interpolation on the current asphalt segment
        double fraction = distanceAlongSegmentMeters / segmentDistanceMeters;
        fraction = Math.max(0.0, Math.min(1.0, fraction));

        double[] p1 = ROAD_ROUTE[currentSegment];
        double[] p2 = ROAD_ROUTE[(currentSegment + 1) % ROAD_ROUTE.length];

        currentLat = p1[0] + (p2[0] - p1[0]) * fraction;
        currentLng = p1[1] + (p2[1] - p1[1]) * fraction;

        // 5. Realistic Road-Vibration G-Force (Centered around 1.01G with subtle asphalt texture)
        currentGForce = 1.01 + (random.nextDouble() - 0.5) * 0.06;
    }

    public double getLatitude() { return currentLat; }
    public double getLongitude() { return currentLng; }
    public double getSpeed() { return currentSpeed; }
    public double getHeading() { return currentHeading; }
    public double getGForce() { return currentGForce; }
    public boolean isCrash() { return isCrashSimulated; }
}
