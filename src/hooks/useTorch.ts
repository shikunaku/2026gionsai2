'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import '../lib/types';

export function useTorch(onStateChange?: (state: boolean) => void) {
  const [torchOn, setTorchOn] = useState(false);
  const [screenFlashActive, setScreenFlashActive] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const flickerTimerRef = useRef<any>(null);

  // Initialize web camera track for torch if needed
  const initWebTorch = async (): Promise<MediaStreamTrack | null> => {
    if (trackRef.current) return trackRef.current;
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
      const capabilities = (track.getCapabilities && track.getCapabilities()) || {};
      if ('torch' in capabilities) {
        trackRef.current = track;
        return track;
      }
    } catch (e) {
      console.warn('[useTorch] Web Torch getUserMedia error or unsupported:', e);
    }
    return null;
  };

  const setTorch = useCallback(
    async (state: boolean) => {
      setTorchOn(state);
      if (onStateChange) onStateChange(state);

      // 1. Android Bridge Check
      if (window.Android?.turnOnFlash && window.Android?.turnOffFlash) {
        try {
          if (state) {
            window.Android.turnOnFlash();
          } else {
            window.Android.turnOffFlash();
          }
          return;
        } catch (e) {
          console.warn('[useTorch] Android Bridge invocation failed:', e);
        }
      }

      // 2. Web ImageCapture / MediaStreamTrack Torch
      try {
        const track = await initWebTorch();
        if (track) {
          await track.applyConstraints({
            advanced: [{ torch: state } as any],
          });
          return;
        }
      } catch (e) {
        console.warn('[useTorch] Web MediaStreamTrack torch failed:', e);
      }

      // 3. Fallback: CSS Screen Flash
      setScreenFlashActive(state);
    },
    [onStateChange]
  );

  const toggleTorch = useCallback(() => {
    setTorch(!torchOn);
  }, [torchOn, setTorch]);

  const flicker = useCallback(
    (count = 5, intervalMs = 120) => {
      if (flickerTimerRef.current) {
        clearInterval(flickerTimerRef.current);
      }

      let currentStep = 0;
      let currentState = false;
      const totalSteps = count * 2;

      flickerTimerRef.current = setInterval(() => {
        currentState = !currentState;
        setTorch(currentState);
        currentStep++;

        if (currentStep >= totalSteps) {
          clearInterval(flickerTimerRef.current);
          flickerTimerRef.current = null;
          setTorch(false);
        }
      }, intervalMs);
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
    screenFlashActive,
    setTorch,
    toggleTorch,
    flicker,
  };
}
