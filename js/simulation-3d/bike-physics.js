/**
 * Guardian 3D Simulation - Motorcycle Dynamics & Physics Engine
 * Real-time 5-speed transmission, RPM curves, banking lean angles,
 * suspension vibration, and dual-threshold crash physics.
 */

class BikePhysicsEngine {
  constructor() {
    // Kinematics & Speed
    this.speed = 0;              // Current speed in km/h
    this.maxSpeed = 125;         // Top speed in km/h
    this.acceleration = 18.5;    // Base acceleration in km/h/s
    this.deceleration = 12.0;    // Natural engine braking
    this.brakeForce = 45.0;      // Disc braking power

    // Transmission & RPM
    this.gear = 0;               // 0 = Neutral, 1-5 = Gears
    this.rpm = 1100;             // Engine RPM (1100 idle, 8500 redline)
    this.gearRatios = [
      { minSpeed: 0,  maxSpeed: 0,   ratio: 0 },    // Neutral
      { minSpeed: 0,  maxSpeed: 28,  ratio: 3.1 },  // Gear 1
      { minSpeed: 20, maxSpeed: 52,  ratio: 2.1 },  // Gear 2
      { minSpeed: 42, maxSpeed: 78,  ratio: 1.5 },  // Gear 3
      { minSpeed: 68, maxSpeed: 102, ratio: 1.2 },  // Gear 4
      { minSpeed: 90, maxSpeed: 130, ratio: 0.95 }  // Gear 5
    ];

    // Steering & Banking
    this.steeringAngle = 0;      // -1 (Full Left) to +1 (Full Right)
    this.leanAngle = 0;          // Radians leaning into turn
    this.lateralPosition = 0;    // Highway lane position (-6 to +6 meters)
    this.heading = 0;            // Compass heading in degrees

    // Suspension & Vibration
    this.suspensionOffset = 0;
    this.vibrationFreq = 0;

    // Safety Interlock & Crash State
    this.isIgnitionUnlocked = false;
    this.isEngineRunning = false;
    this.isCrashed = false;
    this.gForce = { x: 0.05, y: 1.0, z: -0.02, total: 1.0 };

    // Input States
    this.inputs = {
      throttle: false,
      brake: false,
      steerLeft: false,
      steerRight: false,
      handbrake: false
    };
  }

  /**
   * Resets vehicle state to standing still
   */
  reset() {
    this.speed = 0;
    this.gear = this.isEngineRunning ? 1 : 0;
    this.rpm = this.isEngineRunning ? 1100 : 0;
    this.steeringAngle = 0;
    this.leanAngle = 0;
    this.lateralPosition = 0;
    this.isCrashed = false;
    this.gForce = { x: 0.05, y: 1.0, z: -0.02, total: 1.0 };
  }

  /**
   * Main Physics Simulation Update Loop
   * @param {number} delta - Delta time in seconds (typically ~0.016s at 60fps)
   */
  update(delta) {
    if (this.isCrashed) {
      // Rapid skid stop on crash
      this.speed = Math.max(0, this.speed - 65 * delta);
      this.rpm = Math.max(0, this.rpm - 4000 * delta);
      this.leanAngle = THREE.MathUtils.lerp(this.leanAngle, -1.25, delta * 4); // Laid down on asphalt
      return;
    }

    // 1. THROTTLE & ACCELERATION LOGIC
    if (this.isEngineRunning && this.isIgnitionUnlocked) {
      if (this.inputs.throttle && !this.inputs.brake) {
        // Accelerate
        const currentGearData = this.gearRatios[Math.max(1, this.gear)];
        const gearAccelMultiplier = currentGearData.ratio * 0.45;
        this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration * gearAccelMultiplier * delta);
      } else if (this.inputs.brake) {
        // Active Braking
        this.speed = Math.max(0, this.speed - this.brakeForce * delta);
      } else {
        // Natural Engine Rolling Resistance
        this.speed = Math.max(0, this.speed - this.deceleration * delta);
      }
    } else {
      // Engine Off or Ignition Locked -> Roll to stop
      this.speed = Math.max(0, this.speed - this.deceleration * 1.5 * delta);
    }

    // 2. AUTOMATIC TRANSMISSION & RPM CALCULATION
    if (this.isEngineRunning) {
      if (this.speed <= 0.5) {
        this.gear = 1;
        this.rpm = this.inputs.throttle ? 2200 : 1100;
      } else {
        // Find optimal gear for current speed
        for (let g = 1; g <= 5; g++) {
          if (this.speed <= this.gearRatios[g].maxSpeed || g === 5) {
            this.gear = g;
            break;
          }
        }

        const currentRatio = this.gearRatios[this.gear];
        const speedInGearPercent = (this.speed - currentRatio.minSpeed) / (currentRatio.maxSpeed - currentRatio.minSpeed);
        const targetRPM = 1800 + Math.max(0, Math.min(1, speedInGearPercent)) * 6200;
        this.rpm = THREE.MathUtils.lerp(this.rpm, targetRPM, delta * 8);
      }
    } else {
      this.gear = 0;
      this.rpm = 0;
    }

    // 3. STEERING & CENTRIFUGAL BANKING LEAN
    let targetSteer = 0;
    if (this.inputs.steerLeft) targetSteer -= 1;
    if (this.inputs.steerRight) targetSteer += 1;

    this.steeringAngle = THREE.MathUtils.lerp(this.steeringAngle, targetSteer, delta * 6);

    // Lateral displacement on highway
    if (this.speed > 1) {
      const turnRate = this.steeringAngle * (this.speed / 50);
      this.lateralPosition += turnRate * delta * 5.5;
      // Clamp to road boundaries (-5.5m to +5.5m)
      this.lateralPosition = Math.max(-5.5, Math.min(5.5, this.lateralPosition));

      // Realistic motorcycle counter-steering lean angle theta = v^2 / (g * R)
      const targetLean = -this.steeringAngle * Math.min(0.55, (this.speed / 85) * 0.55);
      this.leanAngle = THREE.MathUtils.lerp(this.leanAngle, targetLean, delta * 7);
    } else {
      this.leanAngle = THREE.MathUtils.lerp(this.leanAngle, 0, delta * 6);
    }

    // 4. SUSPENSION MICRO-VIBRATION
    if (this.speed > 5) {
      this.vibrationFreq += delta * (this.speed / 8);
      this.suspensionOffset = Math.sin(this.vibrationFreq * 18) * 0.012;
      // Braking nose dive
      if (this.inputs.brake) this.suspensionOffset -= 0.045;
    } else {
      this.suspensionOffset = 0;
    }

    // 5. INERTIAL G-FORCE COMPUTATION (MPU-6050 Simulation)
    const lateralG = (this.steeringAngle * (this.speed / 45) * 0.7);
    const accelG = this.inputs.throttle ? 0.35 : (this.inputs.brake ? -0.85 : 0.0);
    const roadNoise = (Math.random() - 0.5) * (this.speed / 180);

    this.gForce.x = THREE.MathUtils.lerp(this.gForce.x, lateralG + roadNoise, delta * 12);
    this.gForce.y = THREE.MathUtils.lerp(this.gForce.y, 1.0 + Math.abs(roadNoise), delta * 12); // Earth Gravity (1G)
    this.gForce.z = THREE.MathUtils.lerp(this.gForce.z, accelG, delta * 12);
    this.gForce.total = Math.sqrt(
      this.gForce.x * this.gForce.x +
      this.gForce.y * this.gForce.y +
      this.gForce.z * this.gForce.z
    );
  }

  /**
   * Injects an instantaneous high-impact collision pulse (>4.0G)
   */
  triggerCrash() {
    this.isCrashed = true;
    this.isEngineRunning = false;
    this.isIgnitionUnlocked = false;

    // Severe collision impact peak
    this.gForce.x = 2.45;
    this.gForce.y = 3.65;
    this.gForce.z = -2.85;
    this.gForce.total = 4.82; // Trigger instant emergency SOS!
  }
}

// Global export
window.BikePhysicsEngine = BikePhysicsEngine;
