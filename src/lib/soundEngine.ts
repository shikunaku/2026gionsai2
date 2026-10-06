/**
 * Web Audio API SoundEngine
 * Procedural horror & industrial audio generator with master gain amplification up to 250%.
 */

export class SoundEngine {
  private static instance: SoundEngine | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private unlocked = false;
  private currentVolume = 1.0;
  private activeDroneOscs: OscillatorNode[] = [];
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

    // Master Gain Node (supports up to 2.5x amplification)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);

    // Dynamics Compressor to avoid harsh distortion when boosted to 250%
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(20, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

    // Convolver Reverb (2.7s factory hall impulse response)
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this.createImpulseResponse(2.7, 2.0);

    // Chain: MasterBus -> Compressor -> MasterGain -> Destination
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
      const t = i / length;
      const env = Math.exp(-t * decay);
      left[i] = (Math.random() * 2 - 1) * env;
      right[i] = (Math.random() * 2 - 1) * env;
    }
    return impulse;
  }

  public setVolume(vol: number): void {
    // Range 0.0 to 2.5
    this.currentVolume = Math.max(0, Math.min(2.5, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.currentVolume;
  }

  private getDestinationNode(): AudioNode {
    if (!this.ctx) {
      this.init();
    }
    if (!this.compressor && this.ctx) {
      this.setupMasterBus();
    }
    return this.compressor || this.ctx!.destination;
  }

  /**
   * Beep (Operation confirmation sound)
   * 880Hz, 0.06s, attack 0.003s, bandpass filtered
   */
  public playBeep(freq = 880, duration = 0.06): void {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.setValueAtTime(3.0, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.getDestinationNode());

    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  /**
   * Shutter (Camera mechanical shutter sound)
   * Two distinct white-noise burst clicks with bandpass filtering (1700-2900Hz)
   */
  public playShutter(): void {
    this.init();
    if (!this.ctx) return;

    const playClick = (timeOffset: number, clickDuration: number, freq: number) => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + timeOffset;
      const bufferSize = this.ctx.sampleRate * clickDuration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(freq, t);
      filter.Q.setValueAtTime(2.5, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + clickDuration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.getDestinationNode());

      noise.start(t);
      noise.stop(t + clickDuration);
    };

    playClick(0, 0.025, 2600);
    playClick(0.045, 0.035, 1900);
  }

  /**
   * Low Impact (Deep horror subsonic thud)
   * Pitch drop 74Hz -> 27Hz + brown noise lowpass 145Hz
   */
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
    oscGain.connect(this.getDestinationNode());

    // Brown noise lowpass sub-blast
    const bufLen = this.ctx.sampleRate * 0.8;
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const output = buf.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufLen; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
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
    noiseGain.connect(this.getDestinationNode());

    osc.start(now);
    osc.stop(now + 1.3);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.9);
  }

  /**
   * Geiger (Irregular radiation ticks)
   * Density level 1 to 5
   */
  public playGeiger(level = 3, durationMs = 2000): void {
    this.init();
    if (!this.ctx) return;

    if (this.activeGeigerTimer) {
      clearInterval(this.activeGeigerTimer);
      this.activeGeigerTimer = null;
    }

    const interval = Math.max(25, 250 - level * 40);
    const endTime = Date.now() + durationMs;

    const playClick = () => {
      if (!this.ctx || Date.now() > endTime) {
        clearInterval(this.activeGeigerTimer);
        this.activeGeigerTimer = null;
        return;
      }
      if (Math.random() < 0.25) return; // Irregularity

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2200 + Math.random() * 800, now);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1500, now);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.getDestinationNode());

      osc.start(now);
      osc.stop(now + 0.01);
    };

    this.activeGeigerTimer = setInterval(playClick, interval);
  }

  /**
   * Drone (Creepy metallic space resonance)
   */
  public playDrone(duration = 3.0): void {
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(55, now); // A1

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(57.5, now); // Slight dissonance

    osc3.type = 'sawtooth';
    osc3.frequency.setValueAtTime(110.8, now); // Detuned octave

    // Filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, now);
    filter.frequency.exponentialRampToValueAtTime(700, now + duration * 0.5);
    filter.frequency.exponentialRampToValueAtTime(180, now + duration);

    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gain);

    // Send through Reverb if available
    if (this.reverbNode) {
      const revGain = this.ctx.createGain();
      revGain.gain.setValueAtTime(0.4, now);
      gain.connect(this.reverbNode);
      this.reverbNode.connect(revGain);
      revGain.connect(this.getDestinationNode());
    }

    gain.connect(this.getDestinationNode());

    osc1.start(now);
    osc2.start(now);
    osc3.start(now);
    osc1.stop(now + duration + 0.2);
    osc2.stop(now + duration + 0.2);
    osc3.stop(now + duration + 0.2);
  }

  /**
   * Motor (Industrial conveyor & valve motor sound)
   */
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
    gain.connect(this.getDestinationNode());

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  /**
   * Power Down (Horror shutdown pitch dive)
   */
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
    oscGain.connect(this.getDestinationNode());

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  /**
   * Task Success (Industrial terminal high-clarity 2-tone success chime)
   * 880Hz (A5) -> 1320Hz (E6) clear marimba-style bell chime
   */
  public playTaskSuccess(): void {
    this.init();
    if (!this.ctx) return;

    const playTone = (freq: number, startDelay: number, duration: number, gainPeak: number) => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + startDelay;

      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Sine wave with slight triangle overtone for warm metallic chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 3, t);
      filter.frequency.exponentialRampToValueAtTime(freq * 1.5, t + duration);

      oscGain.gain.setValueAtTime(0.001, t);
      oscGain.gain.linearRampToValueAtTime(gainPeak, t + 0.012);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t + duration);

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(this.getDestinationNode());

      osc.start(t);
      osc.stop(t + duration + 0.05);
    };

    // First note: 880Hz (A5)
    playTone(880, 0, 0.22, 0.35);
    // Second note: 1320Hz (E6, pure fifth harmony)
    playTone(1320, 0.11, 0.45, 0.45);
  }

  public playSound(soundType: string, level = 3): void {
    switch (soundType) {
      case 'beep':
        this.playBeep();
        break;
      case 'shutter':
        this.playShutter();
        break;
      case 'lowImpact':
        this.playLowImpact();
        break;
      case 'taskSuccess':
        this.playTaskSuccess();
        break;
      case 'geiger':
        this.playGeiger(level);
        break;
      case 'drone':
        this.playDrone();
        break;
      case 'motor':
        this.playMotor();
        break;
      case 'powerDown':
        this.playPowerDown();
        break;
      default:
        this.playBeep();
        break;
    }
  }
}

export const getSoundEngine = () => SoundEngine.getInstance();
