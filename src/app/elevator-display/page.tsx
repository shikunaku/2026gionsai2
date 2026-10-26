'use client';

/**
 * @file page.tsx (Elevator Backlight Display)
 * @description エレベータ内設置用の階層電照・発光表示コンポーネント。
 * 画面上の余計なUIや余白、スクロールバーを完全排除（0px）し、画面全体を上下均等2分割（50%:50%）で
 * 漆黒／暖色白発光（蛍光灯フリッカー付き）させます。
 *
 * また、設置端末のバッテリー情報（残量・充電状態）をWebSocket経由で管理画面（Admin）へ遠隔送信し、
 * 端末の電池切れを未然に防止します。
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useBattery } from '../../hooks/useBattery';
import { ElevatorFloorState, ElevatorStatePayload } from '../../lib/types';
import '../../styles/elevator-display.css';

interface CalibrationConfig {
  orientation: 'vertical' | 'horizontal';
  reverseOrder: boolean;
}

const DEFAULT_CONFIG: CalibrationConfig = {
  orientation: 'vertical',
  reverseOrder: false,
};

const STORAGE_KEY = 'gionsai_elevator_display_cfg_v2';
const ELEVATOR_DEVICE_ID = 'ELEVATOR_DISPLAY_01';

export default function ElevatorDisplayPage() {
  const { socket, connected } = useSocket();
  const [floorState, setFloorState] = useState<ElevatorFloorState>('FLOOR_1');
  const [flickering, setFlickering] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [config, setConfig] = useState<CalibrationConfig>(DEFAULT_CONFIG);

  // 1. バッテリー監視とサーバーへの自動テレメトリ送信
  const handleBatterySync = useCallback(
    (batteryLevel: number, charging: boolean) => {
      if (socket && connected) {
        socket.emit('device:battery_update', {
          deviceId: ELEVATOR_DEVICE_ID,
          batteryLevel,
          charging,
        });
      }
    },
    [socket, connected]
  );

  const { level: batteryLevel, charging: isCharging } = useBattery(handleBatterySync);

  // 2. 端末登録（ロール: elevator_display）
  useEffect(() => {
    if (!socket || !connected) return;

    socket.emit('device:ready', {
      deviceId: ELEVATOR_DEVICE_ID,
      phase: 'ELEVATOR',
      location: 'エレベータ筐体電照パネル',
      role: 'elevator_display',
    });

    // 初期バッテリー情報も即時送信
    socket.emit('device:battery_update', {
      deviceId: ELEVATOR_DEVICE_ID,
      batteryLevel,
      charging: isCharging,
    });
  }, [socket, connected, batteryLevel, isCharging]);

  // 設定をLocalStorageから復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setConfig((prev) => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch (e) {
      console.warn('[ElevatorDisplay] Failed to load config from localStorage:', e);
    }
  }, []);

  // Socketイベントリスナー (フロア更新 & グリッチ)
  useEffect(() => {
    if (!socket) return;

    const handleElevatorState = (payload: ElevatorStatePayload) => {
      console.log('[Elevator Display] Received floor state:', payload);
      setFloorState(payload.floor);
      if (payload.glitch) {
        triggerGlitch(1400);
      }
    };

    const handleElevatorGlitch = (payload?: { duration?: number }) => {
      console.log('[Elevator Display] Received glitch event');
      triggerGlitch(payload?.duration || 1200);
    };

    socket.on('elevator:state', handleElevatorState);
    socket.on('elevator:glitch', handleElevatorGlitch);

    return () => {
      socket.off('elevator:state', handleElevatorState);
      socket.off('elevator:glitch', handleElevatorGlitch);
    };
  }, [socket]);

  const triggerGlitch = (duration = 1200) => {
    setFlickering(true);
    setTimeout(() => {
      setFlickering(false);
    }, duration);
  };

  // 隠し設定用コーナー連続タップ検知 (2秒以内に4回タップでキャリブレーション表示)
  const tapCountRef = useRef<number>(0);
  const lastTapTimeRef = useRef<number>(0);

  const handleCornerTap = () => {
    const now = Date.now();
    if (now - lastTapTimeRef.current < 600) {
      tapCountRef.current += 1;
    } else {
      tapCountRef.current = 1;
    }
    lastTapTimeRef.current = now;

    if (tapCountRef.current >= 4) {
      setShowSettings((prev) => !prev);
      tapCountRef.current = 0;
    }
  };

  const handleSaveConfig = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('[ElevatorDisplay] Failed to save config:', e);
    }
    setShowSettings(false);
  };

  // 点灯判定
  const isFloor1Active = floorState === 'FLOOR_1';
  const isFloorB1Active = floorState === 'FLOOR_B1';

  // 上下2分割（または左右2分割）の各スロット
  const slot1 = (
    <div key="slot-1" className="elevator-slot">
      <div
        className={`elevator-light-box ${isFloor1Active ? 'active' : ''} ${isFloor1Active && flickering ? 'flicker' : ''
          }`}
      />
    </div>
  );

  const slotB1 = (
    <div key="slot-b1" className="elevator-slot">
      <div
        className={`elevator-light-box ${isFloorB1Active ? 'active' : ''} ${isFloorB1Active && flickering ? 'flicker' : ''
          }`}
      />
    </div>
  );

  const items = config.reverseOrder ? [slotB1, slot1] : [slot1, slotB1];

  return (
    <div className={`elevator-root ${showSettings ? 'elevator-calibrating' : ''}`}>
      {/* 4隅の隠しタップ領域 (設定呼び出し用) */}
      <div className="elevator-corner-hotspot top-left" onClick={handleCornerTap} />
      <div className="elevator-corner-hotspot top-right" onClick={handleCornerTap} />
      <div className="elevator-corner-hotspot bottom-left" onClick={handleCornerTap} />
      <div className="elevator-corner-hotspot bottom-right" onClick={handleCornerTap} />

      {/* 完全余白ゼロの均等2分割 発光コンテナ */}
      <div className={`elevator-display-container ${config.orientation}`}>
        {items}
      </div>

      {/* 設定・反転モーダル (4回タップ時のみ表示) */}
      {showSettings && (
        <div className="elevator-settings-overlay">
          <div className="elevator-settings-card">
            <div className="elevator-settings-title">
              <span>配置設定 (Display Calibration)</span>
              <button
                className="elevator-close-btn"
                style={{ padding: '2px 8px', width: 'auto' }}
                onClick={() => setShowSettings(false)}
              >
                [閉じる]
              </button>
            </div>

            {/* 配置方向 */}
            <div className="elevator-settings-row">
              <label className="elevator-settings-label">配置方向 (Orientation)</label>
              <div className="elevator-btn-group">
                <button
                  className={`elevator-cfg-btn ${config.orientation === 'vertical' ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, orientation: 'vertical' })}
                >
                  上下2分割 (縦置き)
                </button>
                <button
                  className={`elevator-cfg-btn ${config.orientation === 'horizontal' ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, orientation: 'horizontal' })}
                >
                  左右2分割 (横置き)
                </button>
              </div>
            </div>

            {/* 1階とB1階の順序反転 */}
            <div className="elevator-settings-row">
              <label className="elevator-settings-label">1階 と B1階 の順序 (Order)</label>
              <div className="elevator-btn-group">
                <button
                  className={`elevator-cfg-btn ${!config.reverseOrder ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, reverseOrder: false })}
                >
                  標準 (1階 ➔ B1階)
                </button>
                <button
                  className={`elevator-cfg-btn ${config.reverseOrder ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, reverseOrder: true })}
                >
                  反転 (B1階 ➔ 1階)
                </button>
              </div>
            </div>

            {/* テスト点灯ボタン */}
            <div className="elevator-settings-row" style={{ marginTop: '16px' }}>
              <label className="elevator-settings-label">テスト点灯切替 (Test Floor)</label>
              <div className="elevator-btn-group">
                <button
                  className={`elevator-cfg-btn ${floorState === 'FLOOR_1' ? 'active' : ''}`}
                  onClick={() => setFloorState('FLOOR_1')}
                >
                  1階 点灯
                </button>
                <button
                  className={`elevator-cfg-btn ${floorState === 'MOVING' ? 'active' : ''}`}
                  onClick={() => setFloorState('MOVING')}
                >
                  移動 (消灯)
                </button>
                <button
                  className={`elevator-cfg-btn ${floorState === 'FLOOR_B1' ? 'active' : ''}`}
                  onClick={() => setFloorState('FLOOR_B1')}
                >
                  B1 点灯
                </button>
                <button
                  className="elevator-cfg-btn"
                  onClick={() => triggerGlitch(1500)}
                >
                  チラつき
                </button>
              </div>
            </div>

            {/* 保存ボタン */}
            <div className="elevator-settings-actions">
              <button className="elevator-save-btn" onClick={handleSaveConfig}>
                保存して発光画面に戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
