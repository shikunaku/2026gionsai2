'use client';

import React, { useState } from 'react';
import { DevicePhase } from '../../lib/types';

interface EffectTriggerPanelProps {
  onOverrideAllPhase: (phase: DevicePhase) => void;
  onTriggerGlitch: (options: {
    level: number;
    duration: number;
    mode: 'violent' | 'creepy' | 'invert' | 'blackout' | 'redout' | 'static';
    vibrate: boolean;
  }) => void;
  onTriggerSound: (soundType: string, level?: number) => void;
  onTriggerTorch: (options: { state?: boolean; flicker?: boolean; count?: number; intervalMs?: number }) => void;
  onSetVolume: (volume: number) => void;
  onEmergencyAllLight: () => void;
  onTriggerShutdown: () => void;
}

export const EffectTriggerPanel: React.FC<EffectTriggerPanelProps> = ({
  onOverrideAllPhase,
  onTriggerGlitch,
  onTriggerSound,
  onTriggerTorch,
  onSetVolume,
  onEmergencyAllLight,
  onTriggerShutdown,
}) => {
  const [glitchLevel, setGlitchLevel] = useState<number>(2);
  const [glitchDuration, setGlitchDuration] = useState<number>(3000);
  const [glitchMode, setGlitchMode] = useState<'violent' | 'creepy' | 'invert' | 'blackout' | 'redout' | 'static'>('creepy');
  const [selectedVolume, setSelectedVolume] = useState<number>(1.0);

  const handleVolumeChange = (vol: number) => {
    setSelectedVolume(vol);
    onSetVolume(vol);
  };

  return (
    <div className="win95-window" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="win95-titlebar" style={{ background: 'linear-gradient(90deg, #4d3535, #634747)' }}>
        <span>[演出制御] Master Effects & Remote Control</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* Phase Overrides */}
        <fieldset className="win95-groupbox">
          <legend className="win95-groupbox-legend">全端末 フェーズ強制切替</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginTop: '4px' }}>
            <button
              onClick={() => onOverrideAllPhase('ZONE1')}
              className="win95-btn"
              style={{ fontSize: '11px', padding: '6px 2px', minHeight: '32px' }}
            >
              ZONE 1 (写真)
            </button>
            <button
              onClick={() => onOverrideAllPhase('ZONE2')}
              className="win95-btn"
              style={{ fontSize: '11px', padding: '6px 2px', minHeight: '32px' }}
            >
              ZONE 2 (機器)
            </button>
            <button
              onClick={() => onOverrideAllPhase('END')}
              className="win95-btn win95-btn-danger"
              style={{ fontSize: '11px', padding: '6px 2px', minHeight: '32px' }}
            >
              END (遮断)
            </button>
          </div>
        </fieldset>

        {/* Glitch Panel */}
        <fieldset className="win95-groupbox">
          <legend className="win95-groupbox-legend">画面グリッチ / ノイズ妨害演出</legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#2b2e34' }}>
              <span style={{ fontWeight: 'bold' }}>強度:</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {[1, 2, 3].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setGlitchLevel(lvl)}
                    className={`win95-btn ${glitchLevel === lvl ? 'active' : ''}`}
                    style={{ padding: '2px 8px', fontSize: '10px', minHeight: '26px' }}
                  >
                    Lv.{lvl}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', color: '#2b2e34' }}>
              <span style={{ fontWeight: 'bold' }}>妨害タイプ (モード):</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                <button
                  onClick={() => setGlitchMode('creepy')}
                  className={`win95-btn ${glitchMode === 'creepy' ? 'active' : ''}`}
                  style={{ padding: '3px 2px', fontSize: '10px', minHeight: '26px' }}
                  title="不穏な波打ち・微細な歪み"
                >
                  不穏(歪み)
                </button>
                <button
                  onClick={() => setGlitchMode('violent')}
                  className={`win95-btn ${glitchMode === 'violent' ? 'active' : ''}`}
                  style={{ padding: '3px 2px', fontSize: '10px', minHeight: '26px' }}
                  title="激しいRGBズレ・画面裂け"
                >
                  激震(裂け)
                </button>
                <button
                  onClick={() => setGlitchMode('invert')}
                  className={`win95-btn ${glitchMode === 'invert' ? 'active' : ''}`}
                  style={{ padding: '3px 2px', fontSize: '10px', minHeight: '26px' }}
                  title="白黒・色彩の急激な反転妨害"
                >
                  色反転
                </button>
                <button
                  onClick={() => setGlitchMode('blackout')}
                  className={`win95-btn ${glitchMode === 'blackout' ? 'active' : ''}`}
                  style={{ padding: '3px 2px', fontSize: '10px', minHeight: '26px' }}
                  title="突発的な暗転・チカチカ点滅"
                >
                  突発暗転
                </button>
                <button
                  onClick={() => setGlitchMode('redout')}
                  className={`win95-btn ${glitchMode === 'redout' ? 'active' : ''}`}
                  style={{ padding: '3px 2px', fontSize: '10px', minHeight: '26px' }}
                  title="警告警報・血色赤転フラッシュ"
                >
                  血色赤転
                </button>
                <button
                  onClick={() => setGlitchMode('static')}
                  className={`win95-btn ${glitchMode === 'static' ? 'active' : ''}`}
                  style={{ padding: '3px 2px', fontSize: '10px', minHeight: '26px' }}
                  title="アナログ砂嵐・走査線ノイズ"
                >
                  砂嵐ノイズ
                </button>
              </div>
            </div>

            <button
              onClick={() =>
                onTriggerGlitch({
                  level: glitchLevel,
                  duration: glitchDuration,
                  mode: glitchMode,
                  vibrate: true,
                })
              }
              className="win95-btn"
              style={{
                backgroundColor: '#6b4638',
                color: '#f8f4f2',
                fontWeight: 'bold',
                padding: '6px 10px',
                minHeight: '36px',
                fontSize: '12px',
                marginTop: '4px',
              }}
            >
              全端末に妨害発火 [EXECUTE]
            </button>
          </div>
        </fieldset>

        {/* Procedural Audio Panel */}
        <fieldset className="win95-groupbox">
          <legend className="win95-groupbox-legend">プロシージャル音響遠隔トリガー</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '4px', marginTop: '4px' }}>
            <button onClick={() => onTriggerSound('taskSuccess')} className="win95-btn" style={{ fontSize: '11px', padding: '5px 6px', minHeight: '32px', fontWeight: 'bold', backgroundColor: '#3d6148', color: '#f0f8f2' }} title="合格通知チャイム (880Hz->1320Hz)">
              合格チャイム ♪
            </button>
            <button onClick={() => onTriggerSound('beep')} className="win95-btn" style={{ fontSize: '11px', padding: '5px 6px', minHeight: '32px' }}>
              確認ビープ
            </button>
            <button onClick={() => onTriggerSound('lowImpact')} className="win95-btn" style={{ fontSize: '11px', padding: '5px 6px', minHeight: '32px' }}>
              衝撃重低音
            </button>
            <button onClick={() => onTriggerSound('geiger', 4)} className="win95-btn" style={{ fontSize: '11px', padding: '5px 6px', minHeight: '32px' }}>
              ガイガー異変
            </button>
            <button onClick={() => onTriggerSound('drone')} className="win95-btn" style={{ fontSize: '11px', padding: '5px 6px', minHeight: '32px' }}>
              不穏ドローン
            </button>
            <button onClick={() => onTriggerSound('motor')} className="win95-btn" style={{ fontSize: '11px', padding: '5px 6px', minHeight: '32px' }}>
              モーター稼働
            </button>
            <button onClick={() => onTriggerSound('powerDown')} className="win95-btn" style={{ fontSize: '11px', padding: '5px 6px', minHeight: '32px' }}>
              電源降下音
            </button>
          </div>

          {/* Volume multiplier */}
          <div style={{ marginTop: '8px', borderTop: '1px solid #7a7974', paddingTop: '6px' }}>
            <div style={{ fontSize: '11px', marginBottom: '4px', color: '#2b2e34', fontWeight: 'bold' }}>全端末 音量ブースト:</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
              {[1.0, 1.5, 2.0, 2.5].map((vol) => (
                <button
                  key={vol}
                  onClick={() => handleVolumeChange(vol)}
                  className={`win95-btn ${selectedVolume === vol ? 'active' : ''}`}
                  style={{
                    fontSize: '10px',
                    padding: '3px 0',
                    minHeight: '26px',
                    backgroundColor: vol >= 2.0 && selectedVolume === vol ? '#8c4848' : undefined,
                    color: vol >= 2.0 && selectedVolume === vol ? '#fdf8f8' : undefined,
                  }}
                >
                  {Math.round(vol * 100)}%
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        {/* Torch & Flashlight Panel */}
        <fieldset className="win95-groupbox">
          <legend className="win95-groupbox-legend">背面トーチ (フラッシュライト) 遠隔制御</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', marginTop: '4px' }}>
            <button
              onClick={() => onTriggerTorch({ flicker: true, count: 6, intervalMs: 180 })}
              className="win95-btn"
              style={{ fontSize: '11px', padding: '5px 2px', minHeight: '32px' }}
            >
              高速点滅
            </button>
            <button
              onClick={() => onTriggerTorch({ state: true })}
              className="win95-btn"
              style={{ fontSize: '11px', padding: '5px 2px', minHeight: '32px' }}
            >
              常時点灯
            </button>
            <button
              onClick={() => onTriggerTorch({ state: false })}
              className="win95-btn"
              style={{ fontSize: '11px', padding: '5px 2px', minHeight: '32px' }}
            >
              強制消灯
            </button>
          </div>
        </fieldset>

        {/* Critical Emergency Light */}
        <div style={{ marginTop: 'auto', paddingTop: '6px' }}>
          <button
            onClick={onEmergencyAllLight}
            className="win95-btn"
            style={{
              width: '100%',
              minHeight: '42px',
              backgroundColor: '#823838',
              color: '#f8f1f1',
              fontWeight: 'bold',
              fontSize: '12px',
              letterSpacing: '0.5px',
              borderTop: '2px solid #b86b6b',
              borderLeft: '2px solid #b86b6b',
              borderRight: '2px solid #3d1b1b',
              borderBottom: '2px solid #3d1b1b',
            }}
          >
            非常用全照明発火 [EMERGENCY LIGHT]
          </button>
        </div>
      </div>
    </div>
  );
};
