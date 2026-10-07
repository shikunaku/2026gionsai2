'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import '../lib/types';

export function useTorch(onStateChange?: (state: boolean) => void) {
  const [torchOn, setTorchOn] = useState(false);
  const [screenFlashActive, setScreenFlashActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const flickerTimerRef = useRef<any>(null);
  const desiredTorchStateRef = useRef<boolean>(false);
  const isWebTorchSupportedRef = useRef<boolean | null>(null);

  /**
   * Helper: Call Native Android/iOS App Bridge (Zero-lag synchronous execution)
   * Supports common interface signatures provided by dedicated WebView containers.
   */
  const invokeNativeBridge = useCallback((state: boolean): boolean => {
    const bridge =
      (window as any).Android ||
      (window as any).AndroidBridge ||
      (window as any).android ||
      (window as any).FlashlightBridge ||
      (window as any).TorchBridge;

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
  }, []);

  /**
   * Singleton Web MediaStreamTrack acquisition
   * Keeps track alive to avoid 500-1000ms camera start latency.
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
      const capabilities = (track.getCapabilities && track.getCapabilities()) || {};

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

  /**
   * Core setTorch function
   * Priority: 1. Native App Bridge -> 2. Web MediaStreamTrack Torch -> 3. (Optional) Screen Flash fallback
   */
  const setTorch = useCallback(
    async (state: boolean): Promise<boolean> => {
      desiredTorchStateRef.current = state;
      setTorchOn(state);
      if (onStateChange) onStateChange(state);

      // 1. Native Dedicated App Bridge (Synchronous & instant)
      if (invokeNativeBridge(state)) {
        return true;
      }

      // 2. Web ImageCapture / MediaStreamTrack Torch
      try {
        const track = await getWebTrack();
        if (track && track.readyState === 'live') {
          await (track as any).applyConstraints({
            advanced: [{ torch: state }],
          });
          return true;
        }
      } catch (err) {
        console.warn('[useTorch] applyConstraints torch error:', err);
      }

      return false;
    },
    [onStateChange, invokeNativeBridge, getWebTrack]
  );

  const toggleTorch = useCallback(() => {
    setTorch(!torchOn);
  }, [torchOn, setTorch]);

  /**
   * Stop any active blinking (both native Android and web fallback timer)
   */
  const stopBlink = useCallback(() => {
    if (flickerTimerRef.current) {
      clearInterval(flickerTimerRef.current);
      flickerTimerRef.current = null;
    }

    const bridge =
      (window as any).Android ||
      (window as any).AndroidBridge ||
      (window as any).android ||
      (window as any).FlashlightBridge ||
      (window as any).TorchBridge;

    if (bridge && typeof bridge.stopBlink === 'function') {
      try {
        bridge.stopBlink();
      } catch (e) {
        console.warn('[useTorch] bridge.stopBlink error:', e);
      }
    }
  }, []);

  /**
   * High-speed non-blocking flicker:
   * 1. If native Android.blink is available, delegates directly to native hardware loop (0 lag, zero JS timer stall).
   * 2. Otherwise falls back to old bridge / Web MediaStreamTrack loop.
   */
  const flicker = useCallback(
    (count = 5, intervalMs = 100, finalState = false) => {
      // Cancel previous blink / timers
      stopBlink();

      const bridge =
        (window as any).Android ||
        (window as any).AndroidBridge ||
        (window as any).android ||
        (window as any).FlashlightBridge ||
        (window as any).TorchBridge;

      // 1. Android App New Native API: blink(count, intervalMs)
      if (bridge && typeof bridge.blink === 'function') {
        try {
          bridge.blink(count, intervalMs);
          desiredTorchStateRef.current = finalState;
          if (finalState) {
            // Schedule final state if true, since blink ends turned off
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

      // 2. Web / Legacy Native Fallback Loop
      let current = 0;
      let currentState = false;
      const totalSteps = count * 2;
      const speed = Math.max(50, intervalMs);

      flickerTimerRef.current = setInterval(() => {
        current++;
        if (current > totalSteps) {
          if (flickerTimerRef.current) {
            clearInterval(flickerTimerRef.current);
            flickerTimerRef.current = null;
          }
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
          } else if (currentState) {
            bridge.turnOnFlash?.() || bridge.turnOnTorch?.() || bridge.setFlashlight?.(true);
          } else {
            bridge.turnOffFlash?.() || bridge.turnOffTorch?.() || bridge.setFlashlight?.(false);
          }
        } else {
          // Asynchronously apply Web constraint without blocking loop
          if (trackRef.current && trackRef.current.readyState === 'live') {
            (trackRef.current as any)
              .applyConstraints({ advanced: [{ torch: currentState }] })
              .catch(() => {});
          }
        }
      }, speed);
    },
    [stopBlink, setTorch, onStateChange]
  );

  /**
   * Custom rhythm / pattern blink:
   * 1. If Android.blinkPattern is available, delegates to native Android.blinkPattern(pattern, intervalMs).
   * 2. Otherwise runs a web fallback timer with the parsed pattern steps.
   */
  const blinkPattern = useCallback(
    (pattern: string, intervalMs = 100, finalState = false) => {
      stopBlink();

      const bridge =
        (window as any).Android ||
        (window as any).AndroidBridge ||
        (window as any).android ||
        (window as any).FlashlightBridge ||
        (window as any).TorchBridge;

      // 1. Android App New Native API: blinkPattern(pattern, intervalMs)
      if (bridge && typeof bridge.blinkPattern === 'function') {
        try {
          bridge.blinkPattern(pattern, intervalMs);
          desiredTorchStateRef.current = finalState;
          if (finalState) {
            // Estimate duration based on pattern tokens
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

      // 2. Parse pattern for fallback timer ("1,0,1,0" or "1010" or "true,false")
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
          if (flickerTimerRef.current) {
            clearInterval(flickerTimerRef.current);
            flickerTimerRef.current = null;
          }
          setTorch(finalState);
          return;
        }

        const state = tokens[idx];
        desiredTorchStateRef.current = state;
        setTorchOn(state);
        if (onStateChange) onStateChange(state);

        if (bridge) {
          if (state) {
            bridge.turnOnFlash?.() || bridge.turnOnTorch?.() || bridge.setFlashlight?.(true);
          } else {
            bridge.turnOffFlash?.() || bridge.turnOffTorch?.() || bridge.setFlashlight?.(false);
          }
        } else if (trackRef.current && trackRef.current.readyState === 'live') {
          (trackRef.current as any)
            .applyConstraints({ advanced: [{ torch: state }] })
            .catch(() => {});
        }
        idx++;
      }, Math.max(50, intervalMs));
    },
    [stopBlink, setTorch, onStateChange]
  );

  /**
   * Cleanup and complete shutdown of all torch hardware
   */
  const releaseTorch = useCallback(() => {
    desiredTorchStateRef.current = false;
    setTorchOn(false);
    stopBlink();

    invokeNativeBridge(false);

    if (trackRef.current) {
      (trackRef.current as any)
        .applyConstraints({ advanced: [{ torch: false }] })
        .catch(() => {});
      trackRef.current.stop();
      trackRef.current = null;
    }
  }, [invokeNativeBridge, stopBlink]);

  /**
   * Auto-restore torch after camera capture / app focus:
   * When user returns from taking a photo via file input, OS camera app releases the hardware LED.
   * On window focus or visibilitychange, automatically re-apply the desired torch state.
   */
  useEffect(() => {
    const handleRestoreTorch = () => {
      if (document.visibilityState === 'visible' && desiredTorchStateRef.current) {
        setTimeout(() => {
          if (desiredTorchStateRef.current) {
            console.log('[useTorch] Auto-restoring torch after camera return / focus...');
            setTorch(true);
          }
        }, 300);
      }
    };

    window.addEventListener('focus', handleRestoreTorch);
    document.addEventListener('visibilitychange', handleRestoreTorch);

    return () => {
      window.removeEventListener('focus', handleRestoreTorch);
      document.removeEventListener('visibilitychange', handleRestoreTorch);
      releaseTorch();
    };
  }, [setTorch, releaseTorch]);

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
