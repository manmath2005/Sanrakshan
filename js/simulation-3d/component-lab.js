/**
 * Guardian 3D Simulation - Exploded CAD View & Interactive Component Laboratory
 * Handles smooth exploded-assembly animations, 3D raycasting/click inspection,
 * and comprehensive working-principle diagnostic modals with live controls.
 */

class ComponentLab {
  constructor(scene, camera, helmetAssembly, audioSynth) {
    this.scene = scene;
    this.camera = camera;
    this.helmet = helmetAssembly;
    this.audioSynth = audioSynth;

    this.explosionProgress = 0; // 0.0 (Assembled) to 1.0 (Fully Exploded)
    this.targetExplosion = 0;
    this.isExploded = false;

    // Raycaster for 3D clicks
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.interactiveObjects = [];
    this.hoveredObject = null;

    // Component Exploded Offset Vectors
    this.explodedOffsets = {
      shell: new THREE.Vector3(0, 0.75, 0.1),
      visor: new THREE.Vector3(0, 0.65, -0.25),
      liner: new THREE.Vector3(0, -0.45, 0),
      esp32: new THREE.Vector3(0, 0.28, 0.48),
      mq3: new THREE.Vector3(0, -0.22, -0.48),
      mpu6050: new THREE.Vector3(0, 0.52, 0.05),
      irSensor: new THREE.Vector3(0, 0.15, -0.52),
      relay: new THREE.Vector3(-0.48, 0.18, 0.18),
      powerUnit: new THREE.Vector3(0.48, 0.18, 0.18)
    };

    // Store initial positions
    this.initPositions();
    this.setupLeadLines();
    this.setupRaycasting();
  }

  initPositions() {
    if (!this.helmet) return;
    this.initialTransforms = {
      shellPos: this.helmet.shellGroup.position.clone(),
      visorPos: this.helmet.visorGroup.position.clone(),
      visorRot: this.helmet.visorGroup.rotation.clone(),
      linerPos: this.helmet.linerGroup.position.clone()
    };

    // Store component initial positions
    Object.keys(this.helmet.components).forEach((key) => {
      const comp = this.helmet.components[key];
      comp.userData.initialPos = comp.position.clone();
      this.interactiveObjects.push(comp.children[0]); // Push the PCB mesh for raycasting
    });
  }

  setupLeadLines() {
    this.leadLinesGroup = new THREE.Group();
    this.leadLinesGroup.name = 'CADLeadLines';
    this.leadLines = [];

    const lineMat = new THREE.LineDashedMaterial({
      color: 0x38bdf8,
      dashSize: 0.04,
      gapSize: 0.02,
      transparent: true,
      opacity: 0.65
    });

    Object.keys(this.helmet.components).forEach((key) => {
      const comp = this.helmet.components[key];
      const geo = new THREE.BufferGeometry().setFromPoints([
        comp.userData.initialPos,
        comp.userData.initialPos.clone().add(this.explodedOffsets[key])
      ]);
      const line = new THREE.Line(geo, lineMat.clone());
      line.computeLineDistances();
      line.visible = false;
      this.leadLinesGroup.add(line);
      this.leadLines.push({ line, comp, key });
    });

    this.helmet.add(this.leadLinesGroup);
  }

  setupRaycasting() {
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.checkHover();
    });

    window.addEventListener('click', (e) => {
      // Ignore if clicking on UI panels
      if (e.target.closest('#hud-container') || e.target.closest('#component-modal') || e.target.closest('#control-dock')) {
        return;
      }
      this.checkClick();
    });
  }

  checkHover() {
    if (this.explosionProgress < 0.2) return;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects);

    const tooltip = document.getElementById('cad-tooltip');
    if (intersects.length > 0) {
      const hit = intersects[0].object;
      document.body.style.cursor = 'pointer';
      if (tooltip) {
        tooltip.style.display = 'block';
        tooltip.style.left = `${(this.mouse.x + 1) * 0.5 * window.innerWidth + 15}px`;
        tooltip.style.top = `${(-this.mouse.y + 1) * 0.5 * window.innerHeight - 30}px`;
        tooltip.innerHTML = `<strong>${hit.userData.name}</strong><br><span style="font-size:10px; color:#38bdf8;">Click to Inspect & Run Live</span>`;
      }
    } else {
      document.body.style.cursor = 'default';
      if (tooltip) tooltip.style.display = 'none';
    }
  }

  checkClick() {
    if (this.explosionProgress < 0.2) return;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.interactiveObjects);

    if (intersects.length > 0) {
      const hit = intersects[0].object;
      if (hit.userData && hit.userData.componentId) {
        this.openComponentModal(hit.userData.componentId);
      }
    }
  }

  /**
   * Toggles between Assembled (0.0) and Exploded CAD View (1.0)
   */
  toggleExplode() {
    this.isExploded = !this.isExploded;
    this.targetExplosion = this.isExploded ? 1.0 : 0.0;
    return this.isExploded;
  }

  setExplosionProgress(val) {
    this.targetExplosion = Math.max(0, Math.min(1, val));
    this.isExploded = this.targetExplosion > 0.05;
  }

  /**
   * Smoothly interpolates the exploded parts each frame
   */
  update(delta) {
    if (!this.helmet) return;
    this.explosionProgress = THREE.MathUtils.lerp(this.explosionProgress, this.targetExplosion, delta * 5.0);

    const p = this.explosionProgress;

    // 1. Move Outer Shell
    this.helmet.shellGroup.position.lerpVectors(
      this.initialTransforms.shellPos,
      this.initialTransforms.shellPos.clone().add(this.explodedOffsets.shell),
      p
    );

    // 2. Lift & Open Visor
    this.helmet.visorGroup.position.lerpVectors(
      this.initialTransforms.visorPos,
      this.initialTransforms.visorPos.clone().add(this.explodedOffsets.visor),
      p
    );
    this.helmet.visorGroup.rotation.x = THREE.MathUtils.lerp(
      this.initialTransforms.visorRot.x,
      this.initialTransforms.visorRot.x - 0.65,
      p
    );

    // 3. Lower Inner Liner
    this.helmet.linerGroup.position.lerpVectors(
      this.initialTransforms.linerPos,
      this.initialTransforms.linerPos.clone().add(this.explodedOffsets.liner),
      p
    );

    // 4. Displace Electronics Radially Outward
    Object.keys(this.helmet.components).forEach((key) => {
      const comp = this.helmet.components[key];
      const offset = this.explodedOffsets[key];
      comp.position.lerpVectors(
        comp.userData.initialPos,
        comp.userData.initialPos.clone().add(offset),
        p
      );

      // Animate hotspot ring scale & pulse
      const ring = comp.getObjectByName('HotspotRing');
      if (ring) {
        ring.visible = p > 0.15;
        const scale = 1.0 + Math.sin(Date.now() * 0.006) * 0.15;
        ring.scale.set(scale, scale, scale);
      }
    });

    // 5. Update Laser Lead Lines
    this.leadLines.forEach(({ line, comp, key }) => {
      line.visible = p > 0.25;
      const points = [comp.userData.initialPos, comp.position];
      line.geometry.setFromPoints(points);
      line.computeLineDistances();
      line.material.opacity = p * 0.65;
    });
  }

  /**
   * Opens the Interactive Working-Principle Lab Modal for the selected component
   */
  openComponentModal(componentId) {
    const modal = document.getElementById('component-modal');
    if (!modal) return;

    const data = this.getComponentData(componentId);
    if (!data) return;

    modal.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <div class="flex items-center gap-3">
            <div class="icon-chip ${data.badgeColor}"><i class="${data.icon}"></i></div>
            <div>
              <h3 class="text-lg font-black text-white">${data.title}</h3>
              <p class="text-xs text-cyan-400 font-mono">${data.subtitle} | Pinout: ${data.pinout}</p>
            </div>
          </div>
          <button id="close-modal-btn" class="close-btn"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="modal-body">
          <!-- Role & Overview -->
          <div class="section-box">
            <h4 class="text-xs uppercase font-bold text-slate-400 mb-1">🎯 Purpose in Guardian System</h4>
            <p class="text-xs text-slate-200 leading-relaxed">${data.role}</p>
          </div>

          <!-- Working Principle Diagram -->
          <div class="section-box">
            <h4 class="text-xs uppercase font-bold text-cyan-400 mb-2">💡 Microscopic Working Principle & Physics</h4>
            <div class="diagram-canvas-container">
              ${data.diagramHtml}
            </div>
            <p class="text-[11px] text-slate-300 mt-2 italic">${data.principleText}</p>
          </div>

          <!-- Live Interactive Control Workbench -->
          <div class="section-box workbench-box">
            <h4 class="text-xs uppercase font-bold text-emerald-400 mb-2">🎮 Live Interactive Workbench ("Run Component")</h4>
            ${data.workbenchHtml}
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    // Hook Close Button
    document.getElementById('close-modal-btn').onclick = () => {
      modal.style.display = 'none';
    };

    // Attach Interactive Event Handlers
    data.attachListeners(this);
  }

  /**
   * Database of Component Specifications, Diagrams, and Interactive Lab Handlers
   */
  getComponentData(id) {
    const app = window.guardianApp;

    switch (id) {
      case 'MQ3_SENSOR':
        return {
          title: 'MQ-3 Alcohol Breathalyzer Sensor',
          subtitle: 'Tin Dioxide (SnO2) Semiconductor Gas Sensor',
          pinout: 'Analog AO -> GPIO 34 (ADC1_CH6), 5V VCC, GND',
          icon: 'fa-solid fa-wind',
          badgeColor: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
          role: 'Samples the rider\'s breath inside the helmet chin guard before ignition is authorized. If breath alcohol exceeds the legal safety limit (ADC >= 800), the bike\'s starter relay remains immobilized.',
          principleText: 'The internal heater maintains the SnO2 ceramic cylinder at 200°C. In fresh air, oxygen ions trap free conduction electrons, creating high electrical resistance. When ethanol vapor (CH3CH2OH) molecules hit the hot surface, they oxidize, returning electrons to the semiconductor lattice and causing a sharp drop in electrical resistance (ΔRs < 0), which raises the output voltage.',
          diagramHtml: `
            <div class="flex items-center justify-between p-3 bg-slate-900 rounded-lg text-center text-xs">
              <div class="p-2 border border-slate-700 rounded bg-slate-950">
                <span class="text-blue-400 font-bold">1. Clean Air</span><br>
                <span class="text-[10px] text-slate-400">High Rs (~200kΩ)<br>Vout &lt; 0.6V (Sober)</span>
              </div>
              <i class="fa-solid fa-arrow-right text-slate-500"></i>
              <div class="p-2 border border-amber-600 rounded bg-amber-950/40">
                <span class="text-amber-400 font-bold">2. Ethanol Vapor</span><br>
                <span class="text-[10px] text-slate-400">O2- ions consumed<br>Electrons Released</span>
              </div>
              <i class="fa-solid fa-arrow-right text-slate-500"></i>
              <div class="p-2 border border-red-600 rounded bg-red-950/40">
                <span class="text-red-400 font-bold">3. Ignition Lock</span><br>
                <span class="text-[10px] text-slate-400">Low Rs (~15kΩ)<br>ADC &gt;= 800 (Drunk!)</span>
              </div>
            </div>
          `,
          workbenchHtml: `
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-300">Simulate Alcohol BAC Level:</span>
                <span id="bac-val-display" class="font-mono font-bold text-emerald-400">180 ADC (Sober)</span>
              </div>
              <input type="range" id="bac-slider" min="100" max="2200" value="${app ? app.alcoholADC : 180}" class="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400">
              <div class="flex gap-2">
                <button id="btn-blow-sober" class="flex-1 py-1.5 px-3 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-xs font-semibold border border-emerald-500/40">Blow Fresh Air (210 ADC)</button>
                <button id="btn-blow-drunk" class="flex-1 py-1.5 px-3 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 text-xs font-semibold border border-rose-500/40">Simulate Intoxicated (1650 ADC)</button>
              </div>
            </div>
          `,
          attachListeners: () => {
            const slider = document.getElementById('bac-slider');
            const display = document.getElementById('bac-val-display');
            const update = (val) => {
              val = parseInt(val);
              display.innerText = `${val} ADC (${val >= 800 ? 'DRUNK 🛑' : 'SOBER 🟢'})`;
              display.className = `font-mono font-bold ${val >= 800 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`;
              if (window.guardianApp) window.guardianApp.setAlcoholADC(val);
            };
            slider.oninput = (e) => update(e.target.value);
            document.getElementById('btn-blow-sober').onclick = () => { slider.value = 210; update(210); };
            document.getElementById('btn-blow-drunk').onclick = () => { slider.value = 1650; update(1650); };
          }
        };

      case 'MPU6050_IMU':
        return {
          title: 'GY-521 MPU-6050 6-Axis Inertial Measurement Unit',
          subtitle: 'MEMS 3-Axis Accelerometer + 3-Axis Gyroscope',
          pinout: 'I2C Interface: SDA -> GPIO 21, SCL -> GPIO 22, 3.3V, GND',
          icon: 'fa-solid fa-microchip',
          badgeColor: 'bg-blue-500/20 text-blue-400 border border-blue-500/40',
          role: 'Continuously measures vehicle and rider dynamics at 100Hz. Computes the vector magnitude G = √(ax² + ay² + az²). An impact spike >= 4.0G triggers an immediate zero-delay emergency SOS call and single-part SMS broadcast.',
          principleText: 'Micro-Electro-Mechanical Systems (MEMS) proof-masses are suspended on microscopic silicon springs. When an impact shock or tilt occurs, the mass deflects along X, Y, or Z, changing the differential capacitance (ΔC) between internal combs. An integrated 16-bit ADC digitizes this into gravitational acceleration (g).',
          diagramHtml: `
            <div class="grid grid-cols-3 gap-2 p-2 bg-slate-900 rounded-lg text-center text-xs">
              <div class="p-2 border border-slate-700 rounded bg-slate-950">
                <span class="text-blue-400 font-bold">X-Axis</span><br>
                <span class="text-[10px] text-slate-400">Lateral Bank / Roll</span>
              </div>
              <div class="p-2 border border-slate-700 rounded bg-slate-950">
                <span class="text-emerald-400 font-bold">Y-Axis</span><br>
                <span class="text-[10px] text-slate-400">Gravity Vector (1.0G)</span>
              </div>
              <div class="p-2 border border-slate-700 rounded bg-slate-950">
                <span class="text-purple-400 font-bold">Z-Axis</span><br>
                <span class="text-[10px] text-slate-400">Throttle / Braking</span>
              </div>
            </div>
          `,
          workbenchHtml: `
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-xs text-slate-300">Live Resultant G-Force:</span>
                <span id="imu-val-display" class="font-mono font-bold text-cyan-400">1.02 G</span>
              </div>
              <div class="flex gap-2">
                <button id="btn-bump-test" class="flex-1 py-2 px-3 rounded bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 text-xs font-semibold border border-amber-500/40">Road Bump (2.6G)</button>
                <button id="btn-crash-test" class="flex-1 py-2 px-3 rounded bg-rose-600/40 hover:bg-rose-600/60 text-rose-300 text-xs font-semibold border border-rose-500/50">💥 Crash Impact (4.8G SOS!)</button>
              </div>
            </div>
          `,
          attachListeners: () => {
            document.getElementById('btn-bump-test').onclick = () => {
              if (window.guardianApp) window.guardianApp.triggerBump();
              document.getElementById('imu-val-display').innerText = '2.65 G (Moderate Shock)';
            };
            document.getElementById('btn-crash-test').onclick = () => {
              if (window.guardianApp) window.guardianApp.triggerCrash();
              document.getElementById('imu-val-display').innerText = '4.82 G (ACCIDENT DETECTED!)';
              document.getElementById('imu-val-display').className = 'font-mono font-bold text-rose-400 animate-pulse';
            };
          }
        };

      case 'IR_WEAR_SENSOR':
        return {
          title: 'TCRT5000 Optical Infrared Proximity Wear Sensor',
          subtitle: '950nm IR Diode Emitter + Phototransistor Receiver',
          pinout: 'Digital DO -> GPIO 13 (INPUT_PULLUP: LOW = Worn), 5V, GND',
          icon: 'fa-solid fa-eye',
          badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
          role: 'Ensures the rider has physically worn and fastened the helmet on their head before the bike engine can be started. Prevents riders from hanging the helmet on the mirror or carrying it in hand.',
          principleText: 'The gallium arsenide IR diode emits a focused invisible 950nm beam into the inner crown. When worn, the human scalp/hair reflects the beam back into the phototransistor. An onboard LM393 comparator detects when reflected current surpasses the reference threshold, dropping the output to clean logic LOW (0V).',
          diagramHtml: `
            <div class="flex items-center justify-around p-3 bg-slate-900 rounded-lg text-center text-xs">
              <div class="p-2 border border-slate-700 rounded bg-slate-950">
                <span class="text-rose-400 font-bold">Helmet Off</span><br>
                <span class="text-[10px] text-slate-400">Beam Dissipates<br>Logic HIGH (3.3V) -> LOCKED</span>
              </div>
              <i class="fa-solid fa-arrows-left-right text-slate-500"></i>
              <div class="p-2 border border-emerald-600 rounded bg-emerald-950/40">
                <span class="text-emerald-400 font-bold">Helmet Worn</span><br>
                <span class="text-[10px] text-slate-400">Scalp Reflects Beam<br>Logic LOW (0V) -> READY</span>
              </div>
            </div>
          `,
          workbenchHtml: `
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-300">Current Helmet Status:</span>
              <span id="ir-val-display" class="font-mono font-bold text-cyan-400">WORN [OK]</span>
            </div>
            <button id="btn-toggle-wear" class="w-full py-2 px-4 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all">
              <i class="fa-solid fa-helmet-safety mr-1"></i> Toggle Helmet Wear Status
            </button>
          `,
          attachListeners: () => {
            const btn = document.getElementById('btn-toggle-wear');
            const display = document.getElementById('ir-val-display');
            btn.onclick = () => {
              if (window.guardianApp) {
                const worn = window.guardianApp.toggleHelmetWear();
                display.innerText = worn ? 'WORN [OK]' : 'REMOVED [LOCKED]';
                display.className = `font-mono font-bold ${worn ? 'text-emerald-400' : 'text-rose-400'}`;
              }
            };
          }
        };

      case 'RELAY_MODULE':
        return {
          title: '5V Optocoupler-Isolated Ignition Interlock Relay',
          subtitle: 'Songle SRD-05VDC-SL-C High-Current Switch',
          pinout: 'Control IN -> GPIO 18 (Active HIGH), 10A 250VAC / 30VDC Rating',
          icon: 'fa-solid fa-toggle-on',
          badgeColor: 'bg-purple-500/20 text-purple-400 border border-purple-500/40',
          role: 'Acts as the motorcycle\'s electronic starter cut-off. Galvanically isolates the delicate 3.3V ESP32 microcontroller from the noisy 12V motorcycle starter and ignition coil circuit.',
          principleText: 'When GPIO 18 outputs logic HIGH, an internal infrared LED lights up inside an optical isolator chip (PC817). This conducts a photo-transistor that energizes a 5V electromagnetic coil. The magnetic field overcomes a spring to pull an iron armature, connecting Common (COM) to Normally Open (NO) and enabling the motorcycle starter motor.',
          diagramHtml: `
            <div class="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg text-center text-xs">
              <div class="p-2 border border-slate-700 rounded bg-slate-950">
                <span class="text-blue-400 font-bold">ESP32 GPIO 18</span><br>
                <span class="text-[10px] text-slate-400">3.3V Logic Signal</span>
              </div>
              <i class="fa-solid fa-arrow-right text-slate-500"></i>
              <div class="p-2 border border-purple-700 rounded bg-purple-950/40">
                <span class="text-purple-400 font-bold">Optocoupler</span><br>
                <span class="text-[10px] text-slate-400">Galvanic Isolation</span>
              </div>
              <i class="fa-solid fa-arrow-right text-slate-500"></i>
              <div class="p-2 border border-emerald-700 rounded bg-emerald-950/40">
                <span class="text-emerald-400 font-bold">10A Relay Coil</span><br>
                <span class="text-[10px] text-slate-400">12V Starter Enabled</span>
              </div>
            </div>
          `,
          workbenchHtml: `
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-300">Relay Armature State:</span>
              <span id="relay-state-display" class="font-mono font-bold text-rose-400">LOCKED (COM-NC)</span>
            </div>
            <button id="btn-test-relay" class="w-full py-2 px-4 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-all">
              <i class="fa-solid fa-bolt mr-1"></i> Test Manual Interlock Click
            </button>
          `,
          attachListeners: (lab) => {
            document.getElementById('btn-test-relay').onclick = () => {
              const display = document.getElementById('relay-state-display');
              const isLocked = display.innerText.includes('LOCKED');
              display.innerText = isLocked ? 'CLOSED / ENGAGED (COM-NO) ⚡' : 'LOCKED (COM-NC)';
              display.className = `font-mono font-bold ${isLocked ? 'text-emerald-400' : 'text-rose-400'}`;
              if (lab.audioSynth) lab.audioSynth.playRelayClick(isLocked);
            };
          }
        };

      case 'ESP32_MCU':
        return {
          title: 'ESP32 DevKit V1 (30-Pin Dual-Core MCU)',
          subtitle: 'Xtensa Dual-Core 240MHz + Wi-Fi & Bluetooth 4.2 BLE',
          pinout: 'Core Sensor Hub (34, 13, 21, 22, 18, 19, 4)',
          icon: 'fa-solid fa-brain',
          badgeColor: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40',
          role: 'Master microcontroller. Core 0 samples helmet sensors (alcohol, wear, G-forces) at high frequency. Core 1 transmits ESP-NOW packets (<20ms latency) to the bike receiver and maintains Bluetooth Low Energy GATT notifications to the smartphone.',
          principleText: 'Executes parallel FreeRTOS tasks across two hardware cores. Packets are dispatched over ESP-NOW using raw 802.11 vendor-specific action frames, avoiding the multi-second overhead of classic Wi-Fi handshakes.',
          diagramHtml: `
            <div class="p-2.5 bg-slate-900 rounded-lg text-xs font-mono text-cyan-300 space-y-1">
              <div>// Live Outgoing JSON Telemetry Packet:</div>
              <div class="text-emerald-400 bg-slate-950 p-2 rounded border border-slate-800">
                {"helmet": true, "alcohol": 210, "gForce": 1.02, "crash": false}
              </div>
            </div>
          `,
          workbenchHtml: `
            <div class="text-xs text-slate-300">Wireless Telemetry Latency: <span class="font-mono text-emerald-400 font-bold">&lt; 18ms (ESP-NOW)</span></div>
            <div class="text-[11px] text-slate-400 mt-1">BLE Advertisement: <span class="font-mono text-cyan-400">"Guardian_Helmet" (GATT Server Active)</span></div>
          `,
          attachListeners: () => {}
        };

      case 'POWER_MODULE':
        return {
          title: '18650 Li-ion Battery & TP4056 Power Unit',
          subtitle: '3.7V 2600mAh Cell + MT3608 5V Step-Up Booster',
          pinout: 'Regulated 5.0V output to MQ-3 Heater and ESP32 VIN',
          icon: 'fa-solid fa-battery-full',
          badgeColor: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
          role: 'Provides independent, reliable wearable power for the helmet. The MT3608 boost converter steps up 3.7V to a stable 5.0V needed to run the MQ-3 heating element without loading the bike battery.',
          principleText: 'The TP4056 charges the Li-ion cell via USB-C using a Constant-Current/Constant-Voltage (CC/CV) algorithm. An onboard DW01A protection IC prevents over-discharge below 2.4V and cuts current on short circuits.',
          diagramHtml: `
            <div class="flex items-center justify-between p-2.5 bg-slate-900 rounded-lg text-center text-xs">
              <div class="p-2 border border-slate-700 rounded bg-slate-950">
                <span class="text-cyan-400 font-bold">18650 Cell</span><br>
                <span class="text-[10px] text-slate-400">3.7V Nominal</span>
              </div>
              <i class="fa-solid fa-arrow-right text-slate-500"></i>
              <div class="p-2 border border-emerald-700 rounded bg-emerald-950/40">
                <span class="text-emerald-400 font-bold">MT3608 Booster</span><br>
                <span class="text-[10px] text-slate-400">1.2MHz DC-DC</span>
              </div>
              <i class="fa-solid fa-arrow-right text-slate-500"></i>
              <div class="p-2 border border-blue-700 rounded bg-blue-950/40">
                <span class="text-blue-400 font-bold">Regulated 5.0V</span><br>
                <span class="text-[10px] text-slate-400">To MQ-3 & MCU</span>
              </div>
            </div>
          `,
          workbenchHtml: `
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-300">Battery Level:</span>
              <span class="font-mono font-bold text-emerald-400">94% (4.12V)</span>
            </div>
            <div class="w-full bg-slate-800 rounded-full h-2.5">
              <div class="bg-emerald-500 h-2.5 rounded-full" style="width: 94%"></div>
            </div>
          `,
          attachListeners: () => {}
        };

      default:
        return null;
    }
  }
}

// Global export
window.ComponentLab = ComponentLab;
