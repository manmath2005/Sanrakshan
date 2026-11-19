/**
 * Guardian 3D Simulation - Procedural CAD Model Generator
 * High-fidelity 3D meshes for Motorcycle, Articulated Rider, and
 * the Smart Helmet with internal exploded-view electronic modules.
 */

class CADModelBuilder {
  constructor() {
    // Shared Materials Palette
    this.materials = {
      // Vehicle materials
      paintRed: new THREE.MeshStandardMaterial({ color: 0xd32f2f, metalness: 0.8, roughness: 0.2 }),
      paintDark: new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.9, roughness: 0.3 }),
      paintCyan: new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.85, roughness: 0.25 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.1 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.75, roughness: 0.35 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85, metalness: 0.1 }),
      engineMetal: new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.4 }),
      brakeDisc: new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 }),
      glassHeadlight: new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.8, opacity: 1, transparent: true, roughness: 0.1 }),
      tailLight: new THREE.MeshBasicMaterial({ color: 0xef4444 }),

      // Rider materials
      riderJacket: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 }),
      riderPants: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 }),
      riderSkin: new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.6 }),
      riderGloves: new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.3 }),
      reflectiveStripe: new THREE.MeshStandardMaterial({ color: 0xa7f3d0, emissive: 0x34d399, emissiveIntensity: 0.4 }),

      // Helmet materials
      helmetShell: new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.85, roughness: 0.2, clearcoat: 0.8 }),
      helmetInner: new THREE.MeshStandardMaterial({ color: 0x1e1e24, roughness: 0.9 }),
      visorTint: new THREE.MeshPhysicalMaterial({ color: 0x111827, transmission: 0.75, transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.2 }),
      chinstrap: new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 }),

      // Electronics materials
      pcbGreen: new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.4, metalness: 0.2 }),
      pcbBlue: new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4, metalness: 0.2 }),
      pcbBlack: new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3, metalness: 0.3 }),
      chipBlack: new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3, metalness: 0.5 }),
      goldPins: new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.95, roughness: 0.15 }),
      sensorMesh: new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9, roughness: 0.3, wireframe: false }),
      relayBlue: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.5 }),
      batteryGold: new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7, roughness: 0.3 }),
      hotspotGlow: new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.75 })
    };
  }

  /**
   * Builds the 3D Motorcycle
   */
  buildMotorcycle() {
    const bike = new THREE.Group();
    bike.name = 'Motorcycle';

    // 1. MAIN CHASSIS / FRAME
    const frameGeo = new THREE.BoxGeometry(0.35, 0.4, 2.2);
    const frameMesh = new THREE.Mesh(frameGeo, this.materials.steel);
    frameMesh.position.set(0, 0.75, 0);
    bike.add(frameMesh);

    // Fuel Tank
    const tankGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.9, 16);
    tankGeo.rotateX(Math.PI / 2);
    const tankMesh = new THREE.Mesh(tankGeo, this.materials.paintCyan);
    tankMesh.position.set(0, 1.15, -0.15);
    bike.add(tankMesh);

    // Motorcycle Seat
    const seatGeo = new THREE.BoxGeometry(0.32, 0.12, 0.75);
    const seatMesh = new THREE.Mesh(seatGeo, this.materials.rubber);
    seatMesh.position.set(0, 1.05, 0.55);
    bike.add(seatMesh);

    // Engine Block
    const engineGeo = new THREE.BoxGeometry(0.38, 0.55, 0.65);
    const engineMesh = new THREE.Mesh(engineGeo, this.materials.engineMetal);
    engineMesh.position.set(0, 0.55, -0.1);
    bike.add(engineMesh);

    // Cooling Fins
    for (let i = 0; i < 5; i++) {
      const finGeo = new THREE.BoxGeometry(0.42, 0.02, 0.6);
      const fin = new THREE.Mesh(finGeo, this.materials.chrome);
      fin.position.set(0, 0.38 + i * 0.08, -0.1);
      bike.add(fin);
    }

    // Dual Exhaust Pipes
    const exhaustGeo = new THREE.CylinderGeometry(0.045, 0.05, 1.6, 12);
    exhaustGeo.rotateX(Math.PI / 2);
    const exhaustRight = new THREE.Mesh(exhaustGeo, this.materials.chrome);
    exhaustRight.position.set(0.24, 0.38, 0.6);
    bike.add(exhaustRight);

    // Exhaust Tip Exit Point (for particle emissions)
    const exhaustTip = new THREE.Object3D();
    exhaustTip.name = 'ExhaustTip';
    exhaustTip.position.set(0.24, 0.38, 1.4);
    bike.add(exhaustTip);
    bike.exhaustTip = exhaustTip;

    // 2. FRONT FORK & HANDLEBARS
    const forkGroup = new THREE.Group();
    forkGroup.position.set(0, 0.75, -1.05);

    const leftForkGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 12);
    const leftFork = new THREE.Mesh(leftForkGeo, this.materials.chrome);
    leftFork.position.set(0.12, 0, 0);
    leftFork.rotation.x = -0.25;
    forkGroup.add(leftFork);

    const rightFork = leftFork.clone();
    rightFork.position.x = -0.12;
    forkGroup.add(rightFork);

    // Handlebars
    const barGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.85, 12);
    barGeo.rotateZ(Math.PI / 2);
    const barMesh = new THREE.Mesh(barGeo, this.materials.steel);
    barMesh.position.set(0, 0.55, -0.05);
    forkGroup.add(barMesh);

    // Grips & Mirrors
    const gripGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.16, 12);
    gripGeo.rotateZ(Math.PI / 2);
    const leftGrip = new THREE.Mesh(gripGeo, this.materials.rubber);
    leftGrip.position.set(0.38, 0.55, -0.05);
    forkGroup.add(leftGrip);
    const rightGrip = leftGrip.clone();
    rightGrip.position.x = -0.38;
    forkGroup.add(rightGrip);

    // Headlight
    const lightGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 16);
    lightGeo.rotateX(Math.PI / 2);
    const lightMesh = new THREE.Mesh(lightGeo, this.materials.chrome);
    lightMesh.position.set(0, 0.42, -0.15);
    const lensMesh = new THREE.Mesh(new THREE.CircleGeometry(0.11, 16), this.materials.glassHeadlight);
    lensMesh.position.set(0, 0.42, -0.22);
    lensMesh.rotateY(Math.PI);
    forkGroup.add(lightMesh);
    forkGroup.add(lensMesh);

    // Dynamic Headlight Beam
    const spotLight = new THREE.SpotLight(0xffffff, 2.5, 45, Math.PI / 6, 0.3, 1);
    spotLight.position.set(0, 0.42, -0.25);
    spotLight.target.position.set(0, 0, -15);
    forkGroup.add(spotLight);
    forkGroup.add(spotLight.target);

    bike.add(forkGroup);
    bike.forkGroup = forkGroup;

    // 3. FRONT WHEEL
    const frontWheel = this.buildWheel();
    frontWheel.position.set(0, 0.42, -1.25);
    bike.add(frontWheel);
    bike.frontWheel = frontWheel;

    // 4. REAR WHEEL
    const rearWheel = this.buildWheel();
    rearWheel.position.set(0, 0.42, 1.15);
    bike.add(rearWheel);
    bike.rearWheel = rearWheel;

    // Rear Taillight
    const tailLightGeo = new THREE.BoxGeometry(0.18, 0.06, 0.04);
    const tailLight = new THREE.Mesh(tailLightGeo, this.materials.tailLight);
    tailLight.position.set(0, 0.88, 1.25);
    bike.add(tailLight);

    return bike;
  }

  /**
   * Builds an authentic Wheel with rubber tread, rim, spokes, and brake disc
   */
  buildWheel() {
    const wheelGroup = new THREE.Group();
    wheelGroup.name = 'Wheel';

    // Tyre (Torus)
    const tyreGeo = new THREE.TorusGeometry(0.42, 0.11, 16, 32);
    const tyreMesh = new THREE.Mesh(tyreGeo, this.materials.rubber);
    tyreMesh.rotateY(Math.PI / 2);
    wheelGroup.add(tyreMesh);

    // Rim
    const rimGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.14, 24, 1, true);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, this.materials.chrome);
    wheelGroup.add(rimMesh);

    // Central Hub
    const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.16, 16);
    hubGeo.rotateZ(Math.PI / 2);
    const hubMesh = new THREE.Mesh(hubGeo, this.materials.engineMetal);
    wheelGroup.add(hubMesh);

    // Spokes (5-spoke alloy pattern)
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const spokeGeo = new THREE.BoxGeometry(0.03, 0.32, 0.03);
      const spoke = new THREE.Mesh(spokeGeo, this.materials.chrome);
      spoke.position.set(0, Math.sin(angle) * 0.16, Math.cos(angle) * 0.16);
      spoke.rotation.x = angle;
      wheelGroup.add(spoke);
    }

    // Ventilated Brake Disc
    const discGeo = new THREE.RingGeometry(0.12, 0.26, 24);
    discGeo.rotateY(Math.PI / 2);
    const discMesh = new THREE.Mesh(discGeo, this.materials.brakeDisc);
    discMesh.position.x = 0.08;
    wheelGroup.add(discMesh);

    return wheelGroup;
  }

  /**
   * Builds the Articulated Rider Avatar
   */
  buildRider() {
    const rider = new THREE.Group();
    rider.name = 'RiderAvatar';

    // Torso / Jacket
    const torsoGeo = new THREE.BoxGeometry(0.44, 0.65, 0.28);
    const torso = new THREE.Mesh(torsoGeo, this.materials.riderJacket);
    torso.position.set(0, 1.48, 0.35);
    torso.rotation.x = 0.28; // Leaning forward slightly
    rider.add(torso);

    // Reflective Safety Stripes
    const stripeGeo = new THREE.BoxGeometry(0.46, 0.06, 0.29);
    const stripe = new THREE.Mesh(stripeGeo, this.materials.reflectiveStripe);
    stripe.position.set(0, 1.55, 0.35);
    stripe.rotation.x = 0.28;
    rider.add(stripe);

    // Arms reaching for handlebars
    const armGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.65, 12);
    // Left Arm
    const leftArm = new THREE.Mesh(armGeo, this.materials.riderJacket);
    leftArm.position.set(0.28, 1.42, 0.05);
    leftArm.rotation.set(-0.7, 0, -0.3);
    rider.add(leftArm);

    // Right Arm
    const rightArm = new THREE.Mesh(armGeo, this.materials.riderJacket);
    rightArm.position.set(-0.28, 1.42, 0.05);
    rightArm.rotation.set(-0.7, 0, 0.3);
    rider.add(rightArm);

    // Hands / Gloves
    const handGeo = new THREE.SphereGeometry(0.06, 12, 12);
    const leftHand = new THREE.Mesh(handGeo, this.materials.riderGloves);
    leftHand.position.set(0.38, 1.25, -0.15);
    rider.add(leftHand);

    const rightHand = leftHand.clone();
    rightHand.position.x = -0.38;
    rider.add(rightHand);

    // Legs on footpegs
    const legGeo = new THREE.BoxGeometry(0.14, 0.65, 0.18);
    const leftLeg = new THREE.Mesh(legGeo, this.materials.riderPants);
    leftLeg.position.set(0.22, 0.95, 0.45);
    leftLeg.rotation.x = 0.55;
    rider.add(leftLeg);

    const rightLeg = leftLeg.clone();
    rightLeg.position.x = -0.22;
    rider.add(rightLeg);

    // Head / Neck Attachment Anchor for the Smart Helmet
    const headAnchor = new THREE.Object3D();
    headAnchor.name = 'HeadAnchor';
    headAnchor.position.set(0, 1.95, 0.18);
    rider.add(headAnchor);
    rider.headAnchor = headAnchor;

    return rider;
  }

  /**
   * Builds the 3D Smart Helmet Assembly with Exploded Internal Electronics
   */
  buildSmartHelmet() {
    const helmet = new THREE.Group();
    helmet.name = 'SmartHelmetAssembly';

    // 1. OUTER AERODYNAMIC SHELL (Explodes along +Y)
    const shellGroup = new THREE.Group();
    shellGroup.name = 'HelmetOuterShell';

    const shellGeo = new THREE.SphereGeometry(0.32, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.72);
    const shellMesh = new THREE.Mesh(shellGeo, this.materials.helmetShell);
    shellMesh.rotation.x = -0.15;
    shellGroup.add(shellMesh);

    // Rear Spoiler
    const spoilerGeo = new THREE.BoxGeometry(0.38, 0.08, 0.18);
    const spoiler = new THREE.Mesh(spoilerGeo, this.materials.helmetShell);
    spoiler.position.set(0, 0.12, 0.26);
    spoiler.rotation.x = -0.4;
    shellGroup.add(spoiler);

    // Air Intake Vents
    const ventGeo = new THREE.BoxGeometry(0.14, 0.04, 0.06);
    const vent = new THREE.Mesh(ventGeo, this.materials.steel);
    vent.position.set(0, 0.22, -0.22);
    shellGroup.add(vent);

    helmet.add(shellGroup);
    helmet.shellGroup = shellGroup;

    // 2. MOVABLE TINTED VISOR (Opens/closes, rotates upwards)
    const visorGroup = new THREE.Group();
    visorGroup.name = 'HelmetVisor';

    const visorGeo = new THREE.CylinderGeometry(0.325, 0.325, 0.24, 24, 1, true, -Math.PI * 0.45, Math.PI * 0.9);
    const visorMesh = new THREE.Mesh(visorGeo, this.materials.visorTint);
    visorMesh.position.set(0, -0.04, 0);
    visorGroup.add(visorMesh);

    // Visor Hinge Pivot Points
    const hingeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.68, 12);
    hingeGeo.rotateZ(Math.PI / 2);
    const hinge = new THREE.Mesh(hingeGeo, this.materials.chrome);
    hinge.position.set(0, 0.04, -0.02);
    visorGroup.add(hinge);

    helmet.add(visorGroup);
    helmet.visorGroup = visorGroup;

    // 3. INNER EPS CUSHIONING & LINER (Descends along -Y)
    const linerGroup = new THREE.Group();
    linerGroup.name = 'HelmetInnerLiner';

    const linerGeo = new THREE.SphereGeometry(0.28, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.65);
    const linerMesh = new THREE.Mesh(linerGeo, this.materials.helmetInner);
    linerMesh.rotation.x = -0.15;
    linerGroup.add(linerMesh);

    // Chin Strap
    const strapGeo = new THREE.TorusGeometry(0.18, 0.02, 12, 24, Math.PI);
    const strap = new THREE.Mesh(strapGeo, this.materials.chinstrap);
    strap.position.set(0, -0.22, 0.05);
    strap.rotation.x = Math.PI / 2;
    linerGroup.add(strap);

    helmet.add(linerGroup);
    helmet.linerGroup = linerGroup;

    // 4. ELECTRONIC HARDWARE MODULES (Inside Helmet Cavity)
    const electronicsGroup = new THREE.Group();
    electronicsGroup.name = 'ElectronicsAssembly';

    // Module 1: ESP32 DevKit V1 Board (Crown / Rear Interior)
    const esp32 = this.createModuleMesh('ESP32_MCU', 'ESP32 DevKit V1 (Main Hub)', 0.16, 0.025, 0.28, this.materials.pcbBlack);
    esp32.position.set(0, 0.15, 0.14);
    // Add microchips on ESP32
    const espChip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.015, 0.09), this.materials.chipBlack);
    espChip.position.set(0, 0.015, -0.04);
    esp32.add(espChip);
    // USB-C Port
    const usbPort = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.02, 0.035), this.materials.chrome);
    usbPort.position.set(0, 0.01, 0.14);
    esp32.add(usbPort);
    electronicsGroup.add(esp32);

    // Module 2: MQ-3 Alcohol Breathalyzer (Chin / Breath Chamber)
    const mq3 = this.createModuleMesh('MQ3_SENSOR', 'MQ-3 Alcohol Sensor', 0.12, 0.02, 0.14, this.materials.pcbBlue);
    mq3.position.set(0, -0.15, -0.22);
    // SnO2 Metal Mesh Cylindrical Dome
    const meshDome = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.05, 16), this.materials.sensorMesh);
    meshDome.position.set(0, 0.03, 0);
    mq3.add(meshDome);
    // Trimmer Potentiometer
    const pot = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.025), this.materials.paintCyan);
    pot.position.set(0.035, 0.015, -0.04);
    mq3.add(pot);
    electronicsGroup.add(mq3);

    // Module 3: GY-521 MPU-6050 6-Axis IMU (Center of Gravity / Top Interior)
    const mpu6050 = this.createModuleMesh('MPU6050_IMU', 'MPU-6050 6-Axis Crash IMU', 0.10, 0.018, 0.10, this.materials.pcbBlue);
    mpu6050.position.set(0, 0.24, 0.02);
    const mpuChip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.04), this.materials.chipBlack);
    mpuChip.position.set(0, 0.012, 0);
    mpu6050.add(mpuChip);
    electronicsGroup.add(mpu6050);

    // Module 4: TCRT5000 IR Wear Sensor (Forehead / Brow Level)
    const irSensor = this.createModuleMesh('IR_WEAR_SENSOR', 'TCRT5000 Optical Wear Sensor', 0.09, 0.02, 0.12, this.materials.pcbBlue);
    irSensor.position.set(0, 0.04, -0.26);
    // Dual Optical Diodes (Emitter + Phototransistor)
    const emitter = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 12), this.materials.glassHeadlight);
    emitter.position.set(0.022, 0.02, 0.02);
    irSensor.add(emitter);
    const detector = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.03, 12), this.materials.chipBlack);
    detector.position.set(-0.022, 0.02, 0.02);
    irSensor.add(detector);
    electronicsGroup.add(irSensor);

    // Module 5: 5V Optocoupler Relay (Bike Controller / Transmitter Interlock)
    const relay = this.createModuleMesh('RELAY_MODULE', '5V Optocoupler Relay Interlock', 0.14, 0.04, 0.11, this.materials.relayBlue);
    relay.position.set(-0.16, 0.05, 0.10);
    // Screw Terminals
    const terminal = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.08), this.materials.paintCyan);
    terminal.position.set(0.05, 0.02, 0);
    relay.add(terminal);
    electronicsGroup.add(relay);

    // Module 6: 3.7V 18650 Li-ion Battery & TP4056 Charger (Right Lateral Flank)
    const powerUnit = this.createModuleMesh('POWER_MODULE', '18650 Li-ion + TP4056 USB-C', 0.14, 0.05, 0.22, this.materials.pcbGreen);
    powerUnit.position.set(0.16, 0.05, 0.08);
    // 18650 Battery Cylinder
    const batteryCell = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.18, 16), this.materials.batteryGold);
    batteryCell.rotateX(Math.PI / 2);
    batteryCell.position.set(0, 0.035, 0);
    powerUnit.add(batteryCell);
    electronicsGroup.add(powerUnit);

    helmet.add(electronicsGroup);
    helmet.electronicsGroup = electronicsGroup;

    // Cache component references for raycasting & exploded animations
    helmet.components = {
      esp32,
      mq3,
      mpu6050,
      irSensor,
      relay,
      powerUnit
    };

    return helmet;
  }

  /**
   * Helper to create an interactive electronic module with glowing 3D hotspot marker
   */
  createModuleMesh(id, displayName, w, h, d, material) {
    const group = new THREE.Group();
    group.name = id;
    group.userData = {
      componentId: id,
      name: displayName,
      isInteractive: true,
      originalPos: new THREE.Vector3(),
      explodedOffset: new THREE.Vector3()
    };

    const pcbGeo = new THREE.BoxGeometry(w, h, d);
    const pcbMesh = new THREE.Mesh(pcbGeo, material);
    pcbMesh.userData = group.userData;
    group.add(pcbMesh);

    // Glowing 3D Interactive Hotspot Ring
    const ringGeo = new THREE.RingGeometry(0.035, 0.055, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMesh = new THREE.Mesh(ringGeo, this.materials.hotspotGlow);
    ringMesh.position.set(0, h / 2 + 0.015, 0);
    ringMesh.name = 'HotspotRing';
    group.add(ringMesh);

    return group;
  }
}

// Global export
window.CADModelBuilder = CADModelBuilder;
