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
} from '../src/lib/types';

const port = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

// Check for SSL certificates in certificates/ or custom paths
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
    maxHttpBufferSize: 2e7, // 20MB for image transfers
  });

  const broadcastAdminState = () => {
    io.emit('admin:state_sync', {
      devices: store.getAllDevices(),
      submissions: store.getSubmissions(),
      equipments: store.getEquipments(),
    });
  };

  io.on('connection', (socket: Socket) => {
    // Client joins/identifies
    socket.on('device:ready', ({ deviceId, phase, location }) => {
      socket.join(`device:${deviceId}`);
      const dev = store.registerDevice(deviceId, socket.id, phase, location);
      console.log(`[Socket] Device ready: ${deviceId} (Phase: ${dev.phase}, Loc: ${location || 'N/A'})`);
      broadcastAdminState();
    });

    socket.on('device:start_inspection', ({ deviceId }) => {
      console.log(`[Socket] Device start inspection: ${deviceId}`);
      const updated = store.updateDevice(deviceId, { phase: 'ZONE1' });
      io.to(`device:${deviceId}`).emit('phase:update', { phase: 'ZONE1', deviceId });
      broadcastAdminState();
    });

    socket.on('device:battery_update', ({ deviceId, batteryLevel, charging }) => {
      store.updateDevice(deviceId, { batteryLevel, charging });
      broadcastAdminState();
    });

    socket.on('device:flash_state', ({ deviceId, flashState }) => {
      store.updateDevice(deviceId, { flashState });
      broadcastAdminState();
    });

    socket.on('task:photo_submit', ({ deviceId, taskId, taskTitle, imageBase64 }) => {
      console.log(`[Socket] Photo submitted by ${deviceId} for task ${taskId}: ${taskTitle}`);
      const { submission, deduped } = store.addSubmission(deviceId, taskId, taskTitle, imageBase64);
      if (deduped) {
        console.log(`[Socket] Debounced submission from ${deviceId} on task ${taskId}`);
        return;
      }
      broadcastAdminState();
    });

    socket.on('machine:control', ({ machineId, state, deviceId }) => {
      console.log(`[Socket] Machine control from ${deviceId}: ${machineId} = ${state}`);
      mcuManager.handleMachineControl(machineId, state);
      const eq = store.getEquipments().find((e) => e.id === machineId);
      if (eq) {
        io.emit('equipment:updated', eq);
      }
      broadcastAdminState();
    });

    // Admin handlers
    socket.on('admin:join', () => {
      socket.join('admin_room');
      socket.emit('admin:state_sync', {
        devices: store.getAllDevices(),
        submissions: store.getSubmissions(),
        equipments: store.getEquipments(),
      });
    });

    socket.on('admin:get_state', () => {
      socket.emit('admin:state_sync', {
        devices: store.getAllDevices(),
        submissions: store.getSubmissions(),
        equipments: store.getEquipments(),
      });
    });

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
      }
      broadcastAdminState();
    });

    socket.on('admin:override_phase', ({ targetDeviceId, phase }) => {
      if (targetDeviceId) {
        store.updateDevice(targetDeviceId, { phase });
        io.to(`device:${targetDeviceId}`).emit('phase:update', { phase, deviceId: targetDeviceId });
      } else {
        // Change all devices
        for (const dev of store.getAllDevices()) {
          store.updateDevice(dev.deviceId, { phase });
          io.to(`device:${dev.deviceId}`).emit('phase:update', { phase, deviceId: dev.deviceId });
        }
      }
      broadcastAdminState();
    });

    socket.on('admin:trigger_effect', ({ targetDeviceId, effectType, options }) => {
      console.log(`[Admin] Trigger effect: ${effectType} -> target: ${targetDeviceId || 'ALL_EXCEPT_INIT'}`);

      const emitToTarget = (targetDev: { deviceId: string; phase: DevicePhase }) => {
        // Prevent spoilers: Skip effect for devices in INIT phase unless targeted directly
        if (!targetDeviceId && targetDev.phase === 'INIT') {
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

    socket.on('admin:emergency_all_light', () => {
      console.log('[Admin] EMERGENCY ALL LIGHT triggered!');
      mcuManager.handleEmergencyAllLight();

      // Turn on torch for all active devices (exclude INIT)
      for (const dev of store.getAllDevices()) {
        if (dev.phase !== 'INIT') {
          io.to(`device:${dev.deviceId}`).emit('effect:torch', { state: true });
        }
      }
      // Also update all beacon lights in equipments
      for (const eq of store.getEquipments()) {
        if (eq.type === 'light') {
          store.updateEquipmentState(eq.id, true);
        }
      }
      broadcastAdminState();
    });

    // Equipment handlers
    socket.on('equipment:get_all', () => {
      socket.emit('equipment:init', store.getEquipments());
    });

    socket.on('equipment:add', (item) => {
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
        mcuManager.dispatchCommand(updated.topic || `mcu/equipment/${id}`, { action, value });
        io.emit('equipment:updated', updated);
        broadcastAdminState();
      }
    });

    socket.on('disconnect', () => {
      const removed = store.removeDeviceBySocketId(socket.id);
      if (removed) {
        console.log(`[Socket] Device disconnected: ${removed.deviceId}`);
        broadcastAdminState();
      }
    });
  });

  // Next.js fallback
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
