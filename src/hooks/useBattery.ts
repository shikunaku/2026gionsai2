'use client';

import { useState, useEffect } from 'react';
import '../lib/types';

const BATTERY_FALLBACK_INTERVAL_MS = 60_000;

export function useBattery(onSync?: (level: number, charging: boolean) => void) {
  const [level, setLevel] = useState<number>(100);
  const [charging, setCharging] = useState<boolean>(false);

  useEffect(() => {
    let batteryObj: BatteryManager | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    let lastSynced: { level: number; charging: boolean } | null = null;

    const publishBattery = (currentLevel: number, isCharging: boolean) => {
      if (disposed) return;

      setLevel((previous) => (previous === currentLevel ? previous : currentLevel));
      setCharging((previous) => (previous === isCharging ? previous : isCharging));

      if (
        lastSynced?.level === currentLevel &&
        lastSynced.charging === isCharging
      ) {
        return;
      }

      lastSynced = { level: currentLevel, charging: isCharging };
      onSync?.(currentLevel, isCharging);
    };

    const checkBattery = async () => {
      let currentLevel = 100;
      let isCharging = false;

      // Check Android bridge first
      if (window.Android?.getBatteryLevel) {
        try {
          currentLevel = Math.round(window.Android.getBatteryLevel());
          publishBattery(currentLevel, isCharging);
          return;
        } catch (e) {
          console.warn('[useBattery] Android getBatteryLevel failed:', e);
        }
      }

      // Check Web Battery API
      if (typeof navigator !== 'undefined' && navigator.getBattery) {
        try {
          batteryObj ??= await navigator.getBattery();
          currentLevel = Math.round(batteryObj.level * 100);
          isCharging = batteryObj.charging;
        } catch (e) {
          console.warn('[useBattery] getBattery failed:', e);
        }
      }

      publishBattery(currentLevel, isCharging);
    };

    const handleBatteryChange: EventListener = () => {
      if (!batteryObj) return;
      publishBattery(Math.round(batteryObj.level * 100), batteryObj.charging);
    };

    const initializeBattery = async () => {
      await checkBattery();
      if (disposed || !batteryObj) return;
      batteryObj.addEventListener('levelchange', handleBatteryChange);
      batteryObj.addEventListener('chargingchange', handleBatteryChange);
    };

    void initializeBattery();
    timer = setInterval(() => void checkBattery(), BATTERY_FALLBACK_INTERVAL_MS);

    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
      batteryObj?.removeEventListener('levelchange', handleBatteryChange);
      batteryObj?.removeEventListener('chargingchange', handleBatteryChange);
    };
  }, [onSync]);

  return { level, charging };
}
