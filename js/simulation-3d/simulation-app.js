/**
 * Guardian 3D Simulation - Master Application Orchestrator
 * Connects WebGL Rendering, Camera Presets, Physics Engine, Web Audio Synth,
 * Exploded CAD Inspector, and Safety Interlock State Machine.
 */

class SimulationApp {
  constructor() {
    this.container = document.getElementById('canvas-container');

    // State Variables
    this.helmetWorn = false;
    this.alcoholADC = 195; // Default sober
    this.isIgnitionUnlocked = false;
    this.isEngineRunning = false;
    this.currentCameraMode = 'RIDE'; // 'RIDE', 'HELMET', 'CAD'

    // Timing
    this.clock = new THREE.Clock();

    this.initScene();
    this.initEntities();
    this.initControls();
    this.initUI();

    // Start Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initScene() {
    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x030712, 0.012);

    this.camera = new THREE.PerspectiveCamera(
      55,
      window.innerWidth / window.innerHeight,
      0.1,
      400
    );
    this.camera.position.set(0, 3.2, 7.5);

    // 2. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 3. OrbitControls
    this.orbit = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.05;
    this.orbit.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below road
    this.orbit.minDistance = 1.0;
    this.orbit.maxDistance = 35.0;

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x93c5fd, 1.2);
    dirLight.position.set(15, 25, 15);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    // Window Resize Handler
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  initEntities() {
    this.modelBuilder = new CADModelBuilder();

    // 1. Build Motorcycle
    this.bike = this.modelBuilder.buildMotorcycle();
    this.scene.add(this.bike);

    // 2. Build Rider Avatar
    this.rider = this.modelBuilder.buildRider();
    this.bike.add(this.rider);

    // 3. Build Smart Helmet Assembly
    this.smartHelmet = this.modelBuilder.buildSmartHelmet();
    // Mount directly to rider's head anchor
    this.rider.headAnchor.add(this.smartHelmet);

    // 4. Audio Synthesizer
    this.audioSynth = new AudioSynthesizer();

    // 5. Physics Engine
    this.physics = new BikePhysicsEngine();

    // 6. Environment Highway
    this.environment = new EnvironmentEngine(this.scene);

    // 7. Component Lab (Exploded CAD Inspector)
    this.componentLab = new ComponentLab(this.scene, this.camera, this.smartHelmet, this.audioSynth);

    // Store global reference for modal listeners
    window.guardianApp = this;
  }

  initControls() {
    // Keyboard Event Handlers
    window.addEventListener('keydown', (e) => {
      // Audio unlock on first keypress
      this.audioSynth.resumeContext();

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.physics.inputs.throttle = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          this.physics.inputs.brake = true;
          this.audioSynth.setBrakeScreech(this.physics.speed > 25);
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.physics.inputs.steerLeft = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.physics.inputs.steerRight = true;
          break;
        case 'Space':
          this.physics.inputs.brake = true;
          this.audioSynth.setBrakeScreech(this.physics.speed > 15);
          break;
        case 'KeyH':
          this.audioSynth.startHorn();
          break;
      }
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          this.physics.inputs.throttle = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
        case 'Space':
          this.physics.inputs.brake = false;
          this.audioSynth.setBrakeScreech(false);
          break;
        case 'KeyA':
        case 'ArrowLeft':
          this.physics.inputs.steerLeft = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          this.physics.inputs.steerRight = false;
          break;
        case 'KeyH':
          this.audioSynth.stopHorn();
          break;
      }
    });
  }

  initUI() {
    // 1. Camera View Mode Buttons
    document.getElementById('btn-cam-ride').onclick = () => this.setCameraMode('RIDE');
    document.getElementById('btn-cam-helmet').onclick = () => this.setCameraMode('HELMET');
    document.getElementById('btn-cam-cad').onclick = () => this.setCameraMode('CAD');

    // 2. Pre-Ride Safety Interlock Buttons
    document.getElementById('btn-wear-helmet').onclick = () => this.toggleHelmetWear();
    document.getElementById('btn-blow-alcohol').onclick = () => this.promptAlcoholTest();
    document.getElementById('btn-start-engine').onclick = () => this.toggleEngineStart();
    document.getElementById('btn-sim-crash').onclick = () => this.triggerCrash();

    // 3. Audio Mute Button
    document.getElementById('btn-toggle-audio').onclick = () => {
      const isMuted = this.audioSynth.toggleMute();
      const icon = document.getElementById('audio-icon');
      icon.className = isMuted ? 'fa-solid fa-volume-xmark text-rose-400' : 'fa-solid fa-volume-high text-cyan-400';
    };

    // 4. CAD Explosion Slider
    const cadSlider = document.getElementById('cad-explode-slider');
    if (cadSlider) {
      cadSlider.oninput = (e) => {
        this.setCameraMode('CAD');
        this.componentLab.setExplosionProgress(parseFloat(e.target.value) / 100);
      };
    }

    // 5. On-Screen Driving Controls (for Mobile & Mouse)
    const setupHoldBtn = (id, onDown, onUp) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('mousedown', onDown);
      el.addEventListener('mouseup', onUp);
      el.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); });
      el.addEventListener('touchend', (e) => { e.preventDefault(); onUp(); });
    };

    setupHoldBtn('btn-drive-throttle', () => { this.physics.inputs.throttle = true; }, () => { this.physics.inputs.throttle = false; });
    setupHoldBtn('btn-drive-brake', () => { this.physics.inputs.brake = true; }, () => { this.physics.inputs.brake = false; });
    setupHoldBtn('btn-drive-left', () => { this.physics.inputs.steerLeft = true; }, () => { this.physics.inputs.steerLeft = false; });
    setupHoldBtn('btn-drive-right', () => { this.physics.inputs.steerRight = true; }, () => { this.physics.inputs.steerRight = false; });

    this.updateHUD();
  }

  /**
   * Switches Camera Viewpoints & Modes
   */
  setCameraMode(mode) {
    this.currentCameraMode = mode;
    const btnRide = document.getElementById('btn-cam-ride');
    const btnHelmet = document.getElementById('btn-cam-helmet');
    const btnCad = document.getElementById('btn-cam-cad');
    const cadControls = document.getElementById('cad-controls-panel');

    [btnRide, btnHelmet, btnCad].forEach(b => b.classList.remove('active-tab'));

    if (mode === 'RIDE') {
      btnRide.classList.add('active-tab');
      if (cadControls) cadControls.style.display = 'none';
      this.componentLab.setExplosionProgress(0);
      this.targetCameraPos = new THREE.Vector3(0, 3.2, 7.5);
      this.targetLookAt = new THREE.Vector3(0, 1.2, 0);
    } else if (mode === 'HELMET') {
      btnHelmet.classList.add('active-tab');
      if (cadControls) cadControls.style.display = 'none';
      this.componentLab.setExplosionProgress(0);
      this.targetCameraPos = new THREE.Vector3(0, 2.05, 1.45);
      this.targetLookAt = new THREE.Vector3(0, 1.95, 0.2);
    } else if (mode === 'CAD') {
      btnCad.classList.add('active-tab');
      if (cadControls) cadControls.style.display = 'flex';
      this.componentLab.setExplosionProgress(1.0);
      const slider = document.getElementById('cad-explode-slider');
      if (slider) slider.value = 100;
      this.targetCameraPos = new THREE.Vector3(1.2, 2.4, 1.8);
      this.targetLookAt = new THREE.Vector3(0, 2.0, 0.2);
    }
  }

  /**
   * Pre-Ride Safety Logic: Helmet Wear Check
   */
  toggleHelmetWear() {
    this.helmetWorn = !this.helmetWorn;
    const btn = document.getElementById('btn-wear-helmet');
    btn.innerHTML = this.helmetWorn
      ? '<i class="fa-solid fa-check text-emerald-400"></i> Helmet Worn [OK]'
      : '<i class="fa-solid fa-helmet-safety"></i> Put On Helmet';

    this.evaluateIgnition();
    return this.helmetWorn;
  }

  setAlcoholADC(adcVal) {
    this.alcoholADC = adcVal;
    this.evaluateIgnition();
  }

  promptAlcoholTest() {
    const isSober = this.alcoholADC < 800;
    this.setAlcoholADC(isSober ? 1450 : 210);
  }

  /**
   * Three-Tier Safety Interlock Decision
   */
  evaluateIgnition() {
    const isSober = this.alcoholADC < 800;
    const wasUnlocked = this.isIgnitionUnlocked;

    this.isIgnitionUnlocked = this.helmetWorn && isSober && !this.physics.isCrashed;
    this.physics.isIgnitionUnlocked = this.isIgnitionUnlocked;

    if (wasUnlocked !== this.isIgnitionUnlocked) {
      this.audioSynth.playRelayClick(this.isIgnitionUnlocked);
      if (!this.isIgnitionUnlocked && this.isEngineRunning) {
        // Cut engine immediately if helmet is taken off while riding!
        this.toggleEngineStart(false);
      }
    }

    this.updateHUD();
  }

  toggleEngineStart(forceState = null) {
    if (!this.isIgnitionUnlocked && forceState !== false) {
      alert("⚠️ IGNITION LOCKED!\nRider must wear the smart helmet AND pass breath alcohol verification before engine can start.");
      return;
    }

    this.isEngineRunning = forceState !== null ? forceState : !this.isEngineRunning;
    this.physics.isEngineRunning = this.isEngineRunning;

    const btn = document.getElementById('btn-start-engine');
    if (this.isEngineRunning) {
      this.audioSynth.startEngine();
      btn.innerHTML = '<i class="fa-solid fa-power-off text-emerald-400"></i> Engine Running [ON]';
      btn.classList.add('btn-active');
    } else {
      this.audioSynth.stopEngine();
      btn.innerHTML = '<i class="fa-solid fa-power-off"></i> Start Engine';
      btn.classList.remove('btn-active');
    }

    this.updateHUD();
  }

  /**
   * Triggers a simulated road accident / crash impact
   */
  triggerCrash() {
    this.physics.triggerCrash();
    this.audioSynth.stopEngine();
    this.audioSynth.setAlarmBuzzer(true);
    this.evaluateIgnition();

    // Show Emergency SOS Escalation Modal
    const sosModal = document.getElementById('sos-alert-modal');
    if (sosModal) {
      sosModal.style.display = 'flex';
      let countdown = 3;
      const cdElem = document.getElementById('sos-countdown');
      if (cdElem) cdElem.innerText = countdown;

      const timer = setInterval(() => {
        countdown--;
        if (cdElem) cdElem.innerText = countdown;
        if (countdown <= 0) {
          clearInterval(timer);
          document.getElementById('sos-status-text').innerHTML = `
            <span class="text-rose-400 font-bold">🚨 4.82G CRASH CONFIRMED!</span><br>
            📞 Auto-dialed Primary Contact: <strong>Dr. Sharma (+91 98765 43210)</strong><br>
            📩 Single-Part SOS SMS Dispatched with Pune GPS Coordinates!
          `;
        }
      }, 1000);

      document.getElementById('btn-abort-sos').onclick = () => {
        clearInterval(timer);
        sosModal.style.display = 'none';
        this.audioSynth.setAlarmBuzzer(false);
        this.physics.reset();
        this.updateHUD();
      };
    }
  }

  triggerBump() {
    this.physics.gForce.total = 2.65;
    setTimeout(() => { this.physics.gForce.total = 1.02; }, 600);
  }

  /**
   * Updates HUD speed, RPM, G-Force, and status badges
   */
  updateHUD() {
    const speedEl = document.getElementById('hud-speed-val');
    const rpmEl = document.getElementById('hud-rpm-val');
    const gearEl = document.getElementById('hud-gear-val');
    const gforceEl = document.getElementById('hud-gforce-val');
    const helmetBadge = document.getElementById('badge-helmet-status');
    const alcoholBadge = document.getElementById('badge-alcohol-status');
    const relayBadge = document.getElementById('badge-relay-status');

    if (speedEl) speedEl.innerText = Math.round(this.physics.speed);
    if (rpmEl) rpmEl.innerText = Math.round(this.physics.rpm);
    if (gearEl) gearEl.innerText = this.physics.gear === 0 ? 'N' : this.physics.gear;
    if (gforceEl) gforceEl.innerText = `${this.physics.gForce.total.toFixed(2)} G`;

    // Speedometer Needle Rotation (-120deg to +120deg)
    const needle = document.getElementById('speedo-needle');
    if (needle) {
      const deg = -120 + (this.physics.speed / 130) * 240;
      needle.style.transform = `rotate(${deg}deg)`;
    }

    if (helmetBadge) {
      helmetBadge.innerHTML = this.helmetWorn
        ? '<span class="status-dot green"></span> HELMET: WORN [OK]'
        : '<span class="status-dot red"></span> HELMET: OFF [LOCK]';
    }

    if (alcoholBadge) {
      const isSober = this.alcoholADC < 800;
      alcoholBadge.innerHTML = isSober
        ? `<span class="status-dot green"></span> ALCOHOL: SOBER (${this.alcoholADC})`
        : `<span class="status-dot red"></span> ALCOHOL: DRUNK! (${this.alcoholADC})`;
    }

    if (relayBadge) {
      relayBadge.innerHTML = this.isIgnitionUnlocked
        ? '<span class="status-dot green"></span> RELAY: UNLOCKED 🟢'
        : '<span class="status-dot red"></span> RELAY: LOCKED 🛑';
    }
  }

  /**
   * Main Render Loop (60 FPS)
   */
  animate() {
    requestAnimationFrame(this.animate);
    const delta = Math.min(0.05, this.clock.getDelta());

    // 1. Update Physics
    this.physics.update(delta);

    // 2. Synchronize 3D Bike Mesh Transformations
    if (this.bike) {
      // Lateral highway lane position
      this.bike.position.x = this.physics.lateralPosition;
      this.bike.position.y = this.physics.suspensionOffset;

      // Realistic Banking Lean Angle (Z-axis rotation)
      this.bike.rotation.z = this.physics.leanAngle;

      // Handlebar Steering Angle (Y-axis rotation on front fork)
      if (this.bike.forkGroup) {
        this.bike.forkGroup.rotation.y = -this.physics.steeringAngle * 0.35;
      }

      // Wheel Spin Angular Velocity omega = v / r
      const wheelOmega = ((this.physics.speed * 1000) / 3600) / 0.42;
      if (this.bike.frontWheel) this.bike.frontWheel.rotation.x += wheelOmega * delta;
      if (this.bike.rearWheel) this.bike.rearWheel.rotation.x += wheelOmega * delta;
    }

    // 3. Update Audio Pitch by RPM
    if (this.audioSynth && this.isEngineRunning) {
      this.audioSynth.updateRPM(this.physics.rpm, this.physics.inputs.throttle ? 1 : 0);
    }

    // 4. Update Infinite Scrolling Highway & Particles
    if (this.environment) {
      const exhaustPos = this.bike.exhaustTip ? this.bike.exhaustTip.getWorldPosition(new THREE.Vector3()) : null;
      this.environment.update(delta, this.physics.speed, exhaustPos, this.physics.inputs.throttle ? 1 : 0);
    }

    // 5. Update Exploded CAD Component Lab
    if (this.componentLab) {
      this.componentLab.update(delta);
    }

    // 6. Camera Smooth Following
    if (this.targetCameraPos && this.currentCameraMode !== 'CAD') {
      this.camera.position.lerp(
        new THREE.Vector3(
          this.bike.position.x + this.targetCameraPos.x,
          this.targetCameraPos.y,
          this.targetCameraPos.z
        ),
        delta * 4.0
      );
      this.orbit.target.lerp(
        new THREE.Vector3(this.bike.position.x, this.targetLookAt.y, this.targetLookAt.z),
        delta * 5.0
      );
    }

    this.orbit.update();
    this.updateHUD();
    this.renderer.render(this.scene, this.camera);
  }
}

// Start app when DOM loads
window.addEventListener('DOMContentLoaded', () => {
  new SimulationApp();
});
