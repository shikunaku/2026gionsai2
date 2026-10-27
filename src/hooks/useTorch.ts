'use client';

/**
 * @file useTorch.ts
 * @description Androidキオスク端末のネイティブBridge（AndroidKioskBridge / AndroidBridge / Android）
 * およびWeb MediaStreamTrack（CCTV/カメラプレビュー時のハイブリッド対応）を統合したトーチ制御カスタムフック。
 *
 * 【アーキテクチャ & 優先制御パイプライン】
 * 1. Native Kiosk Bridge (最優先):
 *    window.AndroidBridge, window.AndroidKioskBridge, window.Android を検索。
 *    turnOnTorch(), turnOffTorch(), setTorch(bool), flashBurst(interval, times),
 *    strobeTorch(onMs, offMs, count), stopFlash() / stopStrobe(), isTorchOn() を直接呼び出し。
 *    JS側のループ遅延を廃止し、Androidハードウェア層で正確なストロボ・バーストを実行。
 * 2. CCTV / Camera Active 専有時のハイブリッド・フォールバック:
 *    native側で available: false ("Torch unavailable (camera in use)") の場合、
 *    Web側で保持している MediaStreamTrack（または外部から渡された activeTrack）に対して
 *    track.applyConstraints({ advanced: [{ torch: state }] }) を安全に適用。
 * 3. イベント駆動ステート管理:
 *    Window CustomEvent ("torchStatusChange", "torchError") を購読し、
 *    React state (torchOn, isTorchAvailable, torchWarning, torchError) を即座に更新。
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  AndroidNativeBridge,
  TorchStatusChangeDetail,
  TorchErrorDetail,
} from '../lib/types';

/** Web MediaStreamTrack の W3C 制約拡張型（torchオプション用） */
interface ExtendedMediaTrackConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean;
}

export interface UseTorchOptions {
  /** 外部カメラ（CCTVやカメラプレビュー）で起動中のMediaStreamTrack。指定時はCCTV動作中のtorch適用に使用 */
  externalTrack?: MediaStreamTrack | null;
  /** トーチ点灯・消灯変化時の通知コールバック */
  onStateChange?: (state: boolean) => void;
}

/**
 * Androidキオスク端末 & Webハイブリッド対応のトーチ制御フック。
 *
 * @param onStateChangeOrOptions コールバック関数またはオプションオブジェクト
 */
export function useTorch(
  onStateChangeOrOptions?: ((state: boolean) => void) | UseTorchOptions
) {
  const onStateChange =
    typeof onStateChangeOrOptions === 'function'
      ? onStateChangeOrOptions
      : onStateChangeOrOptions?.onStateChange;

  const externalTrack =
    typeof onStateChangeOrOptions === 'object'
      ? onStateChangeOrOptions?.externalTrack
      : undefined;

  /** 現在のトーチ論理状態 (true: 点灯, false: 消灯) */
  const [torchOn, setTorchOn] = useState<boolean>(false);

  /** ネイティブトーチが利用可能か（カメラ専有中などは false） */
  const [isTorchAvailable, setIsTorchAvailable] = useState<boolean>(true);

  /** トーチ関連の警告メッセージ */
  const [torchWarning, setTorchWarning] = useState<string | null>(null);

  /** トーチ関連のエラーメッセージ */
  const [torchError, setTorchError] = useState<string | null>(null);

  /** 画面全体を白く発光させる視覚フォールバック用状態 */
  const [screenFlashActive, setScreenFlashActive] = useState<boolean>(false);

  /** 内部保持用カメラMediaStreamの参照（Web fallback用） */
  const streamRef = useRef<MediaStream | null>(null);

  /** 内部保持用ビデオトラック参照 */
  const trackRef = useRef<MediaStreamTrack | null>(null);

  /** 期待されるトーチ点灯状態（カメラ撮影から復帰時やフォーカス復帰時の整合性維持用） */
  const desiredTorchStateRef = useRef<boolean>(false);

  /** 点滅用タイマーID（ネイティブ非対応環境用フォールバック） */
  const fallbackTimerRef = useRef<NodeJS.Timeout | number | null>(null);

  // ==========================================================================
  // 1. ネイティブBridge取得
  // ==========================================================================

  const getNativeBridge = useCallback((): AndroidNativeBridge | null => {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as {
      AndroidBridge?: AndroidNativeBridge;
      AndroidKioskBridge?: AndroidNativeBridge;
      Android?: AndroidNativeBridge;
      [key: string]: unknown;
    };
    return (
      w.AndroidBridge ||
      w.AndroidKioskBridge ||
      w.Android ||
      null
    );
  }, []);

  // ==========================================================================
  // 2. Web MediaStream レイヤー (CCTV・getUserMedia動作中のフォールバック)
  // ==========================================================================

  const getEffectiveTrack = useCallback((): MediaStreamTrack | null => {
    if (externalTrack && externalTrack.readyState === 'live') {
      return externalTrack;
    }
    if (trackRef.current && trackRef.current.readyState === 'live') {
      return trackRef.current;
    }
    return null;
  }, [externalTrack]);

  const getWebTrack = useCallback(async (): Promise<MediaStreamTrack | null> => {
    const existing = getEffectiveTrack();
    if (existing) return existing;

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
      if (track) {
        trackRef.current = track;
        return track;
      }
      return null;
    } catch (err) {
      console.warn('[useTorch] Web Torch getUserMedia request failed or denied:', err);
      return null;
    }
  }, [getEffectiveTrack]);

  const applyWebTorch = useCallback(
    async (state: boolean): Promise<boolean> => {
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
        console.warn('[useTorch] applyWebTorch error:', err);
      }
      return false;
    },
    [getWebTrack]
  );

  // ==========================================================================
  // 3. 基本トーチ制御 (turnOn, turnOff, setTorch, toggleTorch)
  // ==========================================================================

  /**
   * ネイティブBridgeを優先してトーチを制御します。
   */
  const invokeNativeSetTorch = useCallback(
    (state: boolean): boolean => {
      const bridge = getNativeBridge();
      if (!bridge) return false;

      try {
        if (typeof bridge.setTorch === 'function') {
          bridge.setTorch(state);
          return true;
        }

        if (state) {
          if (typeof bridge.turnOnTorch === 'function') {
            bridge.turnOnTorch();
            return true;
          }
          if (typeof bridge.turnOnFlash === 'function') {
            bridge.turnOnFlash();
            return true;
          }
        } else {
          if (typeof bridge.turnOffTorch === 'function') {
            bridge.turnOffTorch();
            return true;
          }
          if (typeof bridge.turnOffFlash === 'function') {
            bridge.turnOffFlash();
            return true;
          }
        }
      } catch (err) {
        console.warn('[useTorch] invokeNativeSetTorch error:', err);
      }
      return false;
    },
    [getNativeBridge]
  );

  /**
   * トーチの点灯/消灯状態を設定します。
   * ネイティブBridge優先で実行し、カメラ専有時またはネイティブ非対応時はWebTrackへフォールバックします。
   */
  const setTorch = useCallback(
    async (state: boolean): Promise<boolean> => {
      desiredTorchStateRef.current = state;
      setTorchOn(state);
      if (onStateChange) {
        onStateChange(state);
      }

      // 1. ネイティブBridgeの呼び出し
      const nativeOk = invokeNativeSetTorch(state);

      // 2. カメラ専有時（isTorchAvailable === false）またはネイティブが存在しない場合はWebTrackを適用
      const activeTrack = getEffectiveTrack();
      if (!nativeOk || !isTorchAvailable || activeTrack) {
        const webOk = await applyWebTorch(state);
        if (webOk) return true;
      }

      return nativeOk;
    },
    [invokeNativeSetTorch, isTorchAvailable, getEffectiveTrack, applyWebTorch, onStateChange]
  );

  const turnOn = useCallback(async () => {
    return setTorch(true);
  }, [setTorch]);

  const turnOff = useCallback(async () => {
    return setTorch(false);
  }, [setTorch]);

  const toggleTorch = useCallback(() => {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.toggleFlash === 'function' && isTorchAvailable) {
      try {
        bridge.toggleFlash();
        const nextState = !torchOn;
        desiredTorchStateRef.current = nextState;
        setTorchOn(nextState);
        if (onStateChange) onStateChange(nextState);
        return;
      } catch (e) {
        console.warn('[useTorch] bridge.toggleFlash error:', e);
      }
    }
    setTorch(!torchOn);
  }, [getNativeBridge, isTorchAvailable, torchOn, setTorch, onStateChange]);

  // ==========================================================================
  // 4. ストロボ・点滅演出 (flashBurst, strobeTorch, stopStrobe)
  // ==========================================================================

  /**
   * 点滅・ストロボを停止します。
   */
  const stopStrobe = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      clearInterval(fallbackTimerRef.current as NodeJS.Timeout);
      fallbackTimerRef.current = null;
    }

    const bridge = getNativeBridge();
    if (bridge) {
      try {
        if (typeof bridge.stopStrobe === 'function') {
          bridge.stopStrobe();
        } else if (typeof bridge.stopFlash === 'function') {
          bridge.stopFlash();
        }
      } catch (e) {
        console.warn('[useTorch] stopStrobe error:', e);
      }
    }
  }, [getNativeBridge]);

  const stopBlink = stopStrobe;

  /**
   * 単一API呼び出しによる高速ストロボ点滅。
   * JS側でループを回さず、ネイティブの strobeTorch / flashBurst を直接実行。
   */
  const strobe = useCallback(
    (onDurationMs = 80, offDurationMs = 80, repeatCount = 10) => {
      stopStrobe();

      const bridge = getNativeBridge();

      // 1. ネイティブの strobeTorch(onMs, offMs, count) または flashBurst(interval, count)
      if (bridge && isTorchAvailable) {
        try {
          if (typeof bridge.strobeTorch === 'function') {
            bridge.strobeTorch(onDurationMs, offDurationMs, repeatCount);
            return;
          }
          if (typeof bridge.flashBurst === 'function') {
            bridge.flashBurst(onDurationMs + offDurationMs, repeatCount);
            return;
          }
        } catch (e) {
          console.warn('[useTorch] Native strobe failed, falling back to timer:', e);
        }
      }

      // 2. フォールバック（WebTrack または JS タイマーループ）
      let current = 0;
      let currentState = false;
      const totalSteps = repeatCount * 2;
      const interval = Math.max(40, Math.floor((onDurationMs + offDurationMs) / 2));

      fallbackTimerRef.current = setInterval(() => {
        current++;
        if (current > totalSteps) {
          stopStrobe();
          setTorch(false);
          return;
        }

        currentState = current % 2 === 1;
        desiredTorchStateRef.current = currentState;
        setTorchOn(currentState);
        if (onStateChange) onStateChange(currentState);

        const activeTrack = getEffectiveTrack();
        if (activeTrack && activeTrack.readyState === 'live') {
          const constraints: { advanced: ExtendedMediaTrackConstraintSet[] } = {
            advanced: [{ torch: currentState }],
          };
          activeTrack.applyConstraints(constraints).catch(() => {});
        } else {
          invokeNativeSetTorch(currentState);
        }
      }, interval);
    },
    [stopStrobe, getNativeBridge, isTorchAvailable, getEffectiveTrack, onStateChange, setTorch, invokeNativeSetTorch]
  );

  /** レガシー互換のフリッカーメソッド */
  const flicker = useCallback(
    (count = 5, intervalMs = 100, finalState = false) => {
      strobe(intervalMs / 2, intervalMs / 2, count);
      if (finalState) {
        setTimeout(() => {
          setTorch(true);
        }, count * intervalMs + 50);
      }
    },
    [strobe, setTorch]
  );

  /** パターン点滅 */
  const blinkPattern = useCallback(
    (pattern: string, intervalMs = 100, finalState = false) => {
      stopStrobe();

      const tokens: boolean[] = pattern.includes(',')
        ? pattern.split(',').map((t) => {
            const s = t.trim().toLowerCase();
            return s === '1' || s === 'true' || s === 'on';
          })
        : pattern.split('').map((char) => char === '1');

      if (tokens.length === 0) return;

      let idx = 0;
      fallbackTimerRef.current = setInterval(() => {
        if (idx >= tokens.length) {
          stopStrobe();
          setTorch(finalState);
          return;
        }

        const state = tokens[idx];
        desiredTorchStateRef.current = state;
        setTorchOn(state);
        if (onStateChange) onStateChange(state);

        const activeTrack = getEffectiveTrack();
        if (activeTrack && activeTrack.readyState === 'live') {
          const constraints: { advanced: ExtendedMediaTrackConstraintSet[] } = {
            advanced: [{ torch: state }],
          };
          activeTrack.applyConstraints(constraints).catch(() => {});
        } else {
          invokeNativeSetTorch(state);
        }
        idx++;
      }, Math.max(40, intervalMs));
    },
    [stopStrobe, setTorch, onStateChange, getEffectiveTrack, invokeNativeSetTorch]
  );

  // ==========================================================================
  // 5. リソース解放
  // ==========================================================================

  const releaseTorch = useCallback(() => {
    desiredTorchStateRef.current = false;
    setTorchOn(false);
    stopStrobe();

    invokeNativeSetTorch(false);

    if (trackRef.current) {
      const constraints: { advanced: ExtendedMediaTrackConstraintSet[] } = {
        advanced: [{ torch: false }],
      };
      trackRef.current.applyConstraints(constraints).catch(() => {});
      trackRef.current.stop();
      trackRef.current = null;
    }
  }, [stopStrobe, invokeNativeSetTorch]);

  // ==========================================================================
  // 6. CustomEvent リスナー (torchStatusChange & torchError) & 復帰監視
  // ==========================================================================

  useEffect(() => {
    // ネイティブ側からの torchStatusChange イベント
    const handleTorchStatusChange = (e: Event) => {
      const customEvent = e as CustomEvent<TorchStatusChangeDetail>;
      const detail = customEvent.detail;
      if (!detail) return;

      console.log('[useTorch] torchStatusChange event:', detail);
      setTorchOn(detail.enabled);
      setIsTorchAvailable(detail.available);
      setTorchWarning(detail.warning);

      if (onStateChange) {
        onStateChange(detail.enabled);
      }

      // カメラ専有でネイティブが利用不能になった場合、もしWeb側でMediaStreamTrackがあればそちらへtorchを即同期
      if (!detail.available && desiredTorchStateRef.current) {
        const activeTrack = getEffectiveTrack();
        if (activeTrack && activeTrack.readyState === 'live') {
          console.log('[useTorch] Native torch unavailable (camera in use). Applying web track constraints fallback.');
          const constraints: { advanced: ExtendedMediaTrackConstraintSet[] } = {
            advanced: [{ torch: true }],
          };
          activeTrack.applyConstraints(constraints).catch(() => {});
        }
      }
    };

    // ネイティブ側からの torchError イベント
    const handleTorchError = (e: Event) => {
      const customEvent = e as CustomEvent<TorchErrorDetail>;
      const detail = customEvent.detail;
      console.warn('[useTorch] torchError event received:', detail);
      if (detail?.error) {
        setTorchError(detail.error);
      }
    };

    window.addEventListener('torchStatusChange', handleTorchStatusChange);
    window.addEventListener('torchError', handleTorchError);

    // 画面フォーカス復帰時の復元処理
    const handleRestoreTorch = () => {
      if (desiredTorchStateRef.current) {
        console.log('[useTorch] Auto-restoring torch after camera return / focus...');
        setTorch(true);
      }
    };

    window.addEventListener('focus', handleRestoreTorch);
    window.addEventListener('pageshow', handleRestoreTorch);
    document.addEventListener('visibilitychange', handleRestoreTorch);

    // ネイティブ初期状態のポーリング同期 (マウント直後)
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.isTorchOn === 'function') {
      try {
        const isOn = bridge.isTorchOn();
        setTorchOn(isOn);
      } catch {}
    }

    return () => {
      window.removeEventListener('torchStatusChange', handleTorchStatusChange);
      window.removeEventListener('torchError', handleTorchError);
      window.removeEventListener('focus', handleRestoreTorch);
      window.removeEventListener('pageshow', handleRestoreTorch);
      document.removeEventListener('visibilitychange', handleRestoreTorch);
      stopStrobe();
      releaseTorch();
    };
  }, [getNativeBridge, onStateChange, setTorch, stopStrobe, releaseTorch, getEffectiveTrack]);

  return {
    torchOn,
    isTorchOn: torchOn,
    isTorchAvailable,
    torchWarning,
    torchError,
    screenFlashActive,
    turnOn,
    turnOff,
    setTorch,
    toggleTorch,
    strobe,
    stopStrobe,
    flicker,
    blinkPattern,
    stopBlink,
    releaseTorch,
  };
}
