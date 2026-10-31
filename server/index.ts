/**
 * @file index.ts
 * @description アトラクション統合サーバーのエントリーポイント。
 * Next.js (App Router) カスタムサーバー、HTTPS/HTTP終端、Socket.IO WebSocket通信、
 * エレベータ演出シーケンス、機材制御(MCU)、写真審査、緊急時一斉点灯を統括します。
 */

import express from 'express';
import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import next from 'next';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { store } from './store';
import { mcuManager } from './mcu-manager';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  DevicePhase,
  GlitchEffectOptions,
  TorchEffectOptions,
  SoundEffectOptions,
  EquipmentItem,
  CctvCameraId,
  CctvSignalPayload,
  CctvLightPayload,
  CctvCameraStatusPayload,
} from '../src/lib/types';

// ============================================================================
// 1. 演出定数 & タイムアウト定義 (Magic Numberの集約)
// ============================================================================

/** 演出シーケンスのタイミング設定 (ミリ秒) */
export const EFFECT_TIMINGS = {
  /** エレベータが1FからB1Fへの移動に要する時間 (3.5秒) */
  ELEVATOR_MOVE_DURATION_MS: 3500,
  /** エレベータ到着時の画面グリッチ・明滅演出時間 (1.2秒) */
  ELEVATOR_ARRIVAL_GLITCH_DURATION_MS: 1200,
  /** デフォルトのエレベータ単発グリッチ時間 (1.5秒) */
  ELEVATOR_DEFAULT_GLITCH_DURATION_MS: 1500,
  /** 画像転送用最大バッファサイズ (20MB) */
  MAX_HTTP_BUFFER_SIZE_BYTES: 2e7,
} as const;

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

// ============================================================================
// 2. SSL/TLS 証明書ローダー
// ============================================================================

/**
 * certificates/ ディレクトリまたは環境変数からSSL証明書と秘密鍵を読み込みます。
 * HTTPSはWeb Serial APIやCamera API (useTorch) をLAN内で動作させるために必須です。
 *
 * @returns {{ cert: Buffer; key: Buffer; certPath: string; keyPath: string } | null}
 */
function getSslCredentials() {
  const certDir = path.join(process.cwd(), 'certificates');
  const certPath = process.env.SSL_CERT_PATH || path.join(certDir, 'cert.pem');
  const keyPath = process.env.SSL_KEY_PATH || path.join(certDir, 'key.pem');

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    try {
      const cert = fs.readFileSync(certPath);
      const key = fs.readFileSync(keyPath);
      return { cert, key, certPath, keyPath };
    } catch (e) {
      console.warn('[SSL] Failed to read certificate files, falling back to HTTP:', e);
    }
  }
  return null;
}

// ============================================================================
// 3. サーバー初期化 & WebSocketイベントハンドリング
// ============================================================================

async function main() {
  await nextApp.prepare();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '20mb' }));

  const ssl = getSslCredentials();
  const isHttps = !!ssl;
  const server = isHttps
    ? https.createServer({ key: ssl.key, cert: ssl.cert }, app)
    : http.createServer(app);

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    maxHttpBufferSize: EFFECT_TIMINGS.MAX_HTTP_BUFFER_SIZE_BYTES,
  });

  /** CCTV 監視カメラ接続台帳 (cam1, cam2, cam3) */
  const cctvCameras = new Map<
    CctvCameraId,
    { socketId: string; deviceId?: string; lightOn: boolean; batteryLevel?: number | string }
  >();

  /** 管理コンソール画面 (Admin) に最新の全体状態を一括同期 */
  const broadcastAdminState = () => {
    io.emit('admin:state_sync', {
      devices: store.getAllDevices(),
      submissions: store.getSubmissions(),
      equipments: store.getEquipments(),
      currentElevatorState: store.getElevatorState(),
    });
  };

  io.on('connection', (socket: Socket) => {
    // ------------------------------------------------------------------------
    // A. クライアント端末（参加者端末）ライフサイクルイベント
    // ------------------------------------------------------------------------

    // 端末の準備完了・ルーム参加
    socket.on('device:ready', ({ deviceId, phase, location, role = 'client' }) => {
      socket.join(`device:${deviceId}`);
      if (role === 'sound_node') {
        socket.join('sound_nodes');
      }
      const dev = store.registerDevice(deviceId, socket.id, phase, location, role);
      console.log(`[Socket] Device ready: ${deviceId} (Role: ${role}, Phase: ${dev.phase}, Loc: ${location || 'N/A'})`);

      // 接続端末へ現在のエレベータ状態を初期配信
      socket.emit('elevator:state', store.getElevatorState());
      broadcastAdminState();
    });

    // 探索・点検の開始トリガー（端末側はプレショーをスキップしエリア1品質管理室へ直行）
    socket.on('device:start_inspection', ({ deviceId }) => {
      console.log(`[Socket] Device start inspection (skip preshow -> quality_control): ${deviceId}`);
      store.updateDevice(deviceId, { phase: 'quality_control' });
      io.to(`device:${deviceId}`).emit('phase:update', { phase: 'quality_control', deviceId });
      broadcastAdminState();
    });

    // お客さんスマホからの各エリア「到着」通知ハンドラー
    socket.on('device:arrive', ({ deviceId, phase: targetPhase }) => {
      console.log(`[Socket] Device ${deviceId} arrived at phase: ${targetPhase}`);
      store.updateDevice(deviceId, { phase: targetPhase });
      io.to(`device:${deviceId}`).emit('phase:update', { phase: targetPhase, deviceId });
      io.emit('phase:arrival_confirmed', { phase: targetPhase, deviceId });

      // エリアごとの自動ハードウェア・ギミックトリガー
      if (targetPhase === 'manufacturing_line' || targetPhase === 'AREA_2_CONVEYOR') {
        // 到着トリガーによりベルトコンベアが自動起動 (ESP32/リレー経由で6秒間駆動)
        console.log('[Socket] Manufacturing line arrival -> Auto starting conveyor test run (6s)');
        mcuManager.handleConveyorControl('forward', 100);
        store.updateEquipmentState('eq_conveyor_01', true);
        const eq = store.getEquipments().find((e) => e.id === 'eq_conveyor_01');
        if (eq) io.emit('equipment:updated', eq);

        setTimeout(() => {
          mcuManager.handleConveyorControl('stop');
          store.updateEquipmentState('eq_conveyor_01', false);
          const stopEq = store.getEquipments().find((e) => e.id === 'eq_conveyor_01');
          if (stopEq) io.emit('equipment:updated', stopEq);
          broadcastAdminState();
        }, 6000);
      }

      broadcastAdminState();
    });

    // プレショー開始トリガー (Adminまたはクライアントから)
    socket.on('preshow:start', (payload) => {
      console.log('[Socket] Preshow start triggered:', payload);
      io.emit('preshow:trigger', payload || {});
      io.emit('preshow:start', payload || {});
      broadcastAdminState();
    });

    // プレショー終了トリガー (映像終了イベント検知でスマホへ振動+アラート通知、品質管理室誘導)
    socket.on('preshow:ended', ({ targetDeviceId } = {}) => {
      console.log(`[Socket] Preshow ended event received (target: ${targetDeviceId || 'ALL'})`);
      const targetRoom = targetDeviceId ? `device:${targetDeviceId}` : null;

      // 該当グループのスマホ端末へ通知（バイブレーション + アラート音）
      const notifyPayload = { soundType: 'lowImpact' as const, level: 3 };
      const glitchPayload: GlitchEffectOptions = { level: 2, duration: 1500, vibrate: true, mode: 'creepy' };

      if (targetRoom) {
        io.to(targetRoom).emit('effect:sound', notifyPayload);
        io.to(targetRoom).emit('effect:glitch', glitchPayload);
        io.to(targetRoom).emit('preshow:ended', { targetDeviceId });
        store.updateDevice(targetDeviceId, { phase: 'quality_control' });
        io.to(targetRoom).emit('phase:update', { phase: 'quality_control', deviceId: targetDeviceId });
      } else {
        io.emit('effect:sound', notifyPayload);
        io.emit('effect:glitch', glitchPayload);
        io.emit('preshow:ended');
        for (const dev of store.getAllDevices()) {
          if (dev.role === 'client' && (dev.phase === 'preshow' || dev.phase === 'STANDBY')) {
            store.updateDevice(dev.deviceId, { phase: 'quality_control' });
            io.to(`device:${dev.deviceId}`).emit('phase:update', { phase: 'quality_control', deviceId: dev.deviceId });
          }
        }
      }
      broadcastAdminState();
    });

    // バッテリー残量・充電状態のテレメトリ更新
    socket.on('device:battery_update', ({ deviceId, batteryLevel, charging }) => {
      store.updateDevice(deviceId, { batteryLevel, charging });
      broadcastAdminState();
    });

    // フラッシュライトの物理状態テレメトリ更新
    socket.on('device:flash_state', ({ deviceId, flashState }) => {
      store.updateDevice(deviceId, { flashState });
      broadcastAdminState();
    });

    // ------------------------------------------------------------------------
    // B. ミッション写真提出・審査
    // ------------------------------------------------------------------------

    socket.on('task:photo_submit', ({ deviceId, taskId, taskTitle, imageBase64 }) => {
      console.log(`[Socket] Photo submitted by ${deviceId} for task ${taskId}: ${taskTitle}`);
      const { deduped } = store.addSubmission(deviceId, taskId, taskTitle, imageBase64);
      if (deduped) {
        console.log(`[Socket] Debounced duplicate submission from ${deviceId} on task ${taskId}`);
        return;
      }
      broadcastAdminState();
    });

    // ------------------------------------------------------------------------
    // C. 機材制御・エレベータ・演出連動
    // ------------------------------------------------------------------------

    // ギミック直接制御（生首ギミック等）
    socket.on('gimmick:trigger', ({ gimmickId, action, value }) => {
      console.log(`[Socket] Gimmick triggered: ${gimmickId}, action: ${action}`);
      if (gimmickId === 'head' || gimmickId === 'eq_head_gimmick_01') {
        mcuManager.handleHeadGimmick(true, 3000);
      }
      io.emit('gimmick:trigger', { gimmickId, action, value });
      broadcastAdminState();
    });

    // 個別機材の直接トグル操作
    socket.on('machine:control', ({ machineId, state, deviceId }) => {
      console.log(`[Socket] Machine control from ${deviceId}: ${machineId} = ${state}`);
      mcuManager.handleMachineControl(machineId, state);
      const eq = store.getEquipments().find((e) => e.id === machineId);
      if (eq) {
        io.emit('equipment:updated', eq);
      }
      broadcastAdminState();
    });

    // 搬送コンベア制御（テスト稼働・自動停止タイマー対応）
    socket.on('conveyor:control', ({ action, speed, durationMs = 6000, deviceId }) => {
      console.log(`[Socket] Conveyor control received: ${action} (from: ${deviceId || socket.id}, duration: ${durationMs}ms)`);

      if (action === 'forward' || action === 'reverse' || action === 'test_run') {
        const driveAction = action === 'reverse' ? 'reverse' : 'forward';
        mcuManager.handleConveyorControl(driveAction, speed);
        store.updateEquipmentState('eq_conveyor_01', true);
        const eq = store.getEquipments().find((e) => e.id === 'eq_conveyor_01');
        if (eq) {
          io.emit('equipment:updated', eq);
        }
        broadcastAdminState();

        // 指定秒数後に自動停止（管理者介入不要）
        setTimeout(() => {
          console.log(`[Socket] Conveyor auto-stop timer fired after ${durationMs}ms`);
          mcuManager.handleConveyorControl('stop');
          store.updateEquipmentState('eq_conveyor_01', false);
          const stopEq = store.getEquipments().find((e) => e.id === 'eq_conveyor_01');
          if (stopEq) {
            io.emit('equipment:updated', stopEq);
          }
          broadcastAdminState();
        }, durationMs);
      } else {
        mcuManager.handleConveyorControl('stop');
        store.updateEquipmentState('eq_conveyor_01', false);
        const eq = store.getEquipments().find((e) => e.id === 'eq_conveyor_01');
        if (eq) {
          io.emit('equipment:updated', eq);
        }
        broadcastAdminState();
      }
    });

    // エレベータ主電源投入
    socket.on('elevator:power', ({ powerOn, deviceId }) => {
      console.log(`[Socket] Elevator power toggled: ${powerOn} (by: ${deviceId || socket.id})`);
      const current = store.getElevatorState();
      store.setElevatorState({ ...current, powerOn });
      io.emit('elevator:power', { powerOn });
      io.emit('elevator:state', { ...current, powerOn });
      broadcastAdminState();
    });

    // エレベータフロアの直接指定
    socket.on('elevator:set_floor', ({ floor, glitch, powerOn }) => {
      console.log(`[Socket] Elevator floor set: ${floor}`);
      const currentPower = powerOn !== undefined ? powerOn : store.getElevatorState().powerOn;
      store.setElevatorState({ floor, glitch, powerOn: currentPower });
      io.emit('elevator:state', { floor, glitch, powerOn: currentPower });
      if (floor === 'FLOOR_1' || floor === 'FLOOR_B1' || floor === 'MOVING') {
        mcuManager.handleElevatorMove(floor);
      }
      broadcastAdminState();
    });

    // エレベータ移動演出シーケンス (降下シーケンス: 扉閉鎖、降下音、照明明滅、ディスプレイ階数降下、スマホグリッチ・暗転)
    socket.on('elevator:trigger_move', ({ from = 'FLOOR_1', to = 'FLOOR_B1', deviceId }) => {
      console.log(`[Socket] Elevator sequence triggered from ${from} -> ${to} (by: ${deviceId || socket.id})`);

      // 1. 移動開始: MCUとエレベータ表示画面にMOVINGを通知、照明異常(明滅)をESP32へ送出
      mcuManager.handleElevatorMove('MOVING');
      mcuManager.handleLightingAnomaly('flicker', EFFECT_TIMINGS.ELEVATOR_MOVE_DURATION_MS);
      store.setElevatorState({ floor: 'MOVING', powerOn: true });
      io.emit('elevator:state', { floor: 'MOVING', powerOn: true });

      // 会場音響・サウンドノードへ降下音・モーター音再生
      io.to('sound_nodes').emit('sound:play', {
        soundType: 'motor',
        level: 4,
        volume: 1.8,
        durationMs: EFFECT_TIMINGS.ELEVATOR_MOVE_DURATION_MS,
      });

      // 降下途中でスマホ画面がグリッチ・暗転し、端末から異常音・恐怖SEを強制再生
      setTimeout(() => {
        const glitchOptions: GlitchEffectOptions = {
          level: 3,
          duration: 2200,
          mode: 'blackout',
          vibrate: true,
        };
        const soundOptions: SoundEffectOptions = {
          soundType: 'lowImpact',
          level: 4,
        };

        if (deviceId) {
          io.to(`device:${deviceId}`).emit('effect:glitch', glitchOptions);
          io.to(`device:${deviceId}`).emit('effect:sound', soundOptions);
        } else {
          for (const dev of store.getAllDevices()) {
            if (dev.phase === 'elevator' || dev.phase === 'ELEVATOR') {
              io.to(`device:${dev.deviceId}`).emit('effect:glitch', glitchOptions);
              io.to(`device:${dev.deviceId}`).emit('effect:sound', soundOptions);
            }
          }
        }
      }, 1200);

      broadcastAdminState();

      // 2. 移動時間待機後、到着時のグリッチ演出と目標階層を適用 (扉が開き、スマホに製造ラインへの移動指示が表示可能に)
      setTimeout(() => {
        io.emit('elevator:glitch', { duration: EFFECT_TIMINGS.ELEVATOR_ARRIVAL_GLITCH_DURATION_MS });
        store.setElevatorState({ floor: to, glitch: true, powerOn: true });
        io.emit('elevator:state', { floor: to, glitch: true, powerOn: true });
        mcuManager.handleElevatorMove(to);
        mcuManager.handleLightingAnomaly('normal', 1000);
        broadcastAdminState();
      }, EFFECT_TIMINGS.ELEVATOR_MOVE_DURATION_MS);
    });

    // エレベータ単発グリッチ演出
    socket.on('elevator:trigger_glitch', ({ duration = EFFECT_TIMINGS.ELEVATOR_DEFAULT_GLITCH_DURATION_MS } = {}) => {
      console.log(`[Socket] Elevator glitch triggered (${duration}ms)`);
      io.emit('elevator:glitch', { duration });
    });

    // ビデオ再生トリガー
    socket.on('video:trigger_play', (payload) => {
      console.log('[Socket] Video play triggered!', payload);
      io.emit('video:trigger_play', payload || {});
    });

    socket.on('video:ended', ({ deviceId } = {}) => {
      console.log(`[Socket] Video ended on player terminal (reporter: ${deviceId || socket.id})`);
      io.emit('video:ended', { deviceId });
      broadcastAdminState();
    });

    // エリア3モニター室 CCTV映像切り替え指示 (コンソール -> モニター端末)
    socket.on('cctv:monitor_switch', (payload) => {
      console.log('[Socket] CCTV monitor switch requested:', payload);
      io.emit('cctv:monitor_switch', payload);
    });

    // パニック演出トリガー（ビデオ怪異タイムスタンプ検知またはAdmin手動）
    socket.on('panic:trigger', (payload) => {
      console.log('[Socket] CRITICAL PANIC TRIGGERED!', payload);
      // 全端末へパニックイベントをブロードキャスト
      io.emit('panic:trigger', payload || {});

      // 参加中端末を自動で escape (PANIC_ESCAPE) フェーズへ遷移
      for (const dev of store.getAllDevices()) {
        if (dev.phase !== 'STANDBY' && dev.phase !== 'preshow' && dev.role === 'client') {
          store.updateDevice(dev.deviceId, { phase: 'escape' });
          io.to(`device:${dev.deviceId}`).emit('phase:update', { phase: 'escape', deviceId: dev.deviceId });
        }
      }
      broadcastAdminState();
    });

    // ------------------------------------------------------------------------
    // C-2. サウンド専用端末 (Sound Node) 制御
    // ------------------------------------------------------------------------

    // サウンドノードの明示的登録
    socket.on('sound:register_node', ({ deviceId, location }) => {
      socket.join(`device:${deviceId}`);
      socket.join('sound_nodes');
      store.registerDevice(deviceId, socket.id, 'STANDBY', location, 'sound_node');
      console.log(`[Socket] Sound Node explicitly registered: ${deviceId} (Loc: ${location || 'N/A'})`);
      broadcastAdminState();
    });

    // サウンドノード向け再生トリガー (個別端末宛て、または全体配信)
    socket.on('sound:trigger', (payload) => {
      const { targetDeviceId, soundType, volume = 1.0 } = payload;
      console.log(`[Socket] Sound trigger dispatched: ${soundType} -> ${targetDeviceId || 'ALL_SOUND_NODES'} (vol: ${volume})`);

      if (targetDeviceId) {
        io.to(`device:${targetDeviceId}`).emit('sound:play', payload);
      } else {
        // 全Sound Node宛て、および音響演出連動用ルームにブロードキャスト
        io.to('sound_nodes').emit('sound:play', payload);
      }
    });

    // ------------------------------------------------------------------------
    // D. 管理コンソール (Admin) 専用ハンドラー
    // ------------------------------------------------------------------------

    socket.on('admin:join', () => {
      socket.join('admin_room');
      socket.emit('admin:state_sync', {
        devices: store.getAllDevices(),
        submissions: store.getSubmissions(),
        equipments: store.getEquipments(),
        currentElevatorState: store.getElevatorState(),
      });
    });

    socket.on('admin:get_state', () => {
      socket.emit('admin:state_sync', {
        devices: store.getAllDevices(),
        submissions: store.getSubmissions(),
        equipments: store.getEquipments(),
        currentElevatorState: store.getElevatorState(),
      });
    });

    // 写真判定（承認 / 却下）
    socket.on('admin:review_photo', ({ submissionId, status, reason }) => {
      console.log(`[Admin] Review photo: ${submissionId} -> ${status} (${reason || ''})`);
      const updated = store.updateSubmissionStatus(submissionId, status, reason);
      if (updated) {
        io.to(`device:${updated.deviceId}`).emit('task:review_result', {
          submissionId,
          taskId: updated.taskId,
          status,
          reason,
        });

        // 演出連動: 製造ラインの写真（taskId: 10 またはタイトルに「コンベア」を含む）が承認された場合、即座にジャンプスケアを発動
        if (status === 'APPROVED' && (updated.taskId === 10 || updated.taskTitle?.includes('コンベア') || updated.taskTitle?.includes('製造ライン'))) {
          console.log('[Admin Review] Manufacturing line photo APPROVED -> Triggering JUMPSCARE sequence!');
          // 1. 生首ギミック作動 (ESP32リレー/アクチュエータ)
          mcuManager.handleHeadGimmick(true, 3500);

          // 2. 会場スピーカー(sound_nodes) & display/sound へ大音量の悲鳴・効果音
          io.to('sound_nodes').emit('sound:play', {
            soundType: 'file',
            filename: 'シャキーン1.mp3',
            volume: 2.2,
            durationMs: 3500,
          });
          io.to('sound_nodes').emit('sound:play', {
            soundType: 'lowImpact',
            level: 5,
            volume: 2.5,
            durationMs: 3000,
          });

          // 3. 該当端末（または参加者全員）へ大音量SE・激しい赤点滅・画面裂けグリッチ・バイブレーション
          const room = `device:${updated.deviceId}`;
          io.to(room).emit('jumpscare:trigger', { targetDeviceId: updated.deviceId });
          io.to(room).emit('effect:sound', { soundType: 'lowImpact', level: 5, volume: 2.5 });
          io.to(room).emit('effect:glitch', {
            level: 3,
            duration: 3000,
            mode: 'redout',
            vibrate: true,
          });
        }
      }
      broadcastAdminState();
    });

    // ジャンプスケア手動トリガー (Admin手動実行用)
    socket.on('admin:trigger_jumpscare', ({ targetDeviceId } = {}) => {
      console.log(`[Admin] Manual jumpscare triggered (target: ${targetDeviceId || 'ALL'})`);
      mcuManager.handleHeadGimmick(true, 3500);
      io.to('sound_nodes').emit('sound:play', {
        soundType: 'file',
        filename: 'シャキーン1.mp3',
        volume: 2.2,
        durationMs: 3500,
      });
      io.to('sound_nodes').emit('sound:play', {
        soundType: 'lowImpact',
        level: 5,
        volume: 2.5,
        durationMs: 3000,
      });

      const glitchPayload: GlitchEffectOptions = {
        level: 3,
        duration: 3000,
        mode: 'redout',
        vibrate: true,
      };

      if (targetDeviceId) {
        io.to(`device:${targetDeviceId}`).emit('jumpscare:trigger', { targetDeviceId });
        io.to(`device:${targetDeviceId}`).emit('effect:sound', { soundType: 'lowImpact', level: 5 });
        io.to(`device:${targetDeviceId}`).emit('effect:glitch', glitchPayload);
      } else {
        io.emit('jumpscare:trigger');
        io.emit('effect:sound', { soundType: 'lowImpact', level: 5 });
        io.emit('effect:glitch', glitchPayload);
      }
    });

    // フェーズ手動強制変更
    socket.on('admin:override_phase', ({ targetDeviceId, phase }) => {
      console.log(`[Admin] Override phase: ${phase} -> ${targetDeviceId || 'ALL'}`);
      if (targetDeviceId) {
        store.updateDevice(targetDeviceId, { phase });
        io.to(`device:${targetDeviceId}`).emit('phase:update', { phase, deviceId: targetDeviceId });
      } else {
        for (const dev of store.getAllDevices()) {
          store.updateDevice(dev.deviceId, { phase });
          io.to(`device:${dev.deviceId}`).emit('phase:update', { phase, deviceId: dev.deviceId });
        }
      }
      broadcastAdminState();
    });

    // 各種恐怖演出（グリッチ・トーチ点滅・低周波音・シャットダウン）の手動起爆
    socket.on('admin:trigger_effect', ({ targetDeviceId, effectType, options }) => {
      console.log(`[Admin] Trigger effect: ${effectType} -> target: ${targetDeviceId || 'ALL_EXCEPT_STANDBY'}`);

      const emitToTarget = (targetDev: { deviceId: string; phase: DevicePhase }) => {
        // ネタバレ防止: STANDBYフェーズの待機端末には全体演出を波及させない（個別指名時は除く）
        if (!targetDeviceId && targetDev.phase === 'STANDBY') {
          return;
        }

        const room = `device:${targetDev.deviceId}`;
        switch (effectType) {
          case 'glitch':
            io.to(room).emit('effect:glitch', options as GlitchEffectOptions);
            break;
          case 'torch':
            io.to(room).emit('effect:torch', options as TorchEffectOptions);
            break;
          case 'sound':
            io.to(room).emit('effect:sound', options as SoundEffectOptions);
            break;
          case 'volume':
            io.to(room).emit('effect:volume', options as { volume: number });
            break;
          case 'shutdown':
            io.to(room).emit('effect:shutdown');
            break;
        }
      };

      if (targetDeviceId) {
        const dev = store.getDevice(targetDeviceId);
        if (dev) emitToTarget(dev);
      } else {
        for (const dev of store.getAllDevices()) {
          emitToTarget(dev);
        }
      }
    });

    // 緊急時非常用全点灯 (照明・パトランプ全開、コンベア緊急停止)
    socket.on('admin:emergency_all_light', () => {
      console.log('[Admin] EMERGENCY ALL LIGHT triggered!');
      mcuManager.handleEmergencyAllLight();

      // 参加中端末のトーチを一斉強制点灯
      for (const dev of store.getAllDevices()) {
        if (dev.phase !== 'STANDBY') {
          io.to(`device:${dev.deviceId}`).emit('effect:torch', { state: true });
        }
      }
      // 登録されている全ての照明機材をONへ
      for (const eq of store.getEquipments()) {
        if (eq.type === 'light') {
          store.updateEquipmentState(eq.id, true);
        }
      }
      broadcastAdminState();
    });

    // ------------------------------------------------------------------------
    // E. 機材管理 (Equipment CRUD)
    // ------------------------------------------------------------------------

    socket.on('equipment:get_all', () => {
      socket.emit('equipment:init', store.getEquipments());
    });

    socket.on('equipment:add', (item: Omit<EquipmentItem, 'updatedAt'>) => {
      const added = store.addEquipment(item);
      io.emit('equipment:updated', added);
      broadcastAdminState();
    });

    socket.on('equipment:remove', ({ id }) => {
      const removed = store.removeEquipment(id);
      if (removed) {
        io.emit('equipment:removed', { id });
        broadcastAdminState();
      }
    });

    socket.on('equipment:control', ({ id, action, value }) => {
      const updated = store.updateEquipmentState(id, value);
      if (updated) {
        mcuManager.dispatchCommand(
          updated.topic || `mcu/equipment/${id}`,
          { action, value },
          updated.protocol || 'serial'
        );
        io.emit('equipment:updated', updated);
        broadcastAdminState();
      }
    });

    // ------------------------------------------------------------------------
    // F. CCTV 監視カメラ WebRTCシグナリング & 遠隔ライト制御
    // ------------------------------------------------------------------------

    // カメラ端末（配信側）の登録
    socket.on('cctv:register_camera', ({ camId, deviceId }) => {
      console.log(`[CCTV] Camera registered: ${camId} (socket: ${socket.id}, deviceId: ${deviceId || 'N/A'})`);
      socket.join(`cctv_camera:${camId}`);
      cctvCameras.set(camId, { socketId: socket.id, deviceId, lightOn: false });

      // ビューアーへカメラがオンラインになったことを通知
      const statusPayload: CctvCameraStatusPayload = { camId, online: true, lightOn: false };
      io.to('cctv_viewers').emit('cctv:status', statusPayload);
    });

    // CCTV監視ダッシュボード（受信側）の登録
    socket.on('cctv:register_viewer', () => {
      socket.join('cctv_viewers');
      console.log(`[CCTV] Viewer registered: ${socket.id}`);

      // 現在の全カメラステータスを即時返信
      const allStatus: CctvCameraStatusPayload[] = (['cam1', 'cam2', 'cam3'] as CctvCameraId[]).map((id) => {
        const cam = cctvCameras.get(id);
        return {
          camId: id,
          online: !!cam,
          lightOn: cam?.lightOn ?? false,
          batteryLevel: cam?.batteryLevel,
        };
      });
      socket.emit('cctv:all_status', allStatus);

      // 各接続中カメラにビューアー準備完了シグナルを通知 (再接続・ストリーム開始促進)
      for (const [camId] of cctvCameras.entries()) {
        io.to(`cctv_camera:${camId}`).emit('cctv:signal', {
          camId,
          type: 'viewer_ready',
          senderSocketId: socket.id,
        });
      }
    });

    // WebRTCシグナリング（SDP offer/answer, ICE candidate）の中継
    socket.on('cctv:signal', (payload: CctvSignalPayload) => {
      const { camId, targetSocketId, type } = payload;
      // 送信元のソケットIDを付与
      const forwarded: CctvSignalPayload = { ...payload, senderSocketId: socket.id };

      if (targetSocketId) {
        // 指定された個別ソケットへ転送
        io.to(targetSocketId).emit('cctv:signal', forwarded);
      } else if (type === 'offer' || type === 'candidate') {
        // カメラ端末からのオファー/候補は全CCTVビューアーへ
        io.to('cctv_viewers').emit('cctv:signal', forwarded);
      } else {
        // ビューアーからのアンサー/候補は該当カメラ端末へ
        io.to(`cctv_camera:${camId}`).emit('cctv:signal', forwarded);
      }
    });

    // 監視画面からの遠隔カメラライト（Torch）制御
    socket.on('cctv:light_control', ({ camId, lightOn }) => {
      console.log(`[CCTV] Light control: ${camId} -> ${lightOn ? 'ON' : 'OFF'}`);
      const cam = cctvCameras.get(camId);
      if (cam) {
        cam.lightOn = lightOn;
      }
      // 該当カメラ端末へ指示送信
      io.to(`cctv_camera:${camId}`).emit('cctv:light_control', { camId, lightOn });
      // ビューアー全員へ状態同期
      io.to('cctv_viewers').emit('cctv:status', { camId, online: !!cam, lightOn });
    });

    // カメラ端末からのステータス自己更新
    socket.on('cctv:camera_status_update', (payload) => {
      const cam = cctvCameras.get(payload.camId);
      if (cam) {
        if (payload.lightOn !== undefined) cam.lightOn = payload.lightOn;
        if (payload.batteryLevel !== undefined) cam.batteryLevel = payload.batteryLevel;
      }
      io.to('cctv_viewers').emit('cctv:status', payload);
    });

    // 全カメラ状態取得要求
    socket.on('cctv:get_status', () => {
      const allStatus: CctvCameraStatusPayload[] = (['cam1', 'cam2', 'cam3'] as CctvCameraId[]).map((id) => {
        const cam = cctvCameras.get(id);
        return {
          camId: id,
          online: !!cam,
          lightOn: cam?.lightOn ?? false,
          batteryLevel: cam?.batteryLevel,
        };
      });
      socket.emit('cctv:all_status', allStatus);
    });

    // 切断時のクリーンアップ
    socket.on('disconnect', () => {
      // CCTVカメラ切断判定
      for (const [camId, cam] of cctvCameras.entries()) {
        if (cam.socketId === socket.id) {
          console.log(`[CCTV] Camera disconnected: ${camId}`);
          cctvCameras.delete(camId);
          io.to('cctv_viewers').emit('cctv:status', { camId, online: false, lightOn: false });
          break;
        }
      }

      const removed = store.removeDeviceBySocketId(socket.id);
      if (removed) {
        console.log(`[Socket] Device disconnected: ${removed.deviceId}`);
        broadcastAdminState();
      }
    });
  });

  // Next.js リクエストハンドラーへ委託
  app.all('*', (req, res) => {
    return handle(req, res);
  });

  server.listen(port, () => {
    const protocol = isHttps ? 'https' : 'http';
    console.log(`> Ready on ${protocol}://localhost:${port}`);
    if (isHttps) {
      console.log(`[SSL] HTTPS enabled using:`);
      console.log(`      Cert: ${ssl.certPath}`);
      console.log(`      Key:  ${ssl.keyPath}`);
    } else {
      console.log(`[SSL] Running on HTTP (certificates/cert.pem & key.pem not found or not loaded)`);
    }
  });
}

main().catch((err) => {
  console.error('Server startup error:', err);
  process.exit(1);
});
