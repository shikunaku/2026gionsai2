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

  // Initialize web camera track for torch once and keep pre-warmed if supported
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
      console.warn('[useTorch] Web Torch getUserMedia error or unsupported:', e);
    }
    return null;
  }, []);

  const applyHardwareTorch = useCallback(async (state: boolean): Promise<boolean> => {
    // 1. Android Bridge Check (Dedicated App WebView)
    // Support common method signatures: turnOnFlash/turnOffFlash, setFlashlight, setTorch, toggleFlash
    const androidObj = (window as any).Android || (window as any).android || (window as any).FlashlightBridge || (window as any).TorchBridge;
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
        console.warn('[useTorch] Dedicated App Android Bridge call error:', e);
      }
    }

    // 2. Web ImageCapture / MediaStreamTrack Torch Fallback
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
  }, [initWebTorch]);

  const setTorch = useCallback(
    async (state: boolean) => {
      setTorchOn(state);
      if (onStateChange) onStateChange(state);

      pendingStateRef.current = state;
      if (isBusyRef.current) return;

      isBusyRef.current = true;
      try {
        while (pendingStateRef.current !== null) {
          const targetState = pendingStateRef.current;
          pendingStateRef.current = null;
          await applyHardwareTorch(targetState);
        }
      } finally {
        isBusyRef.current = false;
      }
    },
    [onStateChange, applyHardwareTorch]
  );

  const toggleTorch = useCallback(() => {
    setTorch(!torchOn);
  }, [torchOn, setTorch]);

  /**
   * Hardware flicker for native app & web:
   * Uses clear steps without causing screen flashes.
   */
  const flicker = useCallback(
    (count = 5, intervalMs = 140) => {
      if (flickerTimerRef.current) {
        clearInterval(flickerTimerRef.current);
        flickerTimerRef.current = null;
      }

      let step = 0;
      let currentState = false;
      const totalSteps = count * 2;

      const runFlickerStep = async () => {
        if (step >= totalSteps) {
          if (flickerTimerRef.current) {
            clearInterval(flickerTimerRef.current);
            flickerTimerRef.current = null;
          }
          await setTorch(false);
          return;
        }

        currentState = !currentState;
        step++;
        await setTorch(currentState);
      };

      runFlickerStep();
      flickerTimerRef.current = setInterval(runFlickerStep, intervalMs);
    },
    [setTorch]
  );

  useEffect(() => {
    return () => {
      if (flickerTimerRef.current) clearInterval(flickerTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    torchOn,
    screenFlashActive: false,
    setTorch,
    toggleTorch,
    flicker,
  };
}
