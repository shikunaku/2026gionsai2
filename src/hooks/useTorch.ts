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
   * High-speed non-blocking flicker:
   * Runs on a decoupled interval so it never stalls React render or Socket glitch effects.
   */
  const flicker = useCallback(
    (count = 6, intervalMs = 80, finalState = false) => {
      if (flickerTimerRef.current) {
        clearInterval(flickerTimerRef.current);
        flickerTimerRef.current = null;
      }

      let step = 0;
      let currentState = false;
      const totalSteps = count * 2;
      const speed = Math.max(50, intervalMs);

      // Check if native bridge exists for optimized tight loop
      const bridge =
        (window as any).Android ||
        (window as any).AndroidBridge ||
        (window as any).android ||
        (window as any).FlashlightBridge ||
        (window as any).TorchBridge;

      flickerTimerRef.current = setInterval(() => {
        step++;
        if (step > totalSteps) {
          if (flickerTimerRef.current) {
            clearInterval(flickerTimerRef.current);
            flickerTimerRef.current = null;
          }
          setTorch(finalState);
          return;
        }

        currentState = step % 2 === 1;
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
    [setTorch, onStateChange]
  );

  /**
   * Cleanup and complete shutdown of all torch hardware
   */
  const releaseTorch = useCallback(() => {
    desiredTorchStateRef.current = false;
    setTorchOn(false);
    if (flickerTimerRef.current) {
      clearInterval(flickerTimerRef.current);
      flickerTimerRef.current = null;
    }

    invokeNativeBridge(false);

    if (trackRef.current) {
      (trackRef.current as any)
        .applyConstraints({ advanced: [{ torch: false }] })
        .catch(() => {});
      trackRef.current.stop();
      trackRef.current = null;
    }
  }, [invokeNativeBridge]);

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
    releaseTorch,
  };
}
