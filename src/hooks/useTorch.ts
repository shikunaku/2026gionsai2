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

  // Initialize web camera track for torch once and keep pre-warmed
  const initWebTorch = useCallback(async (): Promise<MediaStreamTrack | null> => {
    if (trackRef.current && trackRef.current.readyState === 'live') {
      return trackRef.current;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return null;
    }

    try {
      // Use minimal resolution constraint to ensure instant responsiveness on low-end chipsets
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 320 },
          height: { ideal: 240 },
        },
      });
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      const capabilities = (track.getCapabilities && track.getCapabilities()) || {};
      if ('torch' in capabilities) {
        trackRef.current = track;
        return track;
      }
    } catch (e) {
      console.warn('[useTorch] Web Torch getUserMedia error or unsupported:', e);
    }
    return null;
  }, []);

  // Pre-warm torch stream on mount or first user interaction
  useEffect(() => {
    initWebTorch().catch(() => {});
  }, [initWebTorch]);

  const applyHardwareTorch = useCallback(async (state: boolean) => {
    // 1. Android Bridge Check (Fastest and 100% reliable on WebView)
    if (window.Android?.turnOnFlash && window.Android?.turnOffFlash) {
      try {
        if (state) {
          window.Android.turnOnFlash();
        } else {
          window.Android.turnOffFlash();
        }
        return true;
      } catch (e) {
        console.warn('[useTorch] Android Bridge invocation failed:', e);
      }
    }

    // 2. Web ImageCapture / MediaStreamTrack Torch
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

      // Low-end device queue: if a previous hardware call is in flight, queue the newest state
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

  /**
   * Trigger a brief white flash effect when forced OFF (e.g. shutdown / cutoff)
   */
  const triggerCutoffFlash = useCallback((durationMs = 280) => {
    setScreenFlashActive(true);
    setTimeout(() => {
      setScreenFlashActive(false);
    }, durationMs);
  }, []);

  const toggleTorch = useCallback(() => {
    const nextState = !torchOn;
    setTorch(nextState);
    if (!nextState) {
      triggerCutoffFlash(200);
    }
  }, [torchOn, setTorch, triggerCutoffFlash]);

  /**
   * Robust hardware flicker for low-spec mobile chipsets:
   * Uses async sequential steps with minimum hardware dwell time (160ms)
   * so camera driver doesn't drop requests or crash.
   */
  const flicker = useCallback(
    (count = 5, intervalMs = 180) => {
      if (flickerTimerRef.current) {
        clearInterval(flickerTimerRef.current);
        flickerTimerRef.current = null;
      }

      // Guarantee minimum 150ms per toggle for low-end hardware ISP stability
      const safeInterval = Math.max(150, intervalMs);

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
          triggerCutoffFlash(260);
          return;
        }

        currentState = !currentState;
        step++;
        await setTorch(currentState);
      };

      // Initial trigger
      runFlickerStep();
      flickerTimerRef.current = setInterval(runFlickerStep, safeInterval);
    },
    [setTorch, triggerCutoffFlash]
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
    screenFlashActive,
    setTorch,
    toggleTorch,
    flicker,
    triggerCutoffFlash,
  };
}
