'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { ElevatorFloorState, ElevatorStatePayload } from '../../lib/types';
import '../../styles/elevator-display.css';

interface CalibrationConfig {
  orientation: 'vertical' | 'horizontal';
  reverseOrder: boolean;
  boxWidth: number;   // in % or px
  boxHeight: number;  // in % or px
  boxMargin: number;  // in px
  glowBrightness: number; // 50 to 150
  colorWarmth: string; // e.g. #FFF3D0
}

const DEFAULT_CONFIG: CalibrationConfig = {
  orientation: 'vertical',
  reverseOrder: false,
  boxWidth: 70,
  boxHeight: 65,
  boxMargin: 10,
  glowBrightness: 100,
  colorWarmth: '#FFF3D0',
};

const STORAGE_KEY = 'gionsai_elevator_display_cfg_v1';

export default function ElevatorDisplayPage() {
  const { socket, connected } = useSocket();
  const [floorState, setFloorState] = useState<ElevatorFloorState>('FLOOR_1');
  const [flickering, setFlickering] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [config, setConfig] = useState<CalibrationConfig>(DEFAULT_CONFIG);

  // Hidden tap counter to open settings
  const tapCountRef = useRef<number>(0);
  const lastTapTimeRef = useRef<number>(0);

  // Load config from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setConfig((prev) => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch (e) {
      console.warn('Failed to load elevator config from localStorage:', e);
    }
  }, []);

  // Socket event listeners
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

  const triggerGlitch = (duration: number = 1200) => {
    setFlickering(true);
    setTimeout(() => {
      setFlickering(false);
    }, duration);
  };

  // Corner tap handler: 4 quick taps in 2 seconds toggles calibration settings
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
      console.error('Failed to save elevator config:', e);
    }
    setShowSettings(false);
  };

  const handleResetConfig = () => {
    setConfig(DEFAULT_CONFIG);
    localStorage.removeItem(STORAGE_KEY);
  };

  // Check which slot is active
  const isFloor1Active = floorState === 'FLOOR_1';
  const isFloorB1Active = floorState === 'FLOOR_B1';

  // Calculate box dimensions
  const boxStyle: React.CSSProperties = {
    width: `${config.boxWidth}%`,
    height: `${config.boxHeight}%`,
    margin: `${config.boxMargin}px`,
  };

  const slot1 = (
    <div key="slot-1" className="elevator-slot">
      <div
        className={`elevator-light-box ${isFloor1Active ? 'active' : ''} ${
          isFloor1Active && flickering ? 'flicker' : ''
        }`}
        style={boxStyle}
      >
        <span className="elevator-floor-watermark">1</span>
      </div>
    </div>
  );

  const slotB1 = (
    <div key="slot-b1" className="elevator-slot">
      <div
        className={`elevator-light-box ${isFloorB1Active ? 'active' : ''} ${
          isFloorB1Active && flickering ? 'flicker' : ''
        }`}
        style={boxStyle}
      >
        <span className="elevator-floor-watermark">B1</span>
      </div>
    </div>
  );

  const items = config.reverseOrder ? [slotB1, slot1] : [slot1, slotB1];

  return (
    <div className={`elevator-root ${showSettings ? 'elevator-calibrating' : ''}`}>
      {/* 4 Hidden Corner Tap Hotspots for opening calibration settings */}
      <div className="elevator-corner-hotspot top-left" onClick={handleCornerTap} />
      <div className="elevator-corner-hotspot top-right" onClick={handleCornerTap} />
      <div className="elevator-corner-hotspot bottom-left" onClick={handleCornerTap} />
      <div className="elevator-corner-hotspot bottom-right" onClick={handleCornerTap} />

      {/* Main backlight illumination blocks */}
      <div className={`elevator-display-container ${config.orientation}`}>
        {items}
      </div>

      {/* Subtle connection & floor HUD badge */}
      <div className={`elevator-hud-badge ${connected ? 'online' : ''}`}>
        <span>STATUS: {connected ? 'LINK OK' : 'LINK DOWN'}</span>
        <span>|</span>
        <span>FLOOR: {floorState}</span>
        {flickering && <span style={{ color: '#ff6b6b' }}>[FLICKER]</span>}
      </div>

      {/* Calibration & Settings Modal */}
      {showSettings && (
        <div className="elevator-settings-overlay">
          <div className="elevator-settings-card">
            <div className="elevator-settings-title">
              <span>段ボール切り抜きキャリブレーション</span>
              <button
                className="elevator-close-btn"
                style={{ padding: '2px 8px', width: 'auto' }}
                onClick={() => setShowSettings(false)}
              >
                ✕
              </button>
            </div>

            {/* Layout Orientation */}
            <div className="elevator-settings-row">
              <label className="elevator-settings-label">配置モード (Orientation)</label>
              <div className="elevator-btn-group">
                <button
                  className={`elevator-cfg-btn ${config.orientation === 'vertical' ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, orientation: 'vertical' })}
                >
                  縦配置 (上:1 / 下:B1)
                </button>
                <button
                  className={`elevator-cfg-btn ${config.orientation === 'horizontal' ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, orientation: 'horizontal' })}
                >
                  横配置 (左:1 / 右:B1)
                </button>
              </div>
            </div>

            {/* Invert order */}
            <div className="elevator-settings-row">
              <label className="elevator-settings-label">1 と B1 の反転 (Reverse Order)</label>
              <div className="elevator-btn-group">
                <button
                  className={`elevator-cfg-btn ${!config.reverseOrder ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, reverseOrder: false })}
                >
                  標準 (1 ➔ B1)
                </button>
                <button
                  className={`elevator-cfg-btn ${config.reverseOrder ? 'active' : ''}`}
                  onClick={() => setConfig({ ...config, reverseOrder: true })}
                >
                  反転 (B1 ➔ 1)
                </button>
              </div>
            </div>

            {/* Width Slider */}
            <div className="elevator-settings-row">
              <label className="elevator-settings-label">発光ブロック 幅 (Width)</label>
              <div className="elevator-slider-row">
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={config.boxWidth}
                  onChange={(e) => setConfig({ ...config, boxWidth: Number(e.target.value) })}
                />
                <span className="elevator-slider-val">{config.boxWidth}%</span>
              </div>
            </div>

            {/* Height Slider */}
            <div className="elevator-settings-row">
              <label className="elevator-settings-label">発光ブロック 高さ (Height)</label>
              <div className="elevator-slider-row">
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={config.boxHeight}
                  onChange={(e) => setConfig({ ...config, boxHeight: Number(e.target.value) })}
                />
                <span className="elevator-slider-val">{config.boxHeight}%</span>
              </div>
            </div>

            {/* Margin Slider */}
            <div className="elevator-settings-row">
              <label className="elevator-settings-label">外側余白 (Margin)</label>
              <div className="elevator-slider-row">
                <input
                  type="range"
                  min="0"
                  max="80"
                  value={config.boxMargin}
                  onChange={(e) => setConfig({ ...config, boxMargin: Number(e.target.value) })}
                />
                <span className="elevator-slider-val">{config.boxMargin}px</span>
              </div>
            </div>

            {/* Live Testing floor buttons */}
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
                  チラつきテスト
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="elevator-settings-actions">
              <button className="elevator-save-btn" onClick={handleSaveConfig}>
                保存して閉じる (Save)
              </button>
              <button
                className="elevator-close-btn"
                style={{ background: '#5a2d2d' }}
                onClick={handleResetConfig}
              >
                初期化
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
