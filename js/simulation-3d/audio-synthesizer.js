/**
 * Guardian 3D Simulation - Pure Web Audio API Sound Synthesizer
 * Zero external audio files required. Synthesizes authentic 4-stroke motorcycle
 * acoustics, brake screech, horn, electromechanical relay clicks, and alarm buzzer.
 */

class AudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.isAudioReady = false;
    this.isMuted = false;

    // Engine Nodes
    this.engineMasterGain = null;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineThumpGain = null;
    this.enginePanner = null;
    this.isEngineRunning = false;

    // Brake screeches
    this.brakeGain = null;
    this.brakeFilter = null;
    this.noiseBuffer = null;

    // Horn nodes
    this.hornOsc1 = null;
    this.hornOsc2 = null;
    this.hornGain = null;

    // Buzzer nodes
    this.buzzerOsc = null;
    this.buzzerGain = null;
    this.buzzerInterval = null;
  }

  /**
   * Initializes the Web Audio context on the first user interaction
   */
  init() {
    if (this.isAudioReady) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();

      // Master Mute Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Generate White Noise Buffer for Brakes
      const bufferSize = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.isAudioReady = true;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  resumeContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.7, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  /**
   * Starts the 4-stroke engine acoustic synthesizer
   */
  startEngine() {
    if (!this.isAudioReady) this.init();
    this.resumeContext();
    if (!this.ctx || this.isEngineRunning) return;

    const t = this.ctx.currentTime;

    // Filter to simulate exhaust pipe acoustics
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(320, t);
    this.engineFilter.Q.setValueAtTime(3.5, t);

    this.engineMasterGain = this.ctx.createGain();
    this.engineMasterGain.gain.setValueAtTime(0.01, t);
    this.engineMasterGain.gain.exponentialRampToValueAtTime(0.45, t + 0.3);

    // Primary crankshaft oscillator (Sawtooth for mechanical grit)
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(28, t); // ~1100 RPM idle base

    // Secondary exhaust cylinder pop oscillator (Triangle wave)
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(14, t);

    // Sub-harmonic thump gain
    this.engineThumpGain = this.ctx.createGain();
    this.engineThumpGain.gain.setValueAtTime(0.6, t);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineThumpGain);
    this.engineThumpGain.connect(this.engineFilter);

    this.engineFilter.connect(this.engineMasterGain);
    this.engineMasterGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
    this.isEngineRunning = true;
  }

  /**
   * Modulates engine acoustics in real-time according to RPM & Throttle
   * @param {number} rpm - Current engine RPM (1100 to 8500)
   * @param {number} throttle - Throttle factor (0.0 to 1.0)
   */
  updateRPM(rpm, throttle = 0) {
    if (!this.isEngineRunning || !this.ctx) return;
    const t = this.ctx.currentTime;

    // Single-cylinder 4-stroke fires once every 2 crankshaft revolutions
    // Fundamental combustion frequency f = RPM / 120
    const baseFreq = Math.max(22, (rpm / 60) * 1.5);
    const filterFreq = 300 + (rpm / 8500) * 1200 + throttle * 400;
    const volume = 0.35 + throttle * 0.45;

    this.engineOsc1.frequency.setTargetAtTime(baseFreq, t, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.05);
    this.engineFilter.frequency.setTargetAtTime(filterFreq, t, 0.06);
    this.engineMasterGain.gain.setTargetAtTime(volume, t, 0.05);
  }

  /**
   * Cuts off the engine instantly (e.g. ignition relay tripped or crash)
   */
  stopEngine() {
    if (!this.isEngineRunning || !this.ctx) return;
    const t = this.ctx.currentTime;

    if (this.engineMasterGain) {
      this.engineMasterGain.gain.setValueAtTime(this.engineMasterGain.gain.value, t);
      this.engineMasterGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    }

    setTimeout(() => {
      try {
        if (this.engineOsc1) this.engineOsc1.stop();
        if (this.engineOsc2) this.engineOsc2.stop();
      } catch (e) {}
      this.isEngineRunning = false;
    }, 160);
  }

  /**
   * Synthesizes mechanical relay coil click (Starter interlock engage/disengage)
   * @param {boolean} isEngaged - true = Click ON, false = Click OFF
   */
  playRelayClick(isEngaged) {
    if (!this.isAudioReady) this.init();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isEngaged ? 920 : 680, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.035);

    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.05);
  }

  /**
   * Synthesizes disc brake friction screech
   * @param {boolean} active - whether brakes are currently locking
   */
  setBrakeScreech(active) {
    if (!this.isAudioReady || !this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime;

    if (active) {
      if (!this.brakeGain) {
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = this.noiseBuffer;
        noiseSource.loop = true;

        this.brakeFilter = this.ctx.createBiquadFilter();
        this.brakeFilter.type = 'bandpass';
        this.brakeFilter.frequency.setValueAtTime(3400, t);
        this.brakeFilter.Q.setValueAtTime(7.0, t);

        this.brakeGain = this.ctx.createGain();
        this.brakeGain.gain.setValueAtTime(0.01, t);
        this.brakeGain.gain.exponentialRampToValueAtTime(0.35, t + 0.1);

        noiseSource.connect(this.brakeFilter);
        this.brakeFilter.connect(this.brakeGain);
        this.brakeGain.connect(this.masterGain);

        noiseSource.start();
        this.brakeSource = noiseSource;
      }
    } else {
      if (this.brakeGain) {
        this.brakeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        setTimeout(() => {
          try {
            if (this.brakeSource) this.brakeSource.stop();
          } catch (e) {}
          this.brakeGain = null;
          this.brakeSource = null;
        }, 120);
      }
    }
  }

  /**
   * Dual-tone motorcycle warning horn
   */
  startHorn() {
    if (!this.isAudioReady) this.init();
    if (!this.ctx || this.hornGain) return;
    const t = this.ctx.currentTime;

    this.hornGain = this.ctx.createGain();
    this.hornGain.gain.setValueAtTime(0.3, t);

    this.hornOsc1 = this.ctx.createOscillator();
    this.hornOsc1.type = 'sawtooth';
    this.hornOsc1.frequency.setValueAtTime(425, t);

    this.hornOsc2 = this.ctx.createOscillator();
    this.hornOsc2.type = 'sawtooth';
    this.hornOsc2.frequency.setValueAtTime(485, t);

    this.hornOsc1.connect(this.hornGain);
    this.hornOsc2.connect(this.hornGain);
    this.hornGain.connect(this.masterGain);

    this.hornOsc1.start();
    this.hornOsc2.start();
  }

  stopHorn() {
    if (!this.hornGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.hornGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    setTimeout(() => {
      try {
        if (this.hornOsc1) this.hornOsc1.stop();
        if (this.hornOsc2) this.hornOsc2.stop();
      } catch (e) {}
      this.hornGain = null;
      this.hornOsc1 = null;
      this.hornOsc2 = null;
    }, 60);
  }

  /**
   * High-pitch piezoelectric emergency alarm beeper (KY-012 / Active Buzzer)
   * @param {boolean} active - enable/disable intermittent alert beeps
   */
  setAlarmBuzzer(active) {
    if (!active) {
      if (this.buzzerInterval) {
        clearInterval(this.buzzerInterval);
        this.buzzerInterval = null;
      }
      return;
    }

    if (this.buzzerInterval) return;
    if (!this.isAudioReady) this.init();

    const beep = () => {
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(2700, t); // 2.7 kHz resonant active buzzer

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.setValueAtTime(0.25, t + 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t);
      osc.stop(t + 0.15);
    };

    beep();
    this.buzzerInterval = setInterval(beep, 350); // Repeat every 350ms
  }
}

// Global export for simulation app
window.AudioSynthesizer = AudioSynthesizer;
