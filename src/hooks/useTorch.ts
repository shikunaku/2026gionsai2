'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import '../lib/types';

export function useTorch(onStateChange?: (state: boolean) => void) {
  const [torchOn, setTorchOn] = useState(false);
  const [screenFlashActive, setScreenFlashActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const isBusyRef = useRef(false);
  const pendingStateRef = useRef<boolean | null>(null);
  const flickerTimerRef = useRef<any>(null);



  const desiredTorchStateRef = useRef<boolean>(false);

  // Direct synchronous hardware call helper (zero latency for dedicated app)
  const invokeNativeFlash = (state: boolean): boolean => {
    const androidObj =
      (window as any).Android ||
      (window as any).android ||
      (window as any).FlashlightBridge ||
      (window as any).TorchBridge;

    if (androidObj) {
      try {
        if (state) {
          if (typeof androidObj.turnOnFlash === 'function') {
            androidObj.turnOnFlash();
            return true;
          } else if (typeof androidObj.turnOnTorch === 'function') {
            androidObj.turnOnTorch();
            return true;
          } else if (typeof androidObj.setFlashlight === 'function') {
            androidObj.setFlashlight(true);
            return true;
          } else if (typeof androidObj.setTorch === 'function') {
            androidObj.setTorch(true);
            return true;
          } else if (typeof androidObj.setFlash === 'function') {
            androidObj.setFlash(true);
            return true;
          }
        } else {
          if (typeof androidObj.turnOffFlash === 'function') {
            androidObj.turnOffFlash();
            return true;
          } else if (typeof androidObj.turnOffTorch === 'function') {
            androidObj.turnOffTorch();
            return true;
          } else if (typeof androidObj.setFlashlight === 'function') {
            androidObj.setFlashlight(false);
            return true;
          } else if (typeof androidObj.setTorch === 'function') {
            androidObj.setTorch(false);
            return true;
          } else if (typeof androidObj.setFlash === 'function') {
            androidObj.setFlash(false);
            return true;
          }
        }
      } catch (e) {
        console.warn('[useTorch] Android Bridge execution error:', e);
      }
    }
    return false;
  };

  // Web MediaStreamTrack Torch Fallback
  const initWebTorch = useCallback(async (): Promise<MediaStreamTrack | null> => {
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
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (track) {
        trackRef.current = track;
        return track;
      }
    } catch (e) {
      console.warn('[useTorch] Web Torch getUserMedia fallback failed:', e);
    }
    return null;
  }, []);

  const applyHardwareTorch = useCallback(
    async (state: boolean): Promise<boolean> => {
      // 1. Try native dedicated app bridge first (sync, 0ms latency)
      if (invokeNativeFlash(state)) {
        return true;
      }

      // 2. Web ImageCapture / MediaStreamTrack Fallback (async)
      try {
        const track = await initWebTorch();
        if (track && track.readyState === 'live') {
          await track.applyConstraints({
            advanced: [{ torch: state } as any],
          });
          return true;
        }
      } catch (e) {
        console.warn('[useTorch] Web MediaStreamTrack torch failed:', e);
      }

      return false;
    },
    [initWebTorch]
  );

  const setTorch = useCallback(
    (state: boolean) => {
      desiredTorchStateRef.current = state;
      setTorchOn(state);
      if (onStateChange) onStateChange(state);

      // Instant synchronous execution for native app
      if (invokeNativeFlash(state)) {
        return;
      }

      // Non-blocking asynchronous fallback for Web MediaStream
      applyHardwareTorch(state).catch((e) => {
        console.warn('[useTorch] Async applyHardwareTorch error:', e);
      });
    },
    [onStateChange, applyHardwareTorch]
  );

  const toggleTorch = useCallback(() => {
    setTorch(!torchOn);
  }, [torchOn, setTorch]);

  /**
   * Fast, non-blocking hardware flicker:
   * Runs without holding up React main thread or blocking glitch/other effects.
   */
  const flicker = useCallback(
    (count = 6, intervalMs = 70) => {
      if (flickerTimerRef.current) {
        clearInterval(flickerTimerRef.current);
        flickerTimerRef.current = null;
      }

      const speed = Math.max(50, intervalMs);
      let step = 0;
      let currentState = false;
      const totalSteps = count * 2;

      flickerTimerRef.current = setInterval(() => {
        if (step >= totalSteps) {
          if (flickerTimerRef.current) {
            clearInterval(flickerTimerRef.current);
            flickerTimerRef.current = null;
          }
          setTorch(false);
          return;
        }

        currentState = !currentState;
        step++;

        // Fast native trigger without awaiting
        desiredTorchStateRef.current = currentState;
        setTorchOn(currentState);
        if (onStateChange) onStateChange(currentState);

        if (!invokeNativeFlash(currentState)) {
          applyHardwareTorch(currentState).catch(() => {});
        }
      }, speed);
    },
    [setTorch, onStateChange, applyHardwareTorch]
  );

  /**
   * Auto-restore torch after camera capture:
   * When user returns from taking a photo (<input type="file">), the OS camera app releases
   * the torch. On window focus / visibilitychange, we re-apply the desired torch state.
   */
  useEffect(() => {
    const handleRestoreTorch = () => {
      if (document.visibilityState === 'visible' && desiredTorchStateRef.current) {
        // Small delay to let camera hardware release from OS camera intent
        setTimeout(() => {
          if (desiredTorchStateRef.current) {
            console.log('[useTorch] Restoring torch after returning from camera/background...');
            setTorch(true);
          }
        }, 350);
      }
    };

    window.addEventListener('focus', handleRestoreTorch);
    document.addEventListener('visibilitychange', handleRestoreTorch);

    return () => {
      window.removeEventListener('focus', handleRestoreTorch);
      document.removeEventListener('visibilitychange', handleRestoreTorch);
      if (flickerTimerRef.current) clearInterval(flickerTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [setTorch]);

  return {
    torchOn,
    screenFlashActive: false,
    setTorch,
    toggleTorch,
    flicker,
  };
}
