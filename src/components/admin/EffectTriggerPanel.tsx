'use client';

import React, { useState, useEffect } from 'react';
import { DeviceInfo, DevicePhase, TorchEffectOptions, EquipmentItem } from '../../lib/types';
import '../../styles/admin.css';

type GlitchMode =
  | 'violent'
  | 'creepy'
  | 'invert'
  | 'blackout'
  | 'redout'
  | 'static'
  | 'nightmare'
  | 'hallucination'
  | 'corruption'
  | 'stalker'
  | 'heartbeat'
  | 'signalLoss';

interface EffectTriggerPanelProps {
  devices?: DeviceInfo[];
  onOverrideAllPhase?: (phase: DevicePhase) => void;
  onTriggerGlitch: (options: {
    level: number;
    duration: number;
    mode: GlitchMode;
    vibrate: boolean;
  }) => void;
  onTriggerSound: (soundType: string, level?: number) => void;
  /** サウンド専用ノード (Sound Nodes) に対する演出再生 (全体または個別端末) */
  onTriggerSoundNode?: (
    soundType: string,
    level?: number,
    volume?: number,
    filename?: string,
    targetDeviceId?: string
  ) => void;
  /** MP3/音声ファイル再生トリガー */
  onTriggerFileSound?: (filename: string, volume?: number, loop?: boolean) => void;
  onTriggerTorch: (options: TorchEffectOptions) => void;
  onSetVolume: (volume: number) => void;
  onEmergencyAllLight: () => void;
  onTriggerShutdown: () => void;
  /** エリア3 パニック演出手動強制発火 (フェイルセーフ) */
  onTriggerPanic?: () => void;
  // New manual equipment / display controls
  equipments?: EquipmentItem[];
  onElevatorSetFloor?: (floor: 'FLOOR_1' | 'MOVING' | 'FLOOR_B1' | 'OFF') => void;
  onElevatorTriggerMove?: () => void;
  onElevatorGlitch?: () => void;
  onElevatorPlayVideo?: () => void;
  onConveyorControl?: (action: 'forward' | 'reverse' | 'stop') => void;
  onTriggerVideoPlay?: () => void;
  /** プレショー演出制御 */
  onTriggerPreshow?: () => void;
  onTriggerPreshowEnd?: () => void;
  /** ギミック強制トリガー (生首・ジャンプスケア) */
  onTriggerHeadGimmick?: () => void;
  onTriggerJumpscare?: () => void;
  /** エリア3モニター室 CCTV映像切り替え */
  onSwitchCctv?: (camId: import('../../lib/types').CctvCameraId | 'grid3') => void;
}

const GLITCH_MODES: { mode: GlitchMode; label: string; title: string }[] = [
  { mode: 'creepy', label: '不穏(波打ち)', title: '不穏な波打ち・微細な歪み・囁き音' },
  { mode: 'violent', label: '激震(裂け)', title: '激しいRGBズレ・画面裂け・火花音' },
  { mode: 'nightmare', label: '悪夢(絶叫)', title: '狂気の激震・サブリミナル目・金属絶叫' },
  { mode: 'hallucination', label: '幻覚(侵食)', title: '空間歪曲・怪異接近・幻聴囁き' },
  { mode: 'corruption', label: '汚染(破損)', title: 'データ崩壊・文字化けモザイク・スパーク' },
  { mode: 'stalker', label: '凝視(気配)', title: '周囲暗闇・息苦しい脈動・血の手形' },
  { mode: 'heartbeat', label: '心拍(瀕死)', title: '激しい心臓拍動拡縮・血潮パルス・低音心拍' },
  { mode: 'signalLoss', label: '断絶(消失)', title: '画面縦ロール同期崩壊・電波混線ノイズ' },
  { mode: 'invert', label: '色反転', title: '白黒・色彩の急激な反転妨害' },
  { mode: 'blackout', label: '突発暗転', title: '突発的な暗転・チカチカ点滅・重低音' },
  { mode: 'redout', label: '血色赤転', title: '警告警報・血色赤転フラッシュ' },
  { mode: 'static', label: '砂嵐ノイズ', title: 'アナログVHS砂嵐・走査線ノイズ' },
];

const SOUND_BUTTONS: { type: string; label: string; level?: number }[] = [
  { type: 'beep', label: '確認ビープ' },
  { type: 'lowImpact', label: '衝撃重低音' },
  { type: 'scream', label: '絶叫金属音' },
  { type: 'whisper', label: '不気味な囁き' },
  { type: 'glitchBurst', label: 'スパーク放電' },
  { type: 'heartbeat', label: '急迫心拍音' },
  { type: 'interference', label: '電波妨害混線' },
  { type: 'eerieTone', label: '不吉な鐘音' },
  { type: 'geiger', label: 'ガイガー異変', level: 4 },
  { type: 'drone', label: '不穏ドローン' },
  { type: 'motor', label: 'モーター稼働' },
  { type: 'powerDown', label: '電源降下音' },
];

const VOLUME_STEPS = [1.0, 1.5, 2.0, 2.5];

export const EffectTriggerPanel: React.FC<EffectTriggerPanelProps> = ({
  devices = [],
  onOverrideAllPhase,
  onTriggerGlitch,
  onTriggerSound,
  onTriggerSoundNode,
  onTriggerFileSound,
  onTriggerTorch,
  onSetVolume,
  onEmergencyAllLight,
  onTriggerShutdown,
  onTriggerPanic,
  equipments = [],
  onElevatorSetFloor,
  onElevatorTriggerMove,
  onElevatorGlitch,
  onElevatorPlayVideo,
  onConveyorControl,
  onTriggerVideoPlay,
  onTriggerPreshow,
  onTriggerPreshowEnd,
  onTriggerHeadGimmick,
  onTriggerJumpscare,
  onSwitchCctv,
}) => {
  const [glitchLevel, setGlitchLevel] = useState<number>(2);
  const [glitchDuration, setGlitchDuration] = useState<number>(3000);
  const [glitchMode, setGlitchMode] = useState<GlitchMode>('creepy');
  const [selectedVolume, setSelectedVolume] = useState<number>(1.0);
  const [customFileName, setCustomFileName] = useState<string>('alarm.mp3');
  const [targetNodeId, setTargetNodeId] = useState<string>('ALL');
  const [audioFiles, setAudioFiles] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/audio-files')
      .then((res) => (res.ok ? res.json() : { files: [] }))
      .then((data) => {
        if (Array.isArray(data.files)) {
          setAudioFiles(data.files);
          if (data.files.length > 0) {
            setCustomFileName(data.files[0]);
          }
        }
      })
      .catch((err) => {
        console.warn('[EffectTriggerPanel] Failed to fetch audio files:', err);
      });
  }, []);

  const soundNodeDevices = devices.filter((d) => d.role === 'sound_node');

  // コンベア (eq_conveyor_01) のリアルタイム稼働状態
  const conveyorEq = equipments.find((e) => e.id === 'eq_conveyor_01');
  const isConveyorActive = !!conveyorEq?.state;

  const handleVolumeChange = (vol: number) => {
    setSelectedVolume(vol);
    onSetVolume(vol);
  };

  return (
    <div className="win95-window admin-panel">
      <div className="win95-titlebar effect-titlebar">
        <span>[演出・機材・会場進行制御]</span>
      </div>

      <div className="effect-body">

        {/* プレショー操作パネル */}
        <fieldset className="win95-groupbox">
          <legend className="win95-groupbox-legend">① プレショー演出制御</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            <button
              onClick={() => onTriggerPreshow && onTriggerPreshow()}
              className="win95-btn btn-natural-wrap break-keep leading-snug"
              style={{ padding: '6px 4px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#0d47a1', color: '#fff' }}
              title="プレショー映像の再生をトリガー"
            >
              <span className="inline-block">プレショー映像</span>{' '}
              <span className="inline-block">再生</span>
            </button>
            <button
              onClick={() => onTriggerPreshowEnd && onTriggerPreshowEnd()}
              className="win95-btn btn-natural-wrap break-keep leading-snug"
              style={{ padding: '6px 4px', fontSize: '11px', fontWeight: 'bold', backgroundColor: '#1b5e20', color: '#fff' }}
              title="映像終了イベントを送信し、スマホ端末へ振動+アラート音通知と品質管理室移動を指示"
            >
              <span className="inline-block">上映終了 -&gt;</span>{' '}
              <span className="inline-block">点検指示通知</span>
            </button>
          </div>
        </fieldset>

        {/* Dedicated Elevator Display & MCU Test Panel */}
        <fieldset className="win95-groupbox">
          <legend className="win95-groupbox-legend">③ エレベーター降下 &amp; 階数表示</legend>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '6px' }}>
            <button
              onClick={() => onElevatorPlayVideo && onElevatorPlayVideo()}
              className="win95-btn btn-natural-wrap break-keep leading-snug"
              style={{
                padding: '6px 4px',
                fontSize: '11px',
                fontWeight: 'bold',
                backgroundColor: '#1565c0',
                color: '#fff',
                border: '1px solid #1e88e5',
              }}
              title="エレベーター背景画面（/display/elevator）でエレベーター映像（elevator.mp4）を再生"
            >
              <span className="inline-block">🎬 EV映像再生</span>
            </button>
            <button
              onClick={() => onElevatorTriggerMove && onElevatorTriggerMove()}
              className="win95-btn btn-natural-wrap break-keep leading-snug"
              style={{
                padding: '6px 4px',
                fontSize: '11px',
                fontWeight: 'bold',
                backgroundColor: '#263238',
                color: '#fff',
              }}
              title="扉閉鎖 -> 降下音 -> 照明明滅 -> 暗転 -> 到着の一連のシーケンスを実行"
            >
              <span className="inline-block">降下シーケンス実行</span>
            </button>
          </div>
        </fieldset>

        {/* ④ 製造ライン ＆ ギミック・生首制御 */}
        <fieldset className="win95-groupbox">
          <legend className="win95-groupbox-legend">
            ④ 製造ライン (コンベア・生首・ジャンプスケア)
          </legend>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', fontSize: '11px' }}>
            <span>ベルトコンベア:</span>
            <span style={{ fontWeight: 'bold', color: isConveyorActive ? '#4caf50' : '#888' }}>
              {isConveyorActive ? '[通電中: 稼働中]' : '[停止中: 待機]'}
            </span>
          </div>
          <div className="effect-grid cols-3" style={{ marginBottom: '6px' }}>
            <button
              onClick={() => onConveyorControl && onConveyorControl('forward')}
              className="win95-btn"
              style={{ padding: '4px 2px', fontSize: '10px' }}
            >
              コンベア正転(6s)
            </button>
            <button
              onClick={() => onConveyorControl && onConveyorControl('reverse')}
              className="win95-btn"
              style={{ padding: '4px 2px', fontSize: '10px' }}
            >
              コンベア逆転(6s)
            </button>
            <button
              onClick={() => onConveyorControl && onConveyorControl('stop')}
              className="win95-btn"
              style={{ padding: '4px 2px', fontSize: '10px', color: '#e53935' }}
            >
              緊急停止
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            <button
              onClick={() => onTriggerHeadGimmick && onTriggerHeadGimmick()}
              className="win95-btn"
              style={{ padding: '6px 2px', fontSize: '11px', fontWeight: 'bold', color: '#fff', backgroundColor: '#e65100' }}
              title="ESP32リレー/アクチュエータへ生首ギミック作動信号を送出"
            >
              生首ギミック強制作動
            </button>
            <button
              onClick={() => onTriggerJumpscare && onTriggerJumpscare()}
              className="win95-btn"
              style={{ padding: '6px 2px', fontSize: '11px', fontWeight: 'bold', color: '#fff', backgroundColor: '#b71c1c' }}
              title="生首ギミック作動 + 会場大音量悲鳴 + スマホ赤点滅・大音量SEのジャンプスケア一斉起爆"
            >
              ジャンプスケア一斉発火
            </button>
          </div>
        </fieldset>

        {/* ⑤ モニター室・最終演出 */}
        <fieldset className="win95-groupbox">
          <legend className="win95-groupbox-legend">
            ⑤ モニター室 (映像・CCTV切替 &amp; パニック脱出)
          </legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '6px' }}>
            <button
              onClick={() => onTriggerVideoPlay && onTriggerVideoPlay()}
              className="win95-btn"
              style={{ padding: '6px 2px', fontSize: '10px', fontWeight: 'bold', color: '#fff', backgroundColor: '#6a1b9a' }}
              title="プロジェクター（/display/video）で最終アーカイブ映像を再生"
            >
              最終映像 再生
            </button>
            <button
              onClick={() => onTriggerPanic && onTriggerPanic()}
              className="win95-btn"
              style={{ padding: '6px 2px', fontSize: '10px', fontWeight: 'bold', color: '#ffffff', backgroundColor: '#d50000', border: '1px solid #ff5252' }}
              title="全端末をパニック逃走状態へ（キャスト飛び出し指示・照明オフ）"
            >
              [合図] パニック脱出発火
            </button>
          </div>

          {/* CCTV切替コントロール (モニター室プロジェクター連動) */}
          <div style={{ borderTop: '1px dashed #555', paddingTop: '4px', marginTop: '4px' }}>
            <div style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 'bold', marginBottom: '3px' }}>
              [モニター室 CCTV遠隔切替]
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '3px' }}>
              <button
                onClick={() => onSwitchCctv && onSwitchCctv('cam3')}
                className="win95-btn"
                style={{ fontSize: '9px', padding: '4px 1px', fontWeight: 'bold', backgroundColor: '#0f172a', color: '#38bdf8', border: '1px solid #0284c7' }}
                title="CAM-3 (製造ライン/モニター室) をモニターに大画面表示"
              >
                CAM-3
              </button>
              <button
                onClick={() => onSwitchCctv && onSwitchCctv('cam1')}
                className="win95-btn"
                style={{ fontSize: '9px', padding: '4px 1px', backgroundColor: '#0f172a', color: '#cbd5e1' }}
                title="CAM-1 (品質管理室) をモニターに大画面表示"
              >
                CAM-1
              </button>
              <button
                onClick={() => onSwitchCctv && onSwitchCctv('cam2')}
                className="win95-btn"
                style={{ fontSize: '9px', padding: '4px 1px', backgroundColor: '#0f172a', color: '#cbd5e1' }}
                title="CAM-2 (EV前通路) をモニターに大画面表示"
              >
                CAM-2
              </button>
              <button
                onClick={() => onSwitchCctv && onSwitchCctv('grid3')}
                className="win95-btn"
                style={{ fontSize: '9px', padding: '4px 1px', backgroundColor: '#1e293b', color: '#e2e8f0' }}
                title="全3カメラをモニター室に3分割表示"
              >
                3分割
              </button>
            </div>
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
              <div className="effect-grid cols-4">
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
              全端末に妨害発火
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
              合格チャイム
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

          {/* 専用サウンドノード (Sound Nodes) 再生制御 */}
          {onTriggerSoundNode && (
            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #444' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 'bold' }}>
                  音響ノード再生トリガー:
                </span>
                {soundNodeDevices.length > 0 && (
                  <select
                    value={targetNodeId}
                    onChange={(e) => setTargetNodeId(e.target.value)}
                    className="win95-inset"
                    style={{ fontSize: '10px', height: '20px', padding: '0 4px', maxWidth: '140px' }}
                    title="再生対象ノードを選択（全体または単一端末）"
                  >
                    <option value="ALL">全音響ノード (一斉)</option>
                    {soundNodeDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.deviceId}{d.location ? ` (${d.location})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* プリセット発火ボタン */}
              <div className="effect-grid cols-3" style={{ marginBottom: '6px' }}>
                <button
                  onClick={() => onTriggerSoundNode('lowImpact', 5, selectedVolume, undefined, targetNodeId === 'ALL' ? undefined : targetNodeId)}
                  className="win95-btn"
                  style={{ fontSize: '10px', color: '#ffb4b4', backgroundColor: '#3b1c1c' }}
                  title="轟音サブベースを大音量再生"
                >
                  会場轟音 (衝撃)
                </button>
                <button
                  onClick={() => onTriggerSoundNode('geiger', 5, selectedVolume, undefined, targetNodeId === 'ALL' ? undefined : targetNodeId)}
                  className="win95-btn"
                  style={{ fontSize: '10px', color: '#ffeb3b', backgroundColor: '#3b381c' }}
                  title="激しいガイガー放射線音"
                >
                  ガイガー異変
                </button>
                <button
                  onClick={() => onTriggerSoundNode('powerDown', 3, selectedVolume, undefined, targetNodeId === 'ALL' ? undefined : targetNodeId)}
                  className="win95-btn"
                  style={{ fontSize: '10px', color: '#90caf9', backgroundColor: '#1c283b' }}
                  title="電源喪失音"
                >
                  電源喪失音
                </button>
              </div>

              {/* MP3音声ファイル (public/audio/) 選択または入力して再生 */}
              <div style={{ fontSize: '10px', color: '#a5b4fc', marginBottom: '2px', fontWeight: 'bold' }}>
                音声ファイル (audio/):
              </div>
              <div style={{ display: 'flex', gap: '3px' }}>
                {audioFiles.length > 0 ? (
                  <select
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    className="win95-inset"
                    style={{ flex: 1, fontSize: '10px', height: '24px', padding: '1px 4px' }}
                  >
                    {audioFiles.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={customFileName}
                    onChange={(e) => setCustomFileName(e.target.value)}
                    placeholder="例: siren.mp3"
                    className="win95-input"
                    style={{ flex: 1, fontSize: '10px', padding: '2px 4px', height: '24px' }}
                  />
                )}
                <button
                  onClick={() => {
                    const file = customFileName.trim();
                    if (!file) return;
                    if (targetNodeId === 'ALL') {
                      onTriggerFileSound?.(file, selectedVolume, false);
                    } else {
                      onTriggerSoundNode('file', 3, selectedVolume, file, targetNodeId);
                    }
                  }}
                  className="win95-btn"
                  style={{ fontSize: '10px', fontWeight: 'bold', color: '#c7d2fe', backgroundColor: '#312e81', minWidth: '70px', height: '24px' }}
                  title="選択した音声ファイルを指定ノード（または全体）で再生"
                >
                  ファイル再生
                </button>
              </div>
            </div>
          )}

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
            非常用全照明発火
          </button>
        </div>
      </div>
    </div>
  );
};
