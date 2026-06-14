import { ShotFrame, ShotInput } from '../types';

export class AudioManager {
  private static instance: AudioManager | null = null;

  private ctx: AudioContext | null = null;
  private isInitialized = false;

  // Continuous synthesizers
  private windGain: GainNode | null = null;

  private sizzleNode: AudioScheduledSourceNode | null = null;
  private sizzleGain: GainNode | null = null;

  private leakageNode: AudioScheduledSourceNode | null = null;
  private leakageGain: GainNode | null = null;
  private leakageFilter: BiquadFilterNode | null = null;

  private frictionNode: AudioScheduledSourceNode | null = null;
  private frictionGain: GainNode | null = null;
  private frictionOsc: OscillatorNode | null = null;

  private flightNode: AudioScheduledSourceNode | null = null;
  private flightGain: GainNode | null = null;

  // Persistent nodes state
  private lastStage: string = 'setup';
  private lastFiredIndex: number = -1;

  // Workbench persistent nodes
  private tensileOsc: OscillatorNode | null = null;
  private tensileGain: GainNode | null = null;
  private dishNoise: AudioScheduledSourceNode | null = null;
  private dishGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;

  private constructor() {
    this.setupGestureListeners();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private setupGestureListeners() {
    const initOnGesture = () => {
      this.initContext();
      if (this.isInitialized) {
        window.removeEventListener('click', initOnGesture);
        window.removeEventListener('keydown', initOnGesture);
        console.log('Smoke & Tolerance Audio Context initialized on user gesture.');
      }
    };
    window.addEventListener('click', initOnGesture);
    window.addEventListener('keydown', initOnGesture);
  }

  private initContext() {
    if (this.isInitialized) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.createNoiseBuffer();
        this.startAmbientSynthesis();
        this.isInitialized = true;
      }
    } catch (err) {
      console.error('Failed to initialize AudioContext:', err);
    }
  }

  private createNoiseBuffer() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  private startAmbientSynthesis() {
    if (!this.ctx || !this.noiseBuffer) return;

    // --- Ambient Wind Synthesizer ---
    const windSource = this.ctx.createBufferSource();
    windSource.buffer = this.noiseBuffer;
    windSource.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.setValueAtTime(350, this.ctx.currentTime);
    windFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    // Dynamic wind modulation (gusts)
    const gustOsc = this.ctx.createOscillator();
    gustOsc.type = 'sine';
    gustOsc.frequency.setValueAtTime(0.15, this.ctx.currentTime); // very slow LFO
    const gustGain = this.ctx.createGain();
    gustGain.gain.setValueAtTime(100, this.ctx.currentTime);

    gustOsc.connect(gustGain);
    gustGain.connect(windFilter.frequency);
    
    windSource.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);

    gustOsc.start();
    windSource.start();
  }

  public updateAmbientWind(windSpeed: number) {
    this.initContext();
    if (!this.ctx || !this.windGain) return;
    // Map 0-100 wind speed to gain (0 to 0.15)
    const targetGain = (windSpeed / 100) * 0.15;
    this.windGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.2);
  }

  public handleFrame(
    frame: ShotFrame,
    index: number,
    isPlaying: boolean,
    inputs: ShotInput
  ) {
    this.initContext();
    if (!this.ctx) return;

    // Resume context if suspended
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (!isPlaying) {
      this.stopContinuousSounds();
      if (index !== this.lastFiredIndex && frame.stage !== this.lastStage) {
        this.playScrubClick();
        this.lastFiredIndex = index;
      }
      this.lastStage = frame.stage;
      return;
    }

    // 1. Detect and play one-shot sounds on stage transition
    if (frame.stage !== this.lastStage && index !== this.lastFiredIndex) {
      this.triggerOneShot(frame.stage, frame, inputs);
      this.lastFiredIndex = index;
    }

    // 2. Manage and modulate continuous sounds matching telemetry
    this.manageContinuousSynthesis(frame, inputs);

    this.lastStage = frame.stage;
  }

  private triggerOneShot(stage: string, frame: ShotFrame, inputs: ShotInput) {
    if (!this.ctx) return;

    // A. Rupture Event (Tinnitus & Explode)
    const isRuptured = frame.warnings.includes('TEST DEVICE RUPTURED') || frame.warnings.includes('BARREL METALLURGICAL FAILURE');
    if (isRuptured && stage === 'aftermath') {
      this.playRuptureExplosion(inputs.barrelMaterial);
      this.playTinnitus();
      return;
    }

    // B. Muzzle Exit Blast & Resonance
    if (stage === 'muzzle_exit') {
      this.playBlast(frame.pressure);
      this.playResonance(inputs.barrelMaterial, frame.pressure, frame.barrelFatigue);
      return;
    }

    // C. Flight Whoosh Start
    if (stage === 'flight') {
      this.triggerFlightWhoosh(frame.projectileVelocity);
      return;
    }

    // D. Target Impact
    if (stage === 'impact') {
      this.playImpact(inputs.projectileType, frame.warnings);
      return;
    }
  }

  private manageContinuousSynthesis(frame: ShotFrame, inputs: ShotInput) {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;

    // A. Priming Sizzle (Ignition Stage)
    if (frame.stage === 'ignition') {
      if (!this.sizzleNode) {
        this.sizzleNode = this.ctx.createBufferSource();
        (this.sizzleNode as AudioBufferSourceNode).buffer = this.noiseBuffer;
        (this.sizzleNode as AudioBufferSourceNode).loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1500, time);

        this.sizzleGain = this.ctx.createGain();
        this.sizzleGain.gain.setValueAtTime(0.02, time);

        this.sizzleNode.connect(filter);
        filter.connect(this.sizzleGain);
        this.sizzleGain.connect(this.ctx.destination);
        this.sizzleNode.start();
      }

      // Modulate sizzle volume (simulate spark crackling)
      if (this.sizzleGain) {
        const randSizzle = 0.01 + Math.random() * 0.03;
        this.sizzleGain.gain.setValueAtTime(randSizzle, time);
      }
    } else {
      this.stopSizzle();
    }

    // B. Gas Leakage Hiss (Pressure & Movement stages)
    if ((frame.stage === 'pressure' || frame.stage === 'movement') && frame.leakage > 0.001) {
      if (!this.leakageNode) {
        this.leakageNode = this.ctx.createBufferSource();
        (this.leakageNode as AudioBufferSourceNode).buffer = this.noiseBuffer;
        (this.leakageNode as AudioBufferSourceNode).loop = true;

        this.leakageFilter = this.ctx.createBiquadFilter();
        this.leakageFilter.type = 'bandpass';
        this.leakageFilter.Q.setValueAtTime(3.0, time);

        this.leakageGain = this.ctx.createGain();
        this.leakageGain.gain.setValueAtTime(0, time);

        this.leakageNode.connect(this.leakageFilter);
        this.leakageFilter.connect(this.leakageGain);
        this.leakageGain.connect(this.ctx.destination);
        this.leakageNode.start();
      }

      if (this.leakageGain && this.leakageFilter) {
        // Leakage rate determines sound intensity and pitch (filter cutoff)
        const intensity = Math.min(0.25, frame.leakage * 8.0);
        const pitch = 3000 + Math.min(4000, frame.leakage * 80000);
        this.leakageGain.gain.setTargetAtTime(intensity, time, 0.05);
        this.leakageFilter.frequency.setTargetAtTime(pitch, time, 0.05);
      }
    } else {
      this.stopLeakage();
    }

    // C. Projectile Bore Friction (Movement stage)
    const isMoving = frame.stage === 'movement';
    if (isMoving && frame.projectileVelocity > 0.1) {
      if (!this.frictionNode) {
        this.frictionNode = this.ctx.createBufferSource();
        (this.frictionNode as AudioBufferSourceNode).buffer = this.noiseBuffer;
        (this.frictionNode as AudioBufferSourceNode).loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(450, time);
        filter.Q.setValueAtTime(1.0, time);

        this.frictionOsc = this.ctx.createOscillator();
        this.frictionOsc.type = 'triangle';
        this.frictionOsc.frequency.setValueAtTime(120, time);

        this.frictionGain = this.ctx.createGain();
        this.frictionGain.gain.setValueAtTime(0, time);

        this.frictionNode.connect(filter);
        filter.connect(this.frictionGain);

        // Mix in metallic scraping resonator oscillator
        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0.04, time);
        this.frictionOsc.connect(oscGain);
        oscGain.connect(this.frictionGain);

        this.frictionGain.connect(this.ctx.destination);
        this.frictionNode.start();
        this.frictionOsc.start();
      }

      if (this.frictionGain && this.frictionOsc) {
        // Map velocity to scrape pitch and intensity
        const velocityFactor = Math.min(1.0, frame.projectileVelocity / 100.0);
        const scrapeGain = 0.05 + velocityFactor * 0.18;
        
        let pitch = 90 + velocityFactor * 250;
        
        // Add scratchy rattle if rough stone sphere is sliding
        if (inputs.projectileType === 'rough_stone') {
          const rattle = Math.sin(time * 80) * 40;
          pitch += rattle;
        }

        this.frictionGain.gain.setTargetAtTime(scrapeGain, time, 0.05);
        this.frictionOsc.frequency.setTargetAtTime(pitch, time, 0.05);
      }
    } else {
      this.stopFriction();
    }
  }

  private playBlast(pressure: number) {
    if (!this.ctx || !this.noiseBuffer) return;
    const time = this.ctx.currentTime;
    
    // Scale blast intensity on peak pressure (max pressure ~ 20-30 MPa)
    const scale = Math.min(1.5, Math.max(0.2, pressure / 15.0));

    // Low Frequency Boom (Sweep)
    const boom = this.ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(140 * scale, time);
    boom.frequency.exponentialRampToValueAtTime(10, time + 0.35);

    const boomGain = this.ctx.createGain();
    boomGain.gain.setValueAtTime(0.7 * scale, time);
    boomGain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

    // Distortion shaper node for "grit"
    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.makeDistortionCurve(40);
    shaper.oversample = '4x';

    boom.connect(boomGain);
    boomGain.connect(shaper);
    shaper.connect(this.ctx.destination);

    // High Frequency Gas Expansion Crack
    const crack = this.ctx.createBufferSource();
    crack.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, time);
    filter.Q.setValueAtTime(0.5, time);

    const crackGain = this.ctx.createGain();
    crackGain.gain.setValueAtTime(0.3 * scale, time);
    crackGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

    crack.connect(filter);
    filter.connect(crackGain);
    crackGain.connect(this.ctx.destination);

    boom.start();
    crack.start();
    boom.stop(time + 0.45);
    crack.stop(time + 0.1);
  }

  private playResonance(material: string, pressure: number, fatigue: number) {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;
    const scale = Math.min(1.0, pressure / 20.0);

    if (material === 'cast_bronze') {
      // Bronzes bells: rich harmonic ringing, detuned and damped as fatigue increases
      const partials = [
        380 * (1.0 - 0.15 * fatigue),
        570 * (1.0 - 0.18 * fatigue),
        850 * (1.0 - 0.22 * fatigue),
        1280 * (1.0 - 0.25 * fatigue)
      ];
      const gains = [0.12, 0.08, 0.05, 0.03];
      const decays = [1.8, 1.2, 0.7, 0.4].map(d => d * Math.exp(-2.5 * fatigue));

      partials.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        const gainNode = this.ctx!.createGain();
        gainNode.gain.setValueAtTime(gains[idx] * scale, time);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + decays[idx]);

        osc.connect(gainNode);
        gainNode.connect(this.ctx!.destination);

        osc.start();
        osc.stop(time + decays[idx] + 0.1);
      });
    } else if (material === 'wrought_iron') {
      // Wrought Iron: Flat, dense metallic clank, modulated with 120Hz buzzy triangle under fatigue
      const clank = this.ctx.createOscillator();
      clank.type = 'triangle';
      clank.frequency.setValueAtTime(180, time);

      const clankGain = this.ctx.createGain();
      clankGain.gain.setValueAtTime(0.18 * scale, time);
      clankGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);

      clank.connect(clankGain);
      clankGain.connect(this.ctx.destination);

      if (fatigue > 0.05) {
        const mod = this.ctx.createOscillator();
        mod.type = 'triangle';
        mod.frequency.setValueAtTime(120, time);

        const modGain = this.ctx.createGain();
        modGain.gain.setValueAtTime(0.15 * scale * fatigue, time);

        mod.connect(modGain);
        modGain.connect(clankGain.gain);
        mod.start();
        mod.stop(time + 0.25);
      }

      clank.start();
      clank.stop(time + 0.3);
    } else {
      // Bamboo: Sharp wood-fiber cracking thuds, with snap crackles under fatigue
      const woodSnap = this.ctx.createOscillator();
      woodSnap.type = 'sine';
      woodSnap.frequency.setValueAtTime(260, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2 * scale, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);

      woodSnap.connect(gain);
      gain.connect(this.ctx.destination);
      woodSnap.start();
      woodSnap.stop(time + 0.12);

      if (fatigue > 0.05) {
        const numCrackles = Math.floor(fatigue * 5) + 1;
        for (let i = 0; i < numCrackles; i++) {
          const crackleTime = time + 0.01 + Math.random() * 0.08;
          const osc = this.ctx.createOscillator();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(800 + Math.random() * 600, crackleTime);

          const cGain = this.ctx.createGain();
          cGain.gain.setValueAtTime(0.08 * fatigue, crackleTime);
          cGain.gain.exponentialRampToValueAtTime(0.0001, crackleTime + 0.02);

          osc.connect(cGain);
          cGain.connect(this.ctx.destination);
          osc.start(crackleTime);
          osc.stop(crackleTime + 0.03);
        }
      }
    }
  }

  private playRuptureExplosion(material: string) {
    if (!this.ctx || !this.noiseBuffer) return;
    const time = this.ctx.currentTime;

    // Huge white noise explosion
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(1.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);

    const shaper = this.ctx.createWaveShaper();
    shaper.curve = this.makeDistortionCurve(100);

    source.connect(filter);
    filter.connect(shaper);
    shaper.connect(gain);
    gain.connect(this.ctx.destination);
    source.start();
    source.stop(time + 1.3);

    // Material-specific failure noise
    if (material === 'bamboo') {
      // Multiple fast wooden cracking transients
      for (let i = 0; i < 6; i++) {
        const snapTime = time + i * 0.04;
        const snapOsc = this.ctx.createOscillator();
        snapOsc.type = 'triangle';
        snapOsc.frequency.setValueAtTime(120 + Math.random() * 200, snapTime);

        const snapGain = this.ctx.createGain();
        snapGain.gain.setValueAtTime(0.4, snapTime);
        snapGain.gain.exponentialRampToValueAtTime(0.001, snapTime + 0.05);

        snapOsc.connect(snapGain);
        snapGain.connect(this.ctx.destination);
        snapOsc.start(snapTime);
        snapOsc.stop(snapTime + 0.06);
      }
    }
  }

  private playTinnitus() {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;

    // High pitch sine wave (4000Hz)
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(4000, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.linearRampToValueAtTime(0.0001, time + 4.0); // 4 seconds fade out

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(time + 4.1);
  }

  private triggerFlightWhoosh(exitVelocity: number) {
    if (!this.ctx || !this.noiseBuffer) return;
    const time = this.ctx.currentTime;

    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(2.0, time);

    // Sweep filter down to simulate doppler roll-off
    const startFreq = Math.min(2000, 400 + exitVelocity * 10);
    filter.frequency.setValueAtTime(startFreq, time);
    filter.frequency.exponentialRampToValueAtTime(120, time + 1.2);

    this.flightGain = this.ctx.createGain();
    this.flightGain.gain.setValueAtTime(0.12, time);
    this.flightGain.gain.exponentialRampToValueAtTime(0.001, time + 1.2);

    source.connect(filter);
    filter.connect(this.flightGain);
    this.flightGain.connect(this.ctx.destination);

    source.start();
    this.flightNode = source;
  }

  private playImpact(projectile: string, warnings: string[]) {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;

    const isHit = warnings.includes('DIRECT BULLSEYE IMPACT!');
    const targetThud = this.ctx.createOscillator();
    targetThud.type = 'triangle';
    targetThud.frequency.setValueAtTime(90, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isHit ? 0.35 : 0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.35);

    targetThud.connect(gain);
    gain.connect(this.ctx.destination);
    targetThud.start();
    targetThud.stop(time + 0.4);

    if (projectile === 'rough_stone') {
      // Stone crushing particles
      for (let i = 0; i < 4; i++) {
        const pTime = time + Math.random() * 0.1;
        const pOsc = this.ctx.createOscillator();
        pOsc.type = 'sine';
        pOsc.frequency.setValueAtTime(800 + Math.random() * 600, pTime);

        const pGain = this.ctx.createGain();
        pGain.gain.setValueAtTime(0.05, pTime);
        pGain.gain.exponentialRampToValueAtTime(0.0001, pTime + 0.05);

        pOsc.connect(pGain);
        pGain.connect(this.ctx.destination);
        pOsc.start(pTime);
        pOsc.stop(pTime + 0.06);
      }
    }
  }

  // --- Alchemical Workbench Laboratory Tests ---

  public playDishTest(burnRate: number) {
    this.initContext();
    if (!this.ctx || !this.noiseBuffer) return;
    const time = this.ctx.currentTime;

    this.stopDishTest();

    // Continuous alchemical gunpowder dish sizzle
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2500, time);
    filter.Q.setValueAtTime(1.0, time);

    this.dishGain = this.ctx.createGain();
    // Maps burn rate (e.g. 0.2 - 1.5) to crackle intensity
    this.dishGain.gain.setValueAtTime(0.05 + burnRate * 0.06, time);

    source.connect(filter);
    filter.connect(this.dishGain);
    this.dishGain.connect(this.ctx.destination);
    source.start();

    this.dishNoise = source;

    // Automatically stop after 1.5s
    setTimeout(() => {
      this.stopDishTest();
    }, 1500);
  }

  public stopDishTest() {
    if (this.dishNoise) {
      try {
        this.dishNoise.stop();
      } catch (e) {}
      this.dishNoise = null;
    }
    this.dishGain = null;
  }

  public playCalorimeterTest(peakPressure: number) {
    this.initContext();
    if (!this.ctx) return;
    const time = this.ctx.currentTime;

    // Muffled hollow interior pop
    const pop = this.ctx.createOscillator();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(110, time);
    pop.frequency.exponentialRampToValueAtTime(30, time + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.min(0.6, peakPressure * 0.04), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);

    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(180, time); // highly muffled low pass

    pop.connect(lp);
    lp.connect(gain);
    gain.connect(this.ctx.destination);

    pop.start();
    pop.stop(time + 0.25);
  }

  public startTensileTest(material: string) {
    this.initContext();
    if (!this.ctx || this.tensileOsc) return;
    const time = this.ctx.currentTime;

    // Creaking low oscillator
    this.tensileOsc = this.ctx.createOscillator();
    this.tensileOsc.type = 'triangle';
    
    // Pitch differs by material
    const baseFreq = material === 'bamboo' ? 75 : material === 'wrought_iron' ? 55 : 65;
    this.tensileOsc.frequency.setValueAtTime(baseFreq, time);

    this.tensileGain = this.ctx.createGain();
    this.tensileGain.gain.setValueAtTime(0.0, time); // start silent

    this.tensileOsc.connect(this.tensileGain);
    this.tensileGain.connect(this.ctx.destination);
    this.tensileOsc.start();
  }

  public updateTensileLoad(loadPercentage: number, isBroken: boolean) {
    if (!this.ctx || !this.tensileOsc || !this.tensileGain) return;
    const time = this.ctx.currentTime;

    if (isBroken) {
      // Specimen snapped! Trigger loud clank/splinter
      this.stopTensileTest();
      this.playTensileSnap();
      return;
    }

    // Load scales the pitch and volume of structural creak
    const factor = loadPercentage / 100;
    const creakVol = factor * 0.08;
    const frequency = 60 + factor * 60; // groaning raises in pitch under load

    this.tensileGain.gain.setValueAtTime(creakVol, time);
    this.tensileOsc.frequency.setValueAtTime(frequency, time);
  }

  public stopTensileTest() {
    if (this.tensileOsc) {
      try {
        this.tensileOsc.stop();
      } catch (e) {}
      this.tensileOsc = null;
    }
    this.tensileGain = null;
  }

  private playTensileSnap() {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;

    // Specimen snap transient
    const snap = this.ctx.createOscillator();
    snap.type = 'sawtooth';
    snap.frequency.setValueAtTime(280, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);

    snap.connect(gain);
    gain.connect(this.ctx.destination);
    snap.start();
    snap.stop(time + 0.2);
  }

  public playScrubClick() {
    if (!this.ctx) return;
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, time);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.006, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(time + 0.03);
  }

  public playCleanBore() {
    this.initContext();
    if (!this.ctx) return;
    const time = this.ctx.currentTime;

    // Sweeping brush/sponge sound
    const sweep = this.ctx.createOscillator();
    sweep.type = 'triangle';
    sweep.frequency.setValueAtTime(600, time);
    sweep.frequency.linearRampToValueAtTime(200, time + 0.5);

    const gainNode = this.ctx.createGain();
    gainNode.gain.setValueAtTime(0.06, time);
    gainNode.gain.linearRampToValueAtTime(0.0001, time + 0.5);

    sweep.connect(gainNode);
    gainNode.connect(this.ctx.destination);
    sweep.start();
    sweep.stop(time + 0.52);
  }

  // --- Stop & Cleanup Helpers ---

  public stopContinuousSounds() {
    this.stopSizzle();
    this.stopLeakage();
    this.stopFriction();
    this.stopFlightNode();
  }

  private stopSizzle() {
    if (this.sizzleNode) {
      try {
        this.sizzleNode.stop();
      } catch (e) {}
      this.sizzleNode = null;
    }
    this.sizzleGain = null;
  }

  private stopLeakage() {
    if (this.leakageNode) {
      try {
        this.leakageNode.stop();
      } catch (e) {}
      this.leakageNode = null;
    }
    this.leakageGain = null;
    this.leakageFilter = null;
  }

  private stopFriction() {
    if (this.frictionNode) {
      try {
        this.frictionNode.stop();
      } catch (e) {}
      this.frictionNode = null;
    }
    if (this.frictionOsc) {
      try {
        this.frictionOsc.stop();
      } catch (e) {}
      this.frictionOsc = null;
    }
    this.frictionGain = null;
  }

  private stopFlightNode() {
    if (this.flightNode) {
      try {
        this.flightNode.stop();
      } catch (e) {}
      this.flightNode = null;
    }
    this.flightGain = null;
  }

  // Helper distortion generator
  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
}
