'use client';

import { useState, useEffect } from 'react';
import '../lib/types';

export function useBattery(onSync?: (level: number, charging: boolean) => void) {
  const [level, setLevel] = useState<number>(100);
  const [charging, setCharging] = useState<boolean>(false);

  useEffect(() => {
    let batteryObj: any = null;
    let timer: any = null;

    const checkBattery = async () => {
      let currentLevel = 100;
      let isCharging = false;

      // Check Android bridge first
      if (window.Android?.getBatteryLevel) {
        try {
          currentLevel = Math.round(window.Android.getBatteryLevel());
          setLevel(currentLevel);
          if (onSync) onSync(currentLevel, isCharging);
          return;
        } catch (e) {
          console.warn('[useBattery] Android getBatteryLevel failed:', e);
        }
      }

      // Check Web Battery API
      if (typeof navigator !== 'undefined' && navigator.getBattery) {
        try {
          if (!batteryObj) {
            batteryObj = await navigator.getBattery();
          }
          currentLevel = Math.round(batteryObj.level * 100);
          isCharging = !!batteryObj.charging;
        } catch (e) {
          console.warn('[useBattery] getBattery failed:', e);
        }
      }

      setLevel(currentLevel);
      setCharging(isCharging);
      if (onSync) onSync(currentLevel, isCharging);
    };

    checkBattery();
    // Poll every 5 seconds
    timer = setInterval(checkBattery, 5000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [onSync]);

  return { level, charging };
}
