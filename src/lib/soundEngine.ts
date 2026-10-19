/**
 * Web Audio API SoundEngine
 * Procedural horror & industrial audio generator with master gain amplification up to 250%.
 * Optimized & lightweight implementation.
 */

export class SoundEngine {
  private static instance: SoundEngine | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private unlocked = false;
  private currentVolume = 1.0;
  private activeGeigerTimer: any = null;

  private constructor() {}

  public static getInstance(): SoundEngine {
    if (!SoundEngine.instance) {
      SoundEngine.instance = new SoundEngine();
    }
    return SoundEngine.instance;
  }

  public init(): void {
    if (typeof window === 'undefined') return;
    if (this.ctx && this.unlocked) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!this.ctx) {
        this.ctx = new AudioCtxClass();
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      this.setupMasterBus();
      this.unlocked = true;
    } catch (e) {
      console.warn('AudioContext initialization error:', e);
    }
  }

  private setupMasterBus(): void {
    if (!this.ctx) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);

    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(20, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this.createImpulseResponse(2.7, 2.0);

    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }

  private createImpulseResponse(durationSec: number, decay: number): AudioBuffer {
    if (!this.ctx) throw new Error('No AudioContext');
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * durationSec;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const env = Math.exp((-i / length) * decay);
      left[i] = (Math.random() * 2 - 1) * env;
      right[i] = (Math.random() * 2 - 1) * env;
    }
    return impulse;
  }

  public setVolume(vol: number): void {
    this.currentVolume = Math.max(0, Math.min(2.5, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.currentVolume;
  }

  private getDest(): AudioNode {
    if (!this.ctx) this.init();
    if (!this.compressor && this.ctx) this.setupMasterBus();
    return this.compressor || this.ctx!.destination;
  }

  // Helper to construct a standard oscillator chain with envelope
  private createTone(
    type: OscillatorType,
    freq: number,
    startDelay = 0,
    duration = 0.1,
    gainPeak = 0.4
  ): { osc: OscillatorNode; gain: GainNode; now: number } | null {
    if (!this.ctx) return null;
    const now = this.ctx.currentTime + startDelay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + Math.min(0.015, duration * 0.1));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
    return { osc, gain, now };
  }

  /** Beep (Operation confirmation sound) */
  public playBeep(freq = 880, duration = 0.06): void {
    this.init();
    const tone = this.createTone('sine', freq, 0, duration, 0.4);
    if (!tone || !this.ctx) return;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, tone.now);
    filter.Q.setValueAtTime(3.0, tone.now);

    tone.osc.disconnect();
    tone.osc.connect(filter);
    filter.connect(tone.gain);
    tone.gain.connect(this.getDest());
  }

  /** Shutter (Camera mechanical shutter sound) */
  public playShutter(): void {
    this.init();
    if (!this.ctx) return;

    const playClick = (timeOffset: number, clickDuration: number, freq: number) => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + timeOffset;
      const bufferSize = Math.floor(this.ctx.sampleRate * clickDuration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq, t);
      filter.Q.setValueAtTime(2.5, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + clickDuration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.getDest());
      noise.start(t);
    };

    playClick(0, 0.038, 2600);
    playClick(0.065, 0.045, 1850);
  }

  /** Low Impact (Deep bass sub-boom) */
  public playLowImpact(): void {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(74, now);
    osc.frequency.exponentialRampToValueAtTime(27, now + 0.9);
    oscGain.gain.setValueAtTime(0.9, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc.connect(oscGain);
    oscGain.connect(this.getDest());

    const bufLen = Math.floor(this.ctx.sampleRate * 0.8);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const output = buf.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufLen; i++) {
      lastOut = (lastOut + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      output[i] = lastOut * 3.5;
    }

    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(145, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    noiseSrc.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.getDest());

    osc.start(now);
    osc.stop(now + 1.3);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.9);
  }

  /** Geiger (Irregular radiation ticks) */
  public playGeiger(level = 3, durationMs = 2000): void {
    this.init();
    if (!this.ctx) return;
    if (this.activeGeigerTimer) clearInterval(this.activeGeigerTimer);

    const interval = Math.max(25, 250 - level * 40);
    const endTime = Date.now() + durationMs;

    this.activeGeigerTimer = setInterval(() => {
      if (!this.ctx || Date.now() > endTime) {
        clearInterval(this.activeGeigerTimer);
        this.activeGeigerTimer = null;
        return;
      }
      if (Math.random() < 0.25) return;

      const tone = this.createTone('sawtooth', 2200 + Math.random() * 800, 0, 0.008, 0.4);
      if (!tone || !this.ctx) return;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1500, tone.now);

      tone.osc.disconnect();
      tone.osc.connect(filter);
      filter.connect(tone.gain);
      tone.gain.connect(this.getDest());
    }, interval);
  }

  /** Drone (Metallic resonance) */
  public playDrone(duration = 3.0): void {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const freqs = [
      { type: 'sawtooth' as OscillatorType, freq: 55 },
      { type: 'triangle' as OscillatorType, freq: 57.5 },
      { type: 'sawtooth' as OscillatorType, freq: 110.8 },
    ];

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, now);
    filter.frequency.exponentialRampToValueAtTime(700, now + duration * 0.5);
    filter.frequency.exponentialRampToValueAtTime(180, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    freqs.forEach(({ type, freq }) => {
      const osc = this.ctx!.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(filter);
      osc.start(now);
      osc.stop(now + duration + 0.2);
    });

    filter.connect(gain);
    if (this.reverbNode) {
      const revGain = this.ctx.createGain();
      revGain.gain.setValueAtTime(0.4, now);
      gain.connect(this.reverbNode);
      this.reverbNode.connect(revGain);
      revGain.connect(this.getDest());
    }
    gain.connect(this.getDest());
  }

  /** Motor (Industrial sound) */
  public playMotor(duration = 1.2): void {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(42, now);
    osc.frequency.linearRampToValueAtTime(46, now + duration * 0.3);
    osc.frequency.linearRampToValueAtTime(38, now + duration);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(220, now);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.getDest());

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  /** Power Down (Horror shutdown pitch dive) */
  public playPowerDown(): void {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 2.5;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(380, now);
    osc.frequency.exponentialRampToValueAtTime(15, now + duration);

    oscGain.gain.setValueAtTime(0.5, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(60, now + duration);

    osc.connect(filter);
    filter.connect(oscGain);
    oscGain.connect(this.getDest());

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  /** Task Success (Clear 2-tone success chime) */
  public playTaskSuccess(): void {
    this.init();
    if (!this.ctx) return;

    const playTone = (freq: number, startDelay: number, duration: number, gainPeak: number) => {
      const tone = this.createTone('triangle', freq, startDelay, duration, gainPeak);
      if (!tone || !this.ctx) return;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 3, tone.now);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.5, tone.now + duration);

      tone.osc.disconnect();
      tone.osc.connect(filter);
      filter.connect(tone.gain);
      tone.gain.connect(this.getDest());
    };

    playTone(880, 0, 0.22, 0.35);
    playTone(1320, 0.11, 0.45, 0.45);
  }

  public playSound(soundType: string, level = 3): void {
    switch (soundType) {
      case 'beep': return this.playBeep();
      case 'shutter': return this.playShutter();
      case 'lowImpact': return this.playLowImpact();
      case 'taskSuccess': return this.playTaskSuccess();
      case 'geiger': return this.playGeiger(level);
      case 'drone': return this.playDrone();
      case 'motor': return this.playMotor();
      case 'powerDown': return this.playPowerDown();
      default: return this.playBeep();
    }
  }
}

export const getSoundEngine = () => SoundEngine.getInstance();
