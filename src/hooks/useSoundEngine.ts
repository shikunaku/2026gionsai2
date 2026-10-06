'use client';

import { useEffect, useCallback } from 'react';
import { getSoundEngine } from '../lib/soundEngine';

export function useSoundEngine() {
  const engine = getSoundEngine();

  const unlockAudio = useCallback(() => {
    engine.init();
  }, [engine]);

  useEffect(() => {
    const handleGesture = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };

    window.addEventListener('pointerdown', handleGesture);
    window.addEventListener('keydown', handleGesture);

    return () => {
      window.removeEventListener('pointerdown', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, [unlockAudio]);

  return {
    engine,
    unlockAudio,
    playBeep: (freq?: number, duration?: number) => engine.playBeep(freq, duration),
    playShutter: () => engine.playShutter(),
    playLowImpact: () => engine.playLowImpact(),
    playTaskSuccess: () => engine.playTaskSuccess(),
    playGeiger: (level?: number, durationMs?: number) => engine.playGeiger(level, durationMs),
    playDrone: (duration?: number) => engine.playDrone(duration),
    playMotor: (duration?: number) => engine.playMotor(duration),
    playPowerDown: () => engine.playPowerDown(),
    playSound: (soundType: string, level?: number) => engine.playSound(soundType, level),
    setVolume: (vol: number) => engine.setVolume(vol),
    getVolume: () => engine.getVolume(),
  };
}
