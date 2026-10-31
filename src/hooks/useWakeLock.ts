'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useWakeLock
 * スクリーン常時点灯（スリープ・消灯防止）を制御するカスタムフック
 */
export function useWakeLock(enabled: boolean = true) {
  const [isActive, setIsActive] = useState<boolean>(false);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const requestWakeLock = useCallback(async () => {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) {
      setIsSupported(false);
      return;
    }

    try {
      if (!wakeLockRef.current || wakeLockRef.current.released) {
        const sentinel = await navigator.wakeLock.request('screen');
        wakeLockRef.current = sentinel;
        setIsActive(true);

        sentinel.addEventListener('release', () => {
          setIsActive(false);
          wakeLockRef.current = null;
        });
      }
    } catch (err: any) {
      console.warn('[WakeLock] Failed to acquire screen wake lock:', err?.message || err);
      setIsActive(false);
    }
  }, []);

  const releaseWakeLock = useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
      } catch (err: any) {
        console.warn('[WakeLock] Error releasing wake lock:', err?.message || err);
      }
      wakeLockRef.current = null;
      setIsActive(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('wakeLock' in navigator)) {
      setIsSupported(false);
      return;
    }

    if (enabled) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // タブがバックグラウンドから復帰した際に自動再取得
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [enabled, requestWakeLock, releaseWakeLock]);

  return { isActive, isSupported, requestWakeLock, releaseWakeLock };
}
