'use client';

/**
 * @file useSocket.ts
 * @description Socket.IOクライアントのライフサイクル・接続状態・再接続監視フック。
 * 接続/切断状態に加え、再接続試行中フラグや試行回数、ブラウザ自体のオンライン/オフライン状態を提供します。
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '../lib/types';

export interface UseSocketReturn {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  /** WebSocketが正常接続中かどうか */
  connected: boolean;
  /** 再接続を自動試行中かどうか */
  isReconnecting: boolean;
  /** 現在の再接続試行回数 */
  reconnectAttempts: number;
  /** ブラウザのネットワークがオンラインかどうか */
  isOnline: boolean;
  /** 手動で即座に再接続を試みるトリガー関数 */
  manualReconnect: () => void;
}

/**
 * アプリケーション全体のWebSocket通信を管理するフック。
 *
 * @returns {UseSocketReturn}
 */
export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [connected, setConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  // 手動再接続関数
  const manualReconnect = useCallback(() => {
    if (socketRef.current) {
      console.log('[Socket] Manual reconnect triggered.');
      setIsReconnecting(true);
      socketRef.current.connect();
    }
  }, []);

  // ブラウザのネイティブ online / offline イベント監視
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Network] Browser is online.');
      setIsOnline(true);
      if (socketRef.current && !socketRef.current.connected) {
        socketRef.current.connect();
      }
    };

    const handleOffline = () => {
      console.warn('[Network] Browser went offline.');
      setIsOnline(false);
      setIsReconnecting(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Socket.IO クライアント接続
  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity, // 会場運用のため接続が戻るまで永続的に試行
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket] Connected, ID:', socket.id);
      setConnected(true);
      setIsReconnecting(false);
      setReconnectAttempts(0);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
      setConnected(false);
      // 意図的な切断以外は再接続待機状態へ遷移
      if (reason !== 'io client disconnect') {
        setIsReconnecting(true);
      }
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`[Socket] Reconnect attempt #${attempt}`);
      setIsReconnecting(true);
      setReconnectAttempts(attempt);
    });

    socket.io.on('reconnect', () => {
      console.log('[Socket] Successfully reconnected!');
      setConnected(true);
      setIsReconnecting(false);
      setReconnectAttempts(0);
    });

    socket.io.on('reconnect_error', (error) => {
      console.warn('[Socket] Reconnect attempt failed:', error.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    socket: socketRef.current,
    connected,
    isReconnecting,
    reconnectAttempts,
    isOnline,
    manualReconnect,
  };
}
