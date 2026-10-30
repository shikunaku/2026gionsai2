/**
 * @file soundEngine.ts
 * @description Web Audio APIを利用したホラー・インダストリアル音響シンセサイザー。
 * 外部音声ファイルへの依存を排除し、オシレーター、ノイズジェネレーター、コンボリューションリバーブ、
 * コンプレッサーを動的に組み合わせて演出用音響（ビープ、機械式シャッター、重低音、ガイガーカウンター等）をプロシージャル生成します。
 */

import { SoundEffectOptions } from './types';

// ============================================================================
// 0. プリセット音源一覧の定義
// ============================================================================

export interface SoundPresetItem {
  type: SoundEffectOptions['soundType'];
  label: string;
  description: string;
  level?: number;
}

/** システム内蔵のプロシージャル合成音プリセット一覧 */
export const SOUND_PRESETS: SoundPresetItem[] = [
  { type: 'beep', label: '操作確認ビープ', description: '高域短音' },
  { type: 'lowImpact', label: '衝撃重低音', description: 'ドカンという重低音衝撃' },
  { type: 'geiger', label: 'ガイガー異変音', description: '放射線量急上昇クラック音', level: 4 },
  { type: 'drone', label: '不穏ドローン', description: '低域の持続的唸り音' },
  { type: 'motor', label: 'モーター駆動音', description: '機械のうなり・低速回転' },
  { type: 'powerDown', label: '電源降下音', description: '非常停止・電圧降下音' },
  { type: 'shutter', label: 'メカシャッター', description: 'カメラシャッター・絞り音' },
  { type: 'taskSuccess', label: 'タスク完了音', description: '点検合格・認証成功サイン' },
  { type: 'scream', label: '絶叫金属音 (恐怖)', description: '耳を劈く不協和音・金属スクリーチ' },
  { type: 'whisper', label: '不気味な囁き (怪異)', description: '低音囁き・不協和ステレオノイズ' },
  { type: 'glitchBurst', label: 'グリッチ破裂音', description: '激しい電気火花・破裂ノイズ' },
  { type: 'heartbeat', label: '急迫心拍 (生体パニック)', description: '低音サブウーファー心拍・ドクンドクン' },
  { type: 'interference', label: '電波妨害ノイズ', description: 'AMラジオ周波数混線・ヘテロダイン発振' },
  { type: 'eerieTone', label: '不吉な鐘・金属残響', description: '不気味な減衰金属音・廃墟の鐘' },
];

// ============================================================================
// 1. 音響エンジン クラス定義
// ============================================================================

export class SoundEngine {
  private static instance: SoundEngine | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private reverbNode: ConvolverNode | null = null;
  private unlocked = false;
  private currentVolume = 1.0;
  private activeGeigerTimer: NodeJS.Timeout | number | null = null;
  /** デコード済みAudioBufferのメモリキャッシュ (キー: ファイルパス) */
  private audioBufferCache = new Map<string, AudioBuffer>();
  /** 進行中のフェッチPromiseキャッシュ (二重フェッチ防止) */
  private pendingFetches = new Map<string, Promise<AudioBuffer | null>>();
  /** 現在再生中のAudioBufferSourceNodeリスト (停止制御用) */
  private activeSourceNodes = new Map<string, { source: AudioBufferSourceNode; gain: GainNode }[]>();

  private constructor() {}

  /**
   * SoundEngineのシングルトンインスタンスを取得します。
   * @returns {SoundEngine}
   */
  public static getInstance(): SoundEngine {
    if (!SoundEngine.instance) {
      SoundEngine.instance = new SoundEngine();
    }
    return SoundEngine.instance;
  }

  // ==========================================================================
  // A. 初期化 & オーディオバス構築
  // ==========================================================================

  /**
   * AudioContextの生成とユーザー操作によるAutoplay制約の解除を行います。
   */
  public init(): void {
    if (typeof window === 'undefined') return;
    if (this.ctx && this.unlocked && this.ctx.state === 'running') return;

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      if (!this.ctx) {
        this.ctx = new AudioCtxClass();
      }

      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch((err) => {
          console.warn('[SoundEngine] AudioContext resume error:', err);
        });
      }

      this.setupMasterBus();
      this.unlocked = true;
    } catch (e) {
      console.warn('[SoundEngine] AudioContext initialization error:', e);
    }
  }

  /**
   * マスターコンプレッサーとゲインノードによる出力バスを構築します。
   * 最大250%までの音量増幅に対応しつつ、過大入力による音割れ（デジタルクリッピング）を防止します。
   * @private
   */
  private setupMasterBus(): void {
    if (!this.ctx) return;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);

    // インダストリアルな重厚感を付与するダイナミクスコンプレッサー
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(20, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(8, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.002, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

    // 廃工場の空間反響を再現するコンボリューションリバーブ
    this.reverbNode = this.ctx.createConvolver();
    this.reverbNode.buffer = this.createImpulseResponse(2.7, 2.0);

    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
  }

  /**
   * ホワイトノイズと指数減衰エンベロープによるインパルス応答バッファを生成します。
   *
   * @param {number} durationSec リバーブの持続時間（秒）
   * @param {number} decay 減衰係数
   * @returns {AudioBuffer}
   * @private
   */
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

  // ==========================================================================
  // B. ボリューム制御 & ルーティング
  // ==========================================================================

  /**
   * マスターボリュームを設定します (0.0 〜 2.5)。
   * @param {number} vol 音量倍率
   */
  public setVolume(vol: number): void {
    this.currentVolume = Math.max(0, Math.min(2.5, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.currentVolume, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * 現在のマスターボリュームを取得します。
   * @returns {number}
   */
  public getVolume(): number {
    return this.currentVolume;
  }

  /**
   * 各サウンドノードの接続先となるマスターバスの入力ノードを取得します。
   * @private
   */
  private getDest(): AudioNode {
    if (!this.ctx) this.init();
    if (!this.compressor && this.ctx) this.setupMasterBus();
    return this.compressor || this.ctx!.destination;
  }

  /**
   * 標準的なオシレーターとエンベロープ（音量変化）のペアを構築する内部ヘルパー。
   *
   * @param {OscillatorType} type 波形種別 ('sine' | 'square' | 'sawtooth' | 'triangle')
   * @param {number} freq 周波数 (Hz)
   * @param {number} [startDelay=0] 再生開始遅延 (秒)
   * @param {number} [duration=0.1] 音の長さ (秒)
   * @param {number} [gainPeak=0.4] ピーク音量
   * @private
   */
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

    // クリックノイズを防ぐため、ごく微小な値から立ち上げて指数減衰
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + Math.min(0.015, duration * 0.1));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    osc.start(now);
    osc.stop(now + duration + 0.05);
    return { osc, gain, now };
  }

  // ==========================================================================
  // C. 個別効果音プロシージャル生成
  // ==========================================================================

  /** 操作確認音 (高域サイン波短音) */
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

  /** カメラの物理メカニカルシャッター音 */
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

    // 2段階のメカニカルなクリック音でリアルなシャッターを演出
    playClick(0, 0.038, 2600);
    playClick(0.065, 0.045, 1850);
  }

  /** 心臓に響く低周波の重低音サブベース（不穏演出） */
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

  /** ガイガーカウンター放射線検知音（不規則なパチパチ音） */
  public playGeiger(level = 3, durationMs = 2000): void {
    this.init();
    if (!this.ctx) return;
    if (this.activeGeigerTimer) {
      clearInterval(this.activeGeigerTimer as NodeJS.Timeout);
      this.activeGeigerTimer = null;
    }

    const interval = Math.max(25, 250 - level * 40);
    const endTime = Date.now() + durationMs;

    this.activeGeigerTimer = setInterval(() => {
      if (!this.ctx || Date.now() > endTime) {
        if (this.activeGeigerTimer) {
          clearInterval(this.activeGeigerTimer as NodeJS.Timeout);
          this.activeGeigerTimer = null;
        }
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

  /** 低周波の不気味なドローン持続音 */
  public playDrone(duration = 3.0): void {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, now);
    osc.frequency.linearRampToValueAtTime(50, now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.getDest());

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  /** モーター・機械稼働音 */
  public playMotor(duration = 2.0): void {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.linearRampToValueAtTime(240, now + 0.8);
    osc.frequency.linearRampToValueAtTime(235, now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.getDest());

    osc.start(now);
    osc.stop(now + duration + 0.1);
  }

  /** 絶叫金属音 (耳を劈く不協和音・金属スクリーチによるジャンプスケア音) */
  public playScream(duration = 1.8): void {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 不協和な多重オシレーター (鋸歯状波 + FM変調)
    const freqs = [840, 895, 1260, 1340, 2400];
    freqs.forEach((baseFreq, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i % 2 === 0 ? 'sawtooth' : 'square';
      
      // 悲鳴のように急上昇してからピッチが乱高下
      osc.frequency.setValueAtTime(baseFreq * 0.7, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.6, now + 0.15);
      osc.frequency.linearRampToValueAtTime(baseFreq * 0.9, now + duration * 0.7);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, now + duration);

      // 高出力で立ち上がり、徐々に歪みながら減衰
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.55 / freqs.length, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(600, now);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.getDest());

      osc.start(now);
      osc.stop(now + duration + 0.1);
    });

    // 激しいホワイトノイズバースト（金属の擦れる悲鳴感）
    const bufLen = Math.floor(this.ctx.sampleRate * Math.min(duration, 1.2));
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const output = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.8;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(3200, now);
    noiseFilter.Q.setValueAtTime(3.5, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.getDest());
    noise.start(now);
    noise.stop(now + duration + 0.05);
  }

  /** 不気味な囁き音 (ステレオ怪異・息遣い) */
  public playWhisper(duration = 2.5): void {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const bufLen = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(2, bufLen, this.ctx.sampleRate);
    const left = buf.getChannelData(0);
    const right = buf.getChannelData(1);

    // 有色ノイズで人の息や囁きの周波数帯を再現
    for (let i = 0; i < bufLen; i++) {
      const envelope = Math.sin((i / bufLen) * Math.PI);
      const mod = Math.sin((i / this.ctx.sampleRate) * 7.5);
      left[i] = (Math.random() * 2 - 1) * envelope * (0.5 + 0.5 * mod);
      right[i] = (Math.random() * 2 - 1) * envelope * (0.5 - 0.5 * mod);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.linearRampToValueAtTime(900, now + duration);
    filter.Q.setValueAtTime(4.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.45, now + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getDest());
    noise.start(now);
    noise.stop(now + duration + 0.1);
  }

  /** グリッチ破裂音 (ショート・電子回路スパーク・不穏な電気ノイズ) */
  public playGlitchBurst(duration = 0.35): void {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const bufLen = Math.floor(this.ctx.sampleRate * duration);
    const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const out = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      // 激しいデジタルクラッシュ・矩形波ノイズ
      out[i] = Math.random() > 0.4 ? (Math.random() > 0.5 ? 1 : -1) : 0;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buf;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.65, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getDest());
    noise.start(now);
    noise.stop(now + duration);
  }

  /** 急迫心拍音 (緊迫感・生体パニック「ドクン...ドクン...」) */
  public playHeartbeat(bpm = 135, beats = 6): void {
    this.init();
    if (!this.ctx) return;
    const interval = 60 / bpm;
    const baseNow = this.ctx.currentTime;

    for (let b = 0; b < beats; b++) {
      const beatTime = baseNow + b * interval;
      // 1回の心拍で2連打（「ド・クン」弁の開閉）
      [0, 0.12].forEach((offset, idx) => {
        if (!this.ctx) return;
        const t = beatTime + offset;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        // 45Hz -> 25Hzの超低周波サブベース
        osc.frequency.setValueAtTime(idx === 0 ? 55 : 42, t);
        osc.frequency.exponentialRampToValueAtTime(22, t + 0.15);

        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(idx === 0 ? 0.8 : 0.6, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

        osc.connect(gain);
        gain.connect(this.getDest());
        osc.start(t);
        osc.stop(t + 0.2);
      });
    }
  }

  /** 電波混線・AMヘテロダイン干渉音 (アナログホラーのラジオノイズ) */
  public playInterference(duration = 2.2): void {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 2つの近接した高周波オシレーターによるうなり（ビート）
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sawtooth';

    osc1.frequency.setValueAtTime(950, now);
    osc1.frequency.linearRampToValueAtTime(1400, now + duration * 0.4);
    osc1.frequency.linearRampToValueAtTime(600, now + duration);

    osc2.frequency.setValueAtTime(955, now);
    osc2.frequency.linearRampToValueAtTime(1412, now + duration * 0.4);
    osc2.frequency.linearRampToValueAtTime(608, now + duration);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1100, now);
    filter.Q.setValueAtTime(5.0, now);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(filter);
    filter.connect(this.getDest());

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.05);
    osc2.stop(now + duration + 0.05);
  }

  /** 不吉な金属ベル・残響音 (廃墟の警鐘・不気味な減衰ベル) */
  public playEerieTone(duration = 3.5): void {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // 非調和な倍音を持つ複数オシレーター
    const partials = [220, 311, 440, 587, 880];
    partials.forEach((f, i) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = i % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now);

      const decay = duration / (1 + i * 0.5);
      gain.gain.setValueAtTime(0.3 / partials.length, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      osc.connect(gain);
      gain.connect(this.getDest());
      osc.start(now);
      osc.stop(now + decay + 0.1);
    });
  }

  /** 電源喪失・ダウン音（周波数が落ちていく演出） */
  public playPowerDown(): void {
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 1.6;

    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + duration);

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

  /** ミッション達成・クリアチャイム音 */
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

  // ==========================================================================
  // D. MP3 / 音声ファイル再生 & キャッシュ管理
  // ==========================================================================

  /**
   * 指定された音声ファイルを非同期取得・デコードし、メモリ内にキャッシュします。
   * 同一ファイルへの同時リクエスト時は重複フェッチを防止します。
   *
   * @param {string} filename 音声ファイル名 (例: "alarm.mp3") または相対パス
   * @returns {Promise<AudioBuffer | null>} デコード済みAudioBuffer
   */
  public async loadAudioBuffer(filename: string): Promise<AudioBuffer | null> {
    this.init();
    if (!this.ctx) return null;

    // パス正規化 (スラッシュから始まらない場合は /audio/ を補完)
    const url = filename.startsWith('/') || filename.startsWith('http') ? filename : `/audio/${filename}`;

    // 1. メモリキャッシュにあれば即座に返却
    if (this.audioBufferCache.has(url)) {
      return this.audioBufferCache.get(url)!;
    }

    // 2. 既に同じURLのフェッチ・デコードが進行中であればそのPromiseを共有
    if (this.pendingFetches.has(url)) {
      return this.pendingFetches.get(url)!;
    }

    const fetchPromise = (async (): Promise<AudioBuffer | null> => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`[SoundEngine] Failed to fetch audio file [${url}]: HTTP ${response.status}`);
          return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        if (!this.ctx) return null;

        // Web Audio API でデコード (ブラウザのネイティブコーデックを使用)
        const audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.audioBufferCache.set(url, audioBuffer);
        return audioBuffer;
      } catch (err) {
        console.warn(`[SoundEngine] Error decoding audio file [${url}]:`, err);
        return null;
      } finally {
        this.pendingFetches.delete(url);
      }
    })();

    this.pendingFetches.set(url, fetchPromise);
    return fetchPromise;
  }

  /**
   * MP3/WAV等の音声ファイルを非同期再生します。
   *
   * @param {string} filename public/audio/ 配下のファイル名 (例: "alarm.mp3")
   * @param {object} [options] 再生オプション
   * @param {number} [options.volume=1.0] 個別音量倍率 (0.0 〜 2.5)
   * @param {boolean} [options.loop=false] ループ再生フラグ
   * @returns {Promise<boolean>} 再生開始に成功した場合 true
   */
  public async playAudioFile(
    filename: string,
    options: { volume?: number; loop?: boolean } = {}
  ): Promise<boolean> {
    this.init();
    if (!this.ctx) return false;

    const audioBuffer = await this.loadAudioBuffer(filename);
    if (!audioBuffer || !this.ctx) return false;

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.loop = !!options.loop;

    // 個別ゲインノード
    const gainNode = this.ctx.createGain();
    const targetVolume = typeof options.volume === 'number' ? Math.max(0, Math.min(2.5, options.volume)) : 1.0;
    gainNode.gain.setValueAtTime(targetVolume, this.ctx.currentTime);

    source.connect(gainNode);
    gainNode.connect(this.getDest());

    // 停止管理リストへ登録
    const activeList = this.activeSourceNodes.get(filename) || [];
    activeList.push({ source, gain: gainNode });
    this.activeSourceNodes.set(filename, activeList);

    source.onended = () => {
      const currentList = this.activeSourceNodes.get(filename) || [];
      const filtered = currentList.filter((item) => item.source !== source);
      if (filtered.length > 0) {
        this.activeSourceNodes.set(filename, filtered);
      } else {
        this.activeSourceNodes.delete(filename);
      }
    };

    source.start(0);
    return true;
  }

  /**
   * 指定されたファイル名の再生中音源を停止・フェードアウトします。
   *
   * @param {string} filename 停止対象のファイル名
   */
  public stopAudioFile(filename: string): void {
    const list = this.activeSourceNodes.get(filename);
    if (!list || !this.ctx) return;

    for (const { source, gain } of list) {
      try {
        gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
        setTimeout(() => {
          try {
            source.stop();
            source.disconnect();
          } catch (_) {}
        }, 90);
      } catch (_) {}
    }
    this.activeSourceNodes.delete(filename);
  }

  /**
   * 現在再生中のすべての外部音声ファイルを即座に停止します。
   */
  public stopAll(): void {
    if (!this.ctx) return;
    for (const [filename, list] of this.activeSourceNodes.entries()) {
      for (const { source } of list) {
        try {
          source.stop();
          source.disconnect();
        } catch (_) {}
      }
    }
    this.activeSourceNodes.clear();
  }

  /**
   * サウンド名またはファイル名に応じた音響を再生します。
   *
   * @param {SoundEffectOptions['soundType'] | string} soundType 再生する効果音名
   * @param {number} [level=3] 効果音の強度レベル
   * @param {string} [filename] MP3ファイル名 (soundType === 'file' の場合)
   */
  public playSound(
    soundType: SoundEffectOptions['soundType'] | string,
    level = 3,
    filename?: string
  ): void {
    if (soundType === 'file' && filename) {
      this.playAudioFile(filename).catch((err) => {
        console.warn(`[SoundEngine] playAudioFile error for [${filename}]:`, err);
      });
      return;
    }

    switch (soundType) {
      case 'beep': return this.playBeep();
      case 'shutter': return this.playShutter();
      case 'lowImpact': {
        this.playAudioFile('horror_jumpscare.mp3', { volume: 1.2 }).catch(() => {});
        return this.playLowImpact();
      }
      case 'taskSuccess': return this.playTaskSuccess();
      case 'geiger': return this.playGeiger(level);
      case 'drone': {
        this.playAudioFile('horror_creepy1.mp3', { volume: 0.9 }).catch(() => {});
        return this.playDrone();
      }
      case 'motor': return this.playMotor();
      case 'powerDown': return this.playPowerDown();
      case 'scream': {
        // 実音サンプリング（horror_scream.mp3）と激しい金属シンセをハイブリッド再生
        this.playAudioFile('horror_scream.mp3', { volume: 1.4 }).catch(() => {});
        return this.playScream();
      }
      case 'whisper': {
        this.playAudioFile('horror_creepy2.mp3', { volume: 1.0 }).catch(() => {});
        return this.playWhisper();
      }
      case 'glitchBurst': {
        this.playAudioFile('horror_shatter.mp3', { volume: 1.1 }).catch(() => {});
        return this.playGlitchBurst();
      }
      case 'heartbeat': return this.playHeartbeat();
      case 'interference': {
        this.playAudioFile('horror_radio.mp3', { volume: 1.0 }).catch(() => {});
        return this.playInterference();
      }
      case 'eerieTone': {
        this.playAudioFile('horror_bell.mp3', { volume: 1.2 }).catch(() => {});
        return this.playEerieTone();
      }
      default: return this.playBeep();
    }
  }

  /**
   * コンポーネント破棄時やページ遷移時にタイマーおよびオーディオコンテキストを解放します。
   */
  public dispose(): void {
    if (this.activeGeigerTimer) {
      clearInterval(this.activeGeigerTimer as NodeJS.Timeout);
      this.activeGeigerTimer = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      this.ctx.close().catch(() => {});
      this.ctx = null;
      this.unlocked = false;
      this.masterGain = null;
      this.compressor = null;
      this.reverbNode = null;
    }
  }
}

/** グローバルなSoundEngineインスタンスを取得するアクセサー */
export const getSoundEngine = () => SoundEngine.getInstance();
