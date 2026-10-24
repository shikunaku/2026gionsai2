'use client';

import React, { useState } from 'react';
import { DevicePhase, TorchEffectOptions } from '../../lib/types';
import '../../styles/admin.css';

type GlitchMode = 'violent' | 'creepy' | 'invert' | 'blackout' | 'redout' | 'static';

interface EffectTriggerPanelProps {
  onOverrideAllPhase: (phase: DevicePhase) => void;
  onTriggerGlitch: (options: {
    level: number;
    duration: number;
    mode: GlitchMode;
    vibrate: boolean;
  }) => void;
  onTriggerSound: (soundType: string, level?: number) => void;
  onTriggerTorch: (options: TorchEffectOptions) => void;
  onSetVolume: (volume: number) => void;
  onEmergencyAllLight: () => void;
  onTriggerShutdown: () => void;
  // New manual equipment / display controls
  onElevatorSetFloor?: (floor: 'FLOOR_1' | 'MOVING' | 'FLOOR_B1' | 'OFF') => void;
  onElevatorTriggerMove?: () => void;
  onElevatorGlitch?: () => void;
  onConveyorControl?: (action: 'forward' | 'reverse' | 'stop') => void;
  onTriggerVideoPlay?: () => void;
}

const GLITCH_MODES: { mode: GlitchMode; label: string; title: string }[] = [
  { mode: 'creepy', label: '不穏(歪み)', title: '不穏な波打ち・微細な歪み' },
  { mode: 'violent', label: '激震(裂け)', title: '激しいRGBズレ・画面裂け' },
  { mode: 'invert', label: '色反転', title: '白黒・色彩の急激な反転妨害' },
  { mode: 'blackout', label: '突発暗転', title: '突発的な暗転・チカチカ点滅' },
  { mode: 'redout', label: '血色赤転', title: '警告警報・血色赤転フラッシュ' },
  { mode: 'static', label: '砂嵐ノイズ', title: 'アナログ砂嵐・走査線ノイズ' },
];

const SOUND_BUTTONS: { type: string; label: string; level?: number }[] = [
  { type: 'beep', label: '確認ビープ' },
  { type: 'lowImpact', label: '衝撃重低音' },
  { type: 'geiger', label: 'ガイガー異変', level: 4 },
  { type: 'drone', label: '不穏ドローン' },
  { type: 'motor', label: 'モーター稼働' },
  { type: 'powerDown', label: '電源降下音' },
];

const VOLUME_STEPS = [1.0, 1.5, 2.0, 2.5];

export const EffectTriggerPanel: React.FC<EffectTriggerPanelProps> = ({
  onOverrideAllPhase,
  onTriggerGlitch,
  onTriggerSound,
  onTriggerTorch,
  onSetVolume,
  onEmergencyAllLight,
  onTriggerShutdown,
  onElevatorSetFloor,
  onElevatorTriggerMove,
  onElevatorGlitch,
  onConveyorControl,
  onTriggerVideoPlay,
}) => {
  const [glitchLevel, setGlitchLevel] = useState<number>(2);
  const [glitchDuration, setGlitchDuration] = useState<number>(3000);
  const [glitchMode, setGlitchMode] = useState<GlitchMode>('creepy');
  const [selectedVolume, setSelectedVolume] = useState<number>(1.0);

  const handleVolumeChange = (vol: number) => {
    setSelectedVolume(vol);
    onSetVolume(vol);
  };

  return (
    <div className="win95-window admin-panel">
      <div className="win95-titlebar effect-titlebar">
        <span>[演出・機材制御] Phase &amp; Equipment Remote</span>
      </div>

      <div className="effect-body">
        {/* Phase Overrides (5 stages) */}
        <fieldset className="win95-groupbox">
          <legend className="win95-groupbox-legend">全端末 進行フェーズ手動切替 (5段階)</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '3px', marginTop: '4px' }}>
            <button
              onClick={() => onOverrideAllPhase('STANDBY')}
              className="win95-btn effect-btn-phase"
              title="フェーズ1: 待機・オープニング"
            >
              1.待機
            </button>
            <button
              onClick={() => onOverrideAllPhase('AREA_1_PHOTO')}
              className="win95-btn effect-btn-phase"
              title="フェーズ2: エリア1 撮影提出"
            >
              2.写真
            </button>
            <button
              onClick={() => onOverrideAllPhase('ELEVATOR')}
              className="win95-btn effect-btn-phase"
              title="フェーズ3: エレベータ昇降機"
            >
              3.昇降
            </button>
            <button
              onClick={() => onOverrideAllPhase('AREA_2_CONVEYOR')}
              className="win95-btn effect-btn-phase"
              title="フェーズ4: エリア2 コンベア"
            >
              4.コンベア
            </button>
            <button
              onClick={() => onOverrideAllPhase('AREA_3_VIDEO')}
              className="win95-btn effect-btn-phase"
              title="フェーズ5: エリア3 映像トリガー"
            >
              5.映像
            </button>
          </div>
        </fieldset>

        {/* Dedicated Elevator Display & MCU Test Panel */}
        <fieldset className="win95-groupbox">
          <legend className="win95-groupbox-legend">エレベータ階数表示 &amp; 駆動テスト</legend>
          <div className="effect-grid cols-4">
            <button
              onClick={() => onElevatorSetFloor && onElevatorSetFloor('FLOOR_1')}
              className="win95-btn"
              style={{ padding: '4px 2px', fontSize: '10px' }}
            >
              1階点灯
            </button>
            <button
              onClick={() => onElevatorSetFloor && onElevatorSetFloor('MOVING')}
              className="win95-btn"
              style={{ padding: '4px 2px', fontSize: '10px' }}
            >
              移動(消灯)
            </button>
            <button
              onClick={() => onElevatorSetFloor && onElevatorSetFloor('FLOOR_B1')}
              className="win95-btn"
              style={{ padding: '4px 2px', fontSize: '10px' }}
            >
              B1点灯
            </button>
            <button
              onClick={() => onElevatorGlitch && onElevatorGlitch()}
              className="win95-btn"
              style={{ padding: '4px 2px', fontSize: '10px', color: '#ffb300' }}
            >
              チラつき
            </button>
          </div>
          <button
            onClick={() => onElevatorTriggerMove && onElevatorTriggerMove()}
            className="win95-btn"
            style={{ width: '100%', marginTop: '4px', padding: '5px', fontSize: '11px', fontWeight: 'bold' }}
          >
            昇降シーケンス実行 (1F ➔ 降下 ➔ B1チラつき点灯)
          </button>
        </fieldset>

        {/* Dedicated Conveyor & Video Manual Panel */}
        <fieldset className="win95-groupbox">
          <legend className="win95-groupbox-legend">コンベア操作 &amp; エリア3映像テスト</legend>
          <div className="effect-grid cols-3">
            <button
              onClick={() => onConveyorControl && onConveyorControl('forward')}
              className="win95-btn"
              style={{ padding: '4px 2px', fontSize: '10px' }}
            >
              コンベア正転
            </button>
            <button
              onClick={() => onConveyorControl && onConveyorControl('reverse')}
              className="win95-btn"
              style={{ padding: '4px 2px', fontSize: '10px' }}
            >
              コンベア逆転
            </button>
            <button
              onClick={() => onConveyorControl && onConveyorControl('stop')}
              className="win95-btn"
              style={{ padding: '4px 2px', fontSize: '10px', color: '#e53935' }}
            >
              コンベア停止
            </button>
          </div>
          <button
            onClick={() => onTriggerVideoPlay && onTriggerVideoPlay()}
            className="win95-btn"
            style={{ width: '100%', marginTop: '4px', padding: '6px', fontSize: '11px', fontWeight: 'bold', color: '#fff', backgroundColor: '#6a1b9a' }}
          >
            エリア3 映像再生トリガー [TRIGGER_VIDEO_PLAY]
          </button>
        </fieldset>

        {/* Glitch Panel */}
        <fieldset className="win95-groupbox">
          <legend className="win95-groupbox-legend">画面グリッチ / ノイズ妨害演出</legend>
          <div className="effect-glitch-stack">
            <div className="effect-level-row">
              <span className="effect-label">強度:</span>
              <div className="effect-level-buttons">
                {[1, 2, 3].map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setGlitchLevel(lvl)}
                    className={`win95-btn effect-btn-level ${glitchLevel === lvl ? 'active' : ''}`}
                  >
                    Lv.{lvl}
                  </button>
                ))}
              </div>
            </div>

            <div className="effect-mode-block">
              <span className="effect-label">妨害タイプ (モード):</span>
              <div className="effect-grid cols-3">
                {GLITCH_MODES.map(({ mode, label, title }) => (
                  <button
                    key={mode}
                    onClick={() => setGlitchMode(mode)}
                    className={`win95-btn effect-btn-mode ${glitchMode === mode ? 'active' : ''}`}
                    title={title}
                  >
                    {label}
                  </button>
                ))}
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
              className="win95-btn effect-btn-execute"
            >
              全端末に妨害発火 [EXECUTE]
            </button>
          </div>
        </fieldset>

        {/* Procedural Audio Panel */}
        <fieldset className="win95-groupbox">
          <legend className="win95-groupbox-legend">プロシージャル音響遠隔トリガー</legend>
          <div className="effect-grid cols-2">
            <button
              onClick={() => onTriggerSound('taskSuccess')}
              className="win95-btn effect-btn-sound success"
              title="合格通知チャイム (880Hz->1320Hz)"
            >
              合格チャイム ♪
            </button>
            {SOUND_BUTTONS.map(({ type, label, level }) => (
              <button
                key={type}
                onClick={() => onTriggerSound(type, level)}
                className="win95-btn effect-btn-sound"
              >
                {label}
              </button>
            ))}
          </div>

          {/* Volume multiplier */}
          <div className="effect-volume">
            <div className="effect-volume-title">全端末 音量ブースト:</div>
            <div className="effect-grid">
              {VOLUME_STEPS.map((vol) => (
                <button
                  key={vol}
                  onClick={() => handleVolumeChange(vol)}
                  className={`win95-btn effect-btn-volume${vol >= 2.0 ? ' boost' : ''}${selectedVolume === vol ? ' active' : ''}`}
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
          <div className="effect-grid cols-2">
            <button
              onClick={() => onTriggerTorch({ pattern: '1,0,0,1,0,0,1,0,0,0', intervalMs: 120 })}
              className="win95-btn effect-btn-torch"
              style={{ fontWeight: 'bold', color: '#f0f3f8', backgroundColor: '#5c3a3a' }}
              title="怪異調の「ぴかっ…ぴかっ…ぴかっ…」不気味点滅"
            >
              怪異点滅 (ぴかっ...)
            </button>
            <button
              onClick={() => onTriggerTorch({ flicker: true, count: 6, intervalMs: 90 })}
              className="win95-btn effect-btn-torch"
              title="激しい高速明滅"
            >
              激震点滅 (高速)
            </button>
          </div>
          <div className="effect-grid cols-2" style={{ marginTop: '4px' }}>
            <button
              onClick={() => onTriggerTorch({ state: true })}
              className="win95-btn effect-btn-torch"
            >
              常時点灯
            </button>
            <button
              onClick={() => onTriggerTorch({ state: false, stop: true })}
              className="win95-btn effect-btn-torch"
            >
              強制消灯
            </button>
          </div>
        </fieldset>

        {/* Critical Emergency Light */}
        <div className="effect-emergency">
          <button
            onClick={onEmergencyAllLight}
            className="win95-btn effect-btn-emergency"
          >
            非常用全照明発火 [EMERGENCY LIGHT]
          </button>
        </div>
      </div>
    </div>
  );
};
