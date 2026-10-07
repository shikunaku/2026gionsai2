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
        <span>[演出制御] Master Effects &amp; Remote Control</span>
      </div>

      <div className="effect-body">
        {/* Phase Overrides */}
        <fieldset className="win95-groupbox">
          <legend className="win95-groupbox-legend">全端末 フェーズ強制切替</legend>
          <div className="effect-grid cols-3">
            <button
              onClick={() => onOverrideAllPhase('ZONE1')}
              className="win95-btn effect-btn-phase"
            >
              ZONE 1 (写真)
            </button>
            <button
              onClick={() => onOverrideAllPhase('ZONE2')}
              className="win95-btn effect-btn-phase"
            >
              ZONE 2 (機器)
            </button>
            <button
              onClick={() => onOverrideAllPhase('END')}
              className="win95-btn win95-btn-danger effect-btn-phase"
            >
              END (遮断)
            </button>
          </div>
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
          <div className="effect-grid cols-3">
            <button
              onClick={() => onTriggerTorch({ flicker: true, count: 5, intervalMs: 100 })}
              className="win95-btn effect-btn-torch"
            >
              高速点滅
            </button>
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
