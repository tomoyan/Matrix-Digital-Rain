/**
 * Procedural Web Audio API sound engine for Matrix Digital Rain.
 * Synthesizes:
 *  1) A warm, clearly audible mechanical CRT monitor hum (60 Hz / 120 Hz / 240 Hz
 *     transformer harmonics shaped for both headphones and laptop speakers + softly
 *     modulated cathode-tube air noise bed).
 *  2) Rhythmic, stereo-panned "digital clicking" pulses (tactile relay micro-clicks
 *     and crisp retro-digital ticks) paced by the rain's fall speed and density.
 */

interface AudioParams {
  speed: number;
  density: number;
  volume: number; // 0 to 1
  paused: boolean;
}

export class MatrixAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private humGain: GainNode | null = null;
  private clickBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private clickNoiseBuffer: AudioBuffer | null = null;

  private active = false;
  private stepTimer: number | null = null;
  private stepIndex = 0;

  private params: AudioParams = {
    speed: 1.0,
    density: 0.88,
    volume: 0.7,
    paused: false,
  };

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      // Soft dynamics protection so layered ticks never clip
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 16;
      compressor.ratio.value = 3.5;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.12;
      compressor.connect(ctx.destination);

      // Master gain starts silent and fades smoothly on unmute
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.connect(compressor);
      this.masterGain = masterGain;

      // Sub-buses
      const humGain = ctx.createGain();
      humGain.gain.setValueAtTime(1.0, ctx.currentTime);
      humGain.connect(masterGain);
      this.humGain = humGain;

      const clickBus = ctx.createGain();
      clickBus.gain.setValueAtTime(1.0, ctx.currentTime);
      clickBus.connect(masterGain);
      this.clickBus = clickBus;

      this.buildBuffers(ctx);
      this.setupCrtHum(ctx, humGain);
    }

    return this.ctx;
  }

  private buildBuffers(ctx: AudioContext) {
    // 3-second normalized pink-tinted noise buffer for organic CRT chassis air/hum bed
    const bedLength = ctx.sampleRate * 3;
    const bedBuffer = ctx.createBuffer(1, bedLength, ctx.sampleRate);
    const bedData = bedBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let maxBed = 0.001;
    for (let i = 0; i < bedLength; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.996 * b0 + white * 0.045;
      b1 = 0.982 * b1 + white * 0.055;
      b2 = 0.94 * b2 + white * 0.075;
      const sample = b0 + b1 + b2 + white * 0.03;
      bedData[i] = sample;
      const abs = Math.abs(sample);
      if (abs > maxBed) maxBed = abs;
    }
    // Normalize to healthy level so bandpass filtering still has presence
    const bedScale = 0.85 / maxBed;
    for (let i = 0; i < bedLength; i++) {
      bedData[i] *= bedScale;
    }
    this.noiseBuffer = bedBuffer;

    // Crisp 32ms impulse + noise burst buffer for mechanical digital clicks
    const clickLen = Math.floor(ctx.sampleRate * 0.032);
    const clickBuf = ctx.createBuffer(1, clickLen, ctx.sampleRate);
    const clickData = clickBuf.getChannelData(0);
    for (let i = 0; i < clickLen; i++) {
      const t = i / clickLen;
      const env = Math.pow(1 - t, 1.9);
      // Tiny sharp transient spike on first ~12 samples gives tactile relay click
      const spike = i < 12 ? (i % 2 === 0 ? 1 : -0.7) * (1 - i / 12) : 0;
      clickData[i] = Math.max(-1, Math.min(1, (Math.random() * 2 - 1) * env * 0.85 + spike * 0.65));
    }
    this.clickNoiseBuffer = clickBuf;
  }

  private setupCrtHum(ctx: AudioContext, destination: AudioNode) {
    // Low-pass filter tuned to 460 Hz so 120 Hz / 240 Hz / 360 Hz transformer warmth
    // translates cleanly on both headphones and small laptop/mobile speakers
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.setValueAtTime(460, ctx.currentTime);
    humFilter.Q.setValueAtTime(0.9, ctx.currentTime);
    humFilter.connect(destination);

    // 1. 60 Hz mains hum fundamental
    const osc60 = ctx.createOscillator();
    osc60.type = 'sine';
    osc60.frequency.setValueAtTime(60, ctx.currentTime);
    const gain60 = ctx.createGain();
    gain60.gain.setValueAtTime(0.18, ctx.currentTime);
    osc60.connect(gain60);
    gain60.connect(humFilter);
    osc60.start();

    // 2. 120 Hz power transformer mechanical buzz (warm triangle, clearly audible on all speakers)
    const osc120 = ctx.createOscillator();
    osc120.type = 'triangle';
    osc120.frequency.setValueAtTime(120.45, ctx.currentTime);
    const gain120 = ctx.createGain();
    gain120.gain.setValueAtTime(0.14, ctx.currentTime);
    osc120.connect(gain120);
    gain120.connect(humFilter);
    osc120.start();

    // 3. 240 Hz subtle cabinet resonance harmonic (adds mechanical CRT presence)
    const osc240 = ctx.createOscillator();
    osc240.type = 'sawtooth';
    osc240.frequency.setValueAtTime(240.2, ctx.currentTime);
    const gain240 = ctx.createGain();
    gain240.gain.setValueAtTime(0.045, ctx.currentTime);
    osc240.connect(gain240);
    gain240.connect(humFilter);
    osc240.start();

    // 4. Warm cathode-tube air/static bed with slow organic breathing LFO
    if (this.noiseBuffer) {
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = this.noiseBuffer;
      noiseSrc.loop = true;

      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.setValueAtTime(420, ctx.currentTime);
      band.Q.setValueAtTime(0.7, ctx.currentTime);

      const bedGain = ctx.createGain();
      bedGain.gain.setValueAtTime(0.16, ctx.currentTime);

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.16, ctx.currentTime);
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.setValueAtTime(0.035, ctx.currentTime);
      lfo.connect(lfoDepth);
      lfoDepth.connect(bedGain.gain);
      lfo.start();

      noiseSrc.connect(band);
      band.connect(bedGain);
      bedGain.connect(destination);
      noiseSrc.start();
    }
  }

  private applyMasterLevel(rampSeconds: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const target = this.active ? Math.max(0, Math.min(1, this.params.volume)) : 0;

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.linearRampToValueAtTime(target, now + rampSeconds);
  }

  public setEnabled(enabled: boolean) {
    if (enabled === this.active) return;

    if (enabled) {
      const ctx = this.ensureContext();
      if (!ctx || !this.masterGain) return;

      this.active = true;

      const finishActivation = () => {
        if (!this.active) return;
        this.applyMasterLevel(0.22);
        // Immediate tactile CRT click confirmation when unmuting
        this.playDigitalTick(0, true);
        this.startClickScheduler();
      };

      if (ctx.state === 'suspended') {
        void ctx.resume().then(finishActivation).catch(() => {});
      } else {
        finishActivation();
      }
    } else {
      this.active = false;
      this.stopClickScheduler();
      this.applyMasterLevel(0.15);
    }
  }

  public updateParams(next: Partial<AudioParams>) {
    this.params = { ...this.params, ...next };

    if (!this.ctx || !this.masterGain || !this.humGain) return;

    const now = this.ctx.currentTime;
    if (this.active) {
      this.applyMasterLevel(0.08);
      // Soften CRT hum slightly when paused
      this.humGain.gain.cancelScheduledValues(now);
      this.humGain.gain.setValueAtTime(this.humGain.gain.value, now);
      this.humGain.gain.linearRampToValueAtTime(
        this.params.paused ? 0.55 : 1.0,
        now + 0.14
      );
    }
  }

  /**
   * Stereo-panned digital click when the user clicks on the rain canvas.
   */
  public triggerRippleClick(normalizedX: number) {
    if (!this.active || !this.ctx || !this.clickBus) {
      return;
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    const pan = Math.max(-0.85, Math.min(0.85, normalizedX * 2 - 1));
    this.playDigitalTick(pan, true);
  }

  private startClickScheduler() {
    this.stopClickScheduler();

    const scheduleNext = () => {
      if (!this.active) return;

      if (!this.params.paused && this.ctx && this.ctx.state === 'running') {
        this.runRhythmicStep();
      }

      // Base rhythmic pulse scaled smoothly by rain speed
      const speedFactor = Math.max(0.35, Math.min(2.2, this.params.speed));
      const baseStepMs = 165 / Math.pow(speedFactor, 0.65);
      // Subtle mechanical swing on odd steps
      const swing = this.stepIndex % 2 === 1 ? 1.08 : 0.92;
      const delayMs = Math.max(72, Math.min(360, baseStepMs * swing));

      this.stepTimer = window.setTimeout(scheduleNext, delayMs);
    };

    // Start first rhythmic step shortly after the unmute confirmation click
    this.stepTimer = window.setTimeout(scheduleNext, 140);
  }

  private stopClickScheduler() {
    if (this.stepTimer !== null) {
      window.clearTimeout(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private runRhythmicStep() {
    // 8-step rhythmic accent pattern mimicking a hardware data clock / relay cascade
    const accentPattern = [0.92, 0.38, 0.68, 0.45, 0.84, 0.35, 0.72, 0.42];
    const weight = accentPattern[this.stepIndex % accentPattern.length];
    const densityBoost = 0.62 + this.params.density * 0.38;
    const fireProb = Math.min(0.95, weight * densityBoost);

    const isAccent = this.stepIndex % 4 === 0 || this.stepIndex % 8 === 6;
    this.stepIndex = (this.stepIndex + 1) % 32;

    if (Math.random() < fireProb) {
      const pan = (Math.random() * 2 - 1) * 0.7;
      this.playDigitalTick(pan, isAccent && Math.random() < 0.65);
    }
  }

  private playDigitalTick(panValue: number, withTonalPing: boolean) {
    const ctx = this.ctx;
    const bus = this.clickBus;
    if (!ctx || !bus || !this.clickNoiseBuffer) return;

    const now = ctx.currentTime;

    // Optional stereo panner (graceful fallback if unavailable)
    let outputNode: AudioNode = bus;
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(panValue, now);
      panner.connect(bus);
      outputNode = panner;
    }

    // Layer A: Tactile mechanical digital micro-click (filtered impulse burst)
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this.clickNoiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    // Crisp relay click band between 1.3 kHz and 3.4 kHz with musical Q
    filter.frequency.setValueAtTime(1300 + Math.random() * 2100, now);
    filter.Q.setValueAtTime(1.6 + Math.random() * 1.4, now);

    const clickGain = ctx.createGain();
    const peak = (withTonalPing ? 0.52 : 0.32) * (0.8 + Math.random() * 0.35);
    clickGain.gain.setValueAtTime(peak, now);
    clickGain.gain.exponentialRampToValueAtTime(
      0.001,
      now + 0.018 + Math.random() * 0.012
    );

    noiseSrc.connect(filter);
    filter.connect(clickGain);
    clickGain.connect(outputNode);

    noiseSrc.start(now);
    noiseSrc.stop(now + 0.032);

    // Layer B: Crisp retro-digital data tick on rhythmic accents
    if (withTonalPing) {
      const osc = ctx.createOscillator();
      // Harmonious pentatonic tech tones so consecutive clicks feel hypnotic, never harsh
      const freqs = [440, 528, 660, 792, 990, 1188];
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(
        freqs[Math.floor(Math.random() * freqs.length)],
        now
      );

      const pingGain = ctx.createGain();
      pingGain.gain.setValueAtTime(0.0001, now);
      pingGain.gain.linearRampToValueAtTime(0.14, now + 0.003);
      pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.052);

      osc.connect(pingGain);
      pingGain.connect(outputNode);

      osc.start(now);
      osc.stop(now + 0.058);
    }
  }

  public dispose() {
    this.active = false;
    this.stopClickScheduler();
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
    this.masterGain = null;
    this.humGain = null;
    this.clickBus = null;
  }
}
