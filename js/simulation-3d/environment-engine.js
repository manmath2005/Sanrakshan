/**
 * Guardian 3D Simulation - Environment & Particle Engine
 * Infinite scrolling 3D asphalt highway, moving lane markings,
 * roadside streetlights, horizon scenery, and exhaust particle dynamics.
 */

class EnvironmentEngine {
  constructor(scene) {
    this.scene = scene;
    this.roadSegments = [];
    this.streetLights = [];
    this.roadLength = 60; // Length of each road chunk
    this.numSegments = 4;
    this.totalDistance = 0;

    // Particle System for Exhaust Smoke
    this.smokeParticles = [];
    this.maxParticles = 65;

    this.initHighway();
    this.initStreetLights();
    this.initExhaustParticles();
    this.initHorizon();
  }

  /**
   * Builds the infinite multi-lane asphalt highway
   */
  initHighway() {
    this.highwayGroup = new THREE.Group();
    this.highwayGroup.name = 'HighwayGroup';

    const roadGeo = new THREE.PlaneGeometry(14, this.roadLength);
    roadGeo.rotateX(-Math.PI / 2);

    const asphaltMaterial = new THREE.MeshStandardMaterial({
      color: 0x1e2229,
      roughness: 0.85,
      metalness: 0.1
    });

    const shoulderMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.95
    });

    // Create modular road chunks
    for (let i = 0; i < this.numSegments; i++) {
      const chunk = new THREE.Group();
      chunk.position.z = -i * this.roadLength;

      // Asphalt
      const asphalt = new THREE.Mesh(roadGeo, asphaltMaterial);
      chunk.add(asphalt);

      // Shoulders / Sidewalks
      const leftShoulder = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, this.roadLength), shoulderMaterial);
      leftShoulder.position.set(-8, 0.05, 0);
      chunk.add(leftShoulder);

      const rightShoulder = leftShoulder.clone();
      rightShoulder.position.x = 8;
      chunk.add(rightShoulder);

      // White Lane Divider Dashes
      const numDashes = 12;
      const dashGeo = new THREE.PlaneGeometry(0.22, 2.8);
      dashGeo.rotateX(-Math.PI / 2);
      const dashMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });

      for (let d = 0; d < numDashes; d++) {
        const zPos = -this.roadLength / 2 + (d * this.roadLength) / numDashes;

        // Left Lane Divider
        const leftDash = new THREE.Mesh(dashGeo, dashMat);
        leftDash.position.set(-2.4, 0.01, zPos);
        chunk.add(leftDash);

        // Right Lane Divider
        const rightDash = new THREE.Mesh(dashGeo, dashMat);
        rightDash.position.set(2.4, 0.01, zPos);
        chunk.add(rightDash);
      }

      // Yellow Center Solid Line
      const yellowLine = new THREE.Mesh(new THREE.PlaneGeometry(0.18, this.roadLength), new THREE.MeshBasicMaterial({ color: 0xfacc15 }));
      yellowLine.rotateX(-Math.PI / 2);
      yellowLine.position.set(0, 0.012, 0);
      chunk.add(yellowLine);

      this.highwayGroup.add(chunk);
      this.roadSegments.push(chunk);
    }

    this.scene.add(this.highwayGroup);
  }

  /**
   * Roadside Streetlights casting real-time ground illumination
   */
  initStreetLights() {
    this.lightsGroup = new THREE.Group();
    this.lightsGroup.name = 'StreetlightsGroup';

    const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 6.5, 8);
    const armGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8);
    armGeo.rotateZ(Math.PI / 2);

    const poleMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
    const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    const spacing = 35;
    for (let i = 0; i < 8; i++) {
      const pole = new THREE.Group();
      pole.position.set(-8.5, 3.25, -i * spacing);

      const mast = new THREE.Mesh(poleGeo, poleMat);
      pole.add(mast);

      const arm = new THREE.Mesh(armGeo, poleMat);
      arm.position.set(1.2, 3.1, 0);
      pole.add(arm);

      const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), lampGlowMat);
      lampHead.position.set(2.4, 3.1, 0);
      pole.add(lampHead);

      // Light source
      const light = new THREE.PointLight(0xfef08a, 1.2, 22, 1.8);
      light.position.set(2.4, 3.0, 0);
      pole.add(light);

      this.lightsGroup.add(pole);
      this.streetLights.push(pole);
    }

    this.scene.add(this.lightsGroup);
  }

  /**
   * Distant Horizon Sky & City Skyline silhouette
   */
  initHorizon() {
    // Starry night / dark sky dome
    const skyGeo = new THREE.SphereGeometry(180, 24, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x030712,
      side: THREE.BackSide
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(sky);

    // Distant City Skyline Silhouette
    const cityGroup = new THREE.Group();
    for (let i = 0; i < 35; i++) {
      const h = 8 + Math.random() * 24;
      const w = 4 + Math.random() * 8;
      const bldgGeo = new THREE.BoxGeometry(w, h, 6);
      const bldgMat = new THREE.MeshBasicMaterial({ color: 0x0b1329 });
      const bldg = new THREE.Mesh(bldgGeo, bldgMat);
      bldg.position.set((i - 17) * 9, h / 2, -150);
      cityGroup.add(bldg);
    }
    this.scene.add(cityGroup);
  }

  /**
   * Initializes Particle Pool for Exhaust Smoke
   */
  initExhaustParticles() {
    this.particleGroup = new THREE.Group();
    this.particleGroup.name = 'ExhaustParticles';

    const pGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const pMat = new THREE.MeshBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.4
    });

    for (let i = 0; i < this.maxParticles; i++) {
      const p = new THREE.Mesh(pGeo, pMat.clone());
      p.visible = false;
      p.userData = {
        life: 0,
        maxLife: 1.0,
        velocity: new THREE.Vector3()
      };
      this.particleGroup.add(p);
      this.smokeParticles.push(p);
    }

    this.scene.add(this.particleGroup);
    this.nextParticleIdx = 0;
  }

  /**
   * Emits smoke particles from the motorcycle exhaust tip
   */
  emitSmoke(originVector, speed, throttle) {
    if (this.smokeParticles.length === 0) return;

    const count = throttle ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const p = this.smokeParticles[this.nextParticleIdx];
      this.nextParticleIdx = (this.nextParticleIdx + 1) % this.maxParticles;

      p.position.copy(originVector);
      p.position.x += (Math.random() - 0.5) * 0.08;
      p.position.y += (Math.random() - 0.5) * 0.08;
      p.scale.setScalar(0.8 + Math.random() * 0.6);

      p.userData.life = 0;
      p.userData.maxLife = 0.65 + Math.random() * 0.45;
      p.userData.velocity.set(
        (Math.random() - 0.5) * 0.4,
        0.3 + Math.random() * 0.5,
        speed * 0.25 + 1.2 + Math.random() * 1.5
      );

      p.material.opacity = 0.5;
      p.visible = true;
    }
  }

  /**
   * Updates highway scrolling, streetlights, and particles
   * @param {number} delta - frame delta time
   * @param {number} speedKmH - current bike speed
   * @param {THREE.Vector3} exhaustTipWorldPos - location of exhaust pipe
   * @param {number} throttle - throttle input
   */
  update(delta, speedKmH, exhaustTipWorldPos = null, throttle = 0) {
    // 1. SCROLL HIGHWAY CHUNKS BACKWARD
    const speedMps = (speedKmH * 1000) / 3600;
    const distanceMoved = speedMps * delta;

    this.roadSegments.forEach((chunk) => {
      chunk.position.z += distanceMoved;
      if (chunk.position.z > this.roadLength) {
        chunk.position.z -= this.numSegments * this.roadLength;
      }
    });

    // 2. SCROLL STREETLIGHTS BACKWARD
    this.streetLights.forEach((pole) => {
      pole.position.z += distanceMoved;
      if (pole.position.z > 20) {
        pole.position.z -= 8 * 35;
      }
    });

    // 3. EMIT & UPDATE EXHAUST PARTICLES
    if (exhaustTipWorldPos && (speedKmH > 0 || throttle > 0)) {
      this.emitSmoke(exhaustTipWorldPos, speedMps, throttle);
    }

    this.smokeParticles.forEach((p) => {
      if (!p.visible) return;
      p.userData.life += delta;
      if (p.userData.life >= p.userData.maxLife) {
        p.visible = false;
        return;
      }

      const progress = p.userData.life / p.userData.maxLife;
      p.position.addScaledVector(p.userData.velocity, delta);
      p.scale.multiplyScalar(1.0 + delta * 1.8); // Expand smoke
      p.material.opacity = (1.0 - progress) * 0.45;
    });
  }
}

// Global export
window.EnvironmentEngine = EnvironmentEngine;
