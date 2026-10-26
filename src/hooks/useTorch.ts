'use client';

/**
 * @file useTorch.ts
 * @description スマートフォン端末のLEDフラッシュライト（トーチ）および画面フラッシュ演出を制御するカスタムフック。
 *
 * 【アーキテクチャ & 優先制御パイプライン】
 * 1. Native App Bridge: Android/iOS 専用WebViewコンテナが提供する同期Java/ObjCインターフェースを最優先実行。
 *    （WebブラウザのMediaStream起動に伴う 500〜1000ms の遅延をゼロにし、演出音響とのフレーム単位同期を実現）
 * 2. Web MediaStreamTrack Torch: ブラウザ標準の navigator.mediaDevices.getUserMedia + applyConstraints({ torch })
 * 3. Screen Flash Fallback: カメラLEDが物理的に存在しない/拒否された場合の画面白色発光フォールバック
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================================
// 1. ネイティブBridge型定義
// ============================================================================

/** ネイティブWebViewコンテナ（Android/iOS）が注入するBridgeオブジェクトの仕様 */
export interface NativeTorchBridge {
  turnOnFlash?: () => void;
  turnOffFlash?: () => void;
  toggleFlash?: () => void;
  turnOnTorch?: () => void;
  turnOffTorch?: () => void;
  setFlashlight?: (state: boolean) => void;
  setTorch?: (state: boolean) => void;
  setFlash?: (state: boolean) => void;
  blink?: (count: number, intervalMs: number) => void;
  blinkPattern?: (pattern: string, intervalMs: number) => void;
  stopBlink?: () => void;
  isFlashOn?: () => boolean;
  isTorchOn?: () => boolean;
  getBatteryLevel?: () => number;
}

/** Web MediaStreamTrack の W3C 制約拡張型（torchオプション用） */
interface ExtendedMediaTrackConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean;
}

// ============================================================================
// 2. カスタムフック本体
// ============================================================================

/**
 * スマートフォンのLEDトーチ・点滅・復帰処理を管理するカスタムフック。
 *
 * @param {(state: boolean) => void} [onStateChange] トーチの点灯・消灯状態が変化した際の通知コールバック
 * @returns フック操作用オブジェクト
 */
export function useTorch(onStateChange?: (state: boolean) => void) {
  /** 現在のトーチ論理状態 (true: 点灯, false: 消灯) */
  const [torchOn, setTorchOn] = useState(false);

  /** 画面全体を白く発光させる視覚フォールバック用状態 */
  const [screenFlashActive, setScreenFlashActive] = useState(false);

  /** カメラMediaStreamの参照（再オープン遅延を防ぐためシングルトン保持） */
  const streamRef = useRef<MediaStream | null>(null);

  /** トーチ制約を適用するビデオトラック参照 */
  const trackRef = useRef<MediaStreamTrack | null>(null);

  /** Web fallback 点滅用タイマーID */
  const flickerTimerRef = useRef<NodeJS.Timeout | number | null>(null);

  /** 期待されるトーチ点灯状態（カメラ撮影から復帰時やフォーカス復帰時の整合性維持用） */
  const desiredTorchStateRef = useRef<boolean>(false);

  /** ブラウザがWeb標準のtorch制約に対応しているかの判定キャッシュ */
  const isWebTorchSupportedRef = useRef<boolean | null>(null);

  // ==========================================================================
  // A. ネイティブBridge連携レイヤー
  // ==========================================================================

  /**
   * windowオブジェクトに注入された各種ネイティブBridgeインスタンスを取得します。
   * @private
   */
  const getNativeBridge = useCallback((): NativeTorchBridge | null => {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as Record<string, unknown>;
    return (
      (w.Android as NativeTorchBridge) ||
      (w.AndroidBridge as NativeTorchBridge) ||
      (w.android as NativeTorchBridge) ||
      (w.FlashlightBridge as NativeTorchBridge) ||
      (w.TorchBridge as NativeTorchBridge) ||
      null
    );
  }, []);

  /**
   * ネイティブBridgeを同期呼び出しし、LEDを制御します。
   *
   * @param {boolean} state 点灯(true) / 消灯(false)
   * @returns {boolean} ネイティブ側で処理が完了した場合は true
   * @private
   */
  const invokeNativeBridge = useCallback(
    (state: boolean): boolean => {
      const bridge = getNativeBridge();
      if (!bridge) return false;

      try {
        if (state) {
          if (typeof bridge.turnOnFlash === 'function') {
            bridge.turnOnFlash();
            return true;
          } else if (typeof bridge.turnOnTorch === 'function') {
            bridge.turnOnTorch();
            return true;
          } else if (typeof bridge.toggleFlash === 'function') {
            bridge.toggleFlash();
            return true;
          } else if (typeof bridge.setFlashlight === 'function') {
            bridge.setFlashlight(true);
            return true;
          } else if (typeof bridge.setTorch === 'function') {
            bridge.setTorch(true);
            return true;
          } else if (typeof bridge.setFlash === 'function') {
            bridge.setFlash(true);
            return true;
          }
        } else {
          if (typeof bridge.turnOffFlash === 'function') {
            bridge.turnOffFlash();
            return true;
          } else if (typeof bridge.turnOffTorch === 'function') {
            bridge.turnOffTorch();
            return true;
          } else if (typeof bridge.setFlashlight === 'function') {
            bridge.setFlashlight(false);
            return true;
          } else if (typeof bridge.setTorch === 'function') {
            bridge.setTorch(false);
            return true;
          } else if (typeof bridge.setFlash === 'function') {
            bridge.setFlash(false);
            return true;
          }
        }
      } catch (err) {
        console.warn('[useTorch] Native Bridge execution error:', err);
      }
      return false;
    },
    [getNativeBridge]
  );

  // ==========================================================================
  // B. Web MediaStream レイヤー (ブラウザ標準)
  // ==========================================================================

  /**
   * カメラストリームを取得し、トーチ機能を持つトラックを返します。
   * 毎回カメラを起動すると500〜1000msの遅延が生じるため、同一トラックを保持・再利用します。
   *
   * @returns {Promise<MediaStreamTrack | null>}
   * @private
   */
  const getWebTrack = useCallback(async (): Promise<MediaStreamTrack | null> => {
    if (trackRef.current && trackRef.current.readyState === 'live') {
      return trackRef.current;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? (track.getCapabilities() as { torch?: boolean }) : {};

      if ('torch' in capabilities) {
        isWebTorchSupportedRef.current = true;
        trackRef.current = track;
        return track;
      } else {
        isWebTorchSupportedRef.current = false;
        track.stop();
        return null;
      }
    } catch (err) {
      console.warn('[useTorch] Web Torch getUserMedia request failed or denied:', err);
      isWebTorchSupportedRef.current = false;
      return null;
    }
  }, []);

  // ==========================================================================
  // C. トーチ基本制御 (点灯・消灯・切替)
  // ==========================================================================

  /**
   * トーチの点灯/消灯状態を設定します。
   * 1. ネイティブBridge -> 2. Web MediaStream Track の優先順位で適用します。
   *
   * @param {boolean} state 点灯(true) / 消灯(false)
   * @returns {Promise<boolean>} 点灯適用に成功した場合 true
   */
  const setTorch = useCallback(
    async (state: boolean): Promise<boolean> => {
      desiredTorchStateRef.current = state;
      setTorchOn(state);
      if (onStateChange) onStateChange(state);

      // 1. ネイティブBridgeの呼び出し
      if (invokeNativeBridge(state)) {
        return true;
      }

      // 2. ブラウザ標準 Web Torch の適用
      try {
        const track = await getWebTrack();
        if (track && track.readyState === 'live') {
          const constraints: { advanced: ExtendedMediaTrackConstraintSet[] } = {
            advanced: [{ torch: state }],
          };
          await track.applyConstraints(constraints);
          return true;
        }
      } catch (err) {
        console.warn('[useTorch] applyConstraints torch error:', err);
      }

      return false;
    },
    [onStateChange, invokeNativeBridge, getWebTrack]
  );

  /** トーチの点灯状態を反転します */
  const toggleTorch = useCallback(() => {
    setTorch(!torchOn);
  }, [torchOn, setTorch]);

  // ==========================================================================
  // D. 点滅・フリッカー演出制御
  // ==========================================================================

  /**
   * 現在進行中の点滅タイマーおよびネイティブ側の点滅ループを直ちに停止します。
   */
  const stopBlink = useCallback(() => {
    if (flickerTimerRef.current !== null) {
      clearInterval(flickerTimerRef.current as NodeJS.Timeout);
      flickerTimerRef.current = null;
    }

    const bridge = getNativeBridge();
    if (bridge && typeof bridge.stopBlink === 'function') {
      try {
        bridge.stopBlink();
      } catch (e) {
        console.warn('[useTorch] bridge.stopBlink error:', e);
      }
    }
  }, [getNativeBridge]);

  /**
   * 高速フリッカー（点滅）演出を実行します。
   * ネイティブに専用API (blink) がある場合はJSメインスレッドをブロックしないよう完全委譲します。
   *
   * @param {number} [count=5] 点滅回数
   * @param {number} [intervalMs=100] 点滅間隔 (ミリ秒)
   * @param {boolean} [finalState=false] 点滅完了後の最終状態 (true: 点灯, false: 消灯)
   */
  const flicker = useCallback(
    (count = 5, intervalMs = 100, finalState = false) => {
      stopBlink();

      const bridge = getNativeBridge();

      // 1. Androidネイティブハードウェアループ (最速・ラグなし)
      if (bridge && typeof bridge.blink === 'function') {
        try {
          bridge.blink(count, intervalMs);
          desiredTorchStateRef.current = finalState;
          if (finalState) {
            setTimeout(() => {
              if (desiredTorchStateRef.current) {
                setTorch(true);
              }
            }, count * 2 * intervalMs + 50);
          } else {
            setTorchOn(false);
            if (onStateChange) onStateChange(false);
          }
          return;
        } catch (e) {
          console.warn('[useTorch] bridge.blink error, falling back to timer:', e);
        }
      }

      // 2. Web標準 / レガシーBridge用 タイマーループ
      let current = 0;
      let currentState = false;
      const totalSteps = count * 2;
      const speed = Math.max(50, intervalMs);

      flickerTimerRef.current = setInterval(() => {
        current++;
        if (current > totalSteps) {
          stopBlink();
          setTorch(finalState);
          return;
        }

        currentState = current % 2 === 1;
        desiredTorchStateRef.current = currentState;
        setTorchOn(currentState);
        if (onStateChange) onStateChange(currentState);

        if (bridge) {
          if (typeof bridge.toggleFlash === 'function') {
            bridge.toggleFlash();
          } else {
            invokeNativeBridge(currentState);
          }
        } else if (trackRef.current && trackRef.current.readyState === 'live') {
          const constraints: { advanced: ExtendedMediaTrackConstraintSet[] } = {
            advanced: [{ torch: currentState }],
          };
          trackRef.current.applyConstraints(constraints).catch(() => {});
        }
      }, speed);
    },
    [stopBlink, getNativeBridge, setTorch, onStateChange]
  );

  /**
   * カスタムリズム/パターン点滅演出を実行します。
   *
   * @param {string} pattern 点滅パターン文字列 (例: "1,0,1,1,0" または "10110")
   * @param {number} [intervalMs=100] ステップごとの時間 (ミリ秒)
   * @param {boolean} [finalState=false] 点滅完了後の最終状態
   */
  const blinkPattern = useCallback(
    (pattern: string, intervalMs = 100, finalState = false) => {
      stopBlink();

      const bridge = getNativeBridge();

      // 1. AndroidネイティブパターンAPI
      if (bridge && typeof bridge.blinkPattern === 'function') {
        try {
          bridge.blinkPattern(pattern, intervalMs);
          desiredTorchStateRef.current = finalState;
          if (finalState) {
            const stepsCount = pattern.includes(',') ? pattern.split(',').length : pattern.length;
            setTimeout(() => {
              if (desiredTorchStateRef.current) {
                setTorch(true);
              }
            }, stepsCount * intervalMs + 50);
          } else {
            setTorchOn(false);
            if (onStateChange) onStateChange(false);
          }
          return;
        } catch (e) {
          console.warn('[useTorch] bridge.blinkPattern error, falling back to timer:', e);
        }
      }

      // 2. パターン文字列のパース ("1,0,1,0" または "1010")
      const tokens: boolean[] = pattern.includes(',')
        ? pattern.split(',').map((t) => {
            const s = t.trim().toLowerCase();
            return s === '1' || s === 'true' || s === 'on';
          })
        : pattern.split('').map((char) => char === '1');

      if (tokens.length === 0) return;

      let idx = 0;
      flickerTimerRef.current = setInterval(() => {
        if (idx >= tokens.length) {
          stopBlink();
          setTorch(finalState);
          return;
        }

        const state = tokens[idx];
        desiredTorchStateRef.current = state;
        setTorchOn(state);
        if (onStateChange) onStateChange(state);

        if (bridge) {
          invokeNativeBridge(state);
        } else if (trackRef.current && trackRef.current.readyState === 'live') {
          const constraints: { advanced: ExtendedMediaTrackConstraintSet[] } = {
            advanced: [{ torch: state }],
          };
          trackRef.current.applyConstraints(constraints).catch(() => {});
        }
        idx++;
      }, Math.max(50, intervalMs));
    },
    [stopBlink, getNativeBridge, setTorch, onStateChange]
  );

  // ==========================================================================
  // E. リソース解放 & 自動復帰 (Watchdog)
  // ==========================================================================

  /**
   * すべてのトーチハードウェアを安全に停止し、カメラトラックをOSに返却します。
   */
  const releaseTorch = useCallback(() => {
    desiredTorchStateRef.current = false;
    setTorchOn(false);
    stopBlink();

    invokeNativeBridge(false);

    if (trackRef.current) {
      const constraints: { advanced: ExtendedMediaTrackConstraintSet[] } = {
        advanced: [{ torch: false }],
      };
      trackRef.current.applyConstraints(constraints).catch(() => {});
      trackRef.current.stop();
      trackRef.current = null;
    }
  }, [invokeNativeBridge, stopBlink]);

  /**
   * 復帰監視 & ウォッチドッグタイマー:
   * ユーザーがHTML写真撮影から戻った際や、画面復帰時にLEDが消灯してしまうブラウザの挙動を防ぎ、
   * アトラクションの没入感を損なわないよう状態を自動復元します。
   */
  useEffect(() => {
    const handleRestoreTorch = () => {
      if (desiredTorchStateRef.current) {
        console.log('[useTorch] Auto-restoring torch after camera return / focus...');
        setTorch(true);
        setTimeout(() => {
          if (desiredTorchStateRef.current) {
            setTorch(true);
          }
        }, 300);
      }
    };

    window.addEventListener('focus', handleRestoreTorch);
    window.addEventListener('pageshow', handleRestoreTorch);
    document.addEventListener('visibilitychange', handleRestoreTorch);

    // 1.5秒ごとのウォッチドッグ（点灯指示中にもかかわらず消灯していた場合の自己修復）
    const watchdogInterval = setInterval(() => {
      if (desiredTorchStateRef.current && document.visibilityState === 'visible') {
        const bridge = getNativeBridge();
        if (bridge) {
          const isActuallyOn =
            typeof bridge.isFlashOn === 'function'
              ? bridge.isFlashOn()
              : typeof bridge.isTorchOn === 'function'
              ? bridge.isTorchOn()
              : null;

          if (isActuallyOn === false || isActuallyOn === null) {
            invokeNativeBridge(true);
          }
        } else if (trackRef.current && trackRef.current.readyState === 'live') {
          const constraints: { advanced: ExtendedMediaTrackConstraintSet[] } = {
            advanced: [{ torch: true }],
          };
          trackRef.current.applyConstraints(constraints).catch(() => {});
        }
      }
    }, 1500);

    return () => {
      window.removeEventListener('focus', handleRestoreTorch);
      window.removeEventListener('pageshow', handleRestoreTorch);
      document.removeEventListener('visibilitychange', handleRestoreTorch);
      clearInterval(watchdogInterval);
      releaseTorch();
    };
  }, [setTorch, invokeNativeBridge, releaseTorch, getNativeBridge]);

  return {
    torchOn,
    screenFlashActive,
    setTorch,
    toggleTorch,
    flicker,
    blinkPattern,
    stopBlink,
    releaseTorch,
  };
}
