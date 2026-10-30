'use client';

import React, { useState, useRef } from 'react';
import '../../styles/client.css';

interface PhaseManufacturingLineProps {
  deviceId: string;
  arrived: boolean;
  onArrive: () => void;
  onConveyorStart: () => void;
  onPhotoSubmit: (taskId: number, taskTitle: string, imageBase64: string) => void;
  onProceedMonitorRoom: () => void;
  photoApproved: boolean;
  photoStatus?: 'UNINSPECTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  playShutterSound?: () => void;
}

export const PhaseManufacturingLine: React.FC<PhaseManufacturingLineProps> = ({
  deviceId,
  arrived,
  onArrive,
  onConveyorStart,
  onPhotoSubmit,
  onProceedMonitorRoom,
  photoApproved,
  photoStatus = 'UNINSPECTED',
  playShutterSound,
}) => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleCaptureClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    if (playShutterSound) playShutterSound();

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxDim = 800;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            onPhotoSubmit(10, 'ベルトコンベア稼働部および搬送パレット', compressedBase64);
          }
          setIsProcessing(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Photo processing error:', err);
      setIsProcessing(false);
    }

    e.target.value = '';
  };

  // 1. 到着前: 到着ボタン画面
  if (!arrived) {
    return (
      <div className="phase-container">
        <div className="win95-window">
          <div
            className="win95-titlebar"
            style={{ background: 'linear-gradient(90deg, #1b5e20, #2e7d32)' }}
          >
            <span>第零製造ライン (移動中)</span>
            <span className="phase-init-title-tag">ID: {deviceId}</span>
          </div>
          <div style={{ padding: '18px 16px', textAlign: 'center' }}>
            <div
              style={{
                fontSize: '17px',
                fontWeight: 'bold',
                color: '#1b5e20',
                lineHeight: '1.6',
                marginBottom: '12px',
              }}
            >
              地下にある第零製造ラインへ移動してください。
            </div>
            <div
              className="win95-inset"
              style={{
                padding: '12px',
                fontSize: '12px',
                color: '#333',
                lineHeight: '1.6',
                marginBottom: '20px',
                textAlign: 'left',
              }}
            >
              エレベーターを出て直進し、B1F「第零製造ライン」に到着したら下の【到着】ボタンを押してください。ベルトコンベアギミックが自動起動します。
            </div>

            <button
              onClick={onArrive}
              className="win95-btn"
              style={{
                width: '100%',
                padding: '16px',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: '#1b5e20',
                color: '#ffffff',
                boxShadow: '0 0 14px rgba(27, 94, 32, 0.4)',
              }}
            >
              製造ラインに到着した [ギミック起動]
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. 到着後: ベルトコンベア撮影指示 & 写真送信 & ジャンプスケアパニック後のモニター室移動指示
  return (
    <div className="phase-container">
      {/* Title */}
      <div className="win95-window">
        <div
          className="win95-titlebar"
          style={{ background: 'linear-gradient(90deg, #1b5e20, #2e7d32)' }}
        >
          <span>第零製造ライン - ベルトコンベア点検</span>
          <span className="phase-init-title-tag">ID: {deviceId}</span>
        </div>
        <div style={{ padding: '8px', fontSize: '11px', color: '#27292e' }}>
          稼働中のベルトコンベア周辺の安全を確認し、指定箇所を撮影して本部へ送信してください。
        </div>
      </div>

      {/* Task & Camera Capture Box */}
      <div className="win95-window">
        <div
          className="win95-titlebar"
          style={{
            background: photoApproved ? '#b71c1c' : '#2e7d32',
            color: '#fff',
          }}
        >
          <span>{photoApproved ? '[緊急警告] 現場異常発生' : '[点検対象] ベルトコンベア撮影'}</span>
          <span>
            {photoApproved
              ? '[承認済 - パニック]'
              : photoStatus === 'PENDING'
              ? '[管理PC審査中]'
              : '[撮影指示]'}
          </span>
        </div>

        <div style={{ padding: '16px' }}>
          {!photoApproved ? (
            <div>
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>
                点検対象: ベルトコンベア全体像
              </div>
              <div
                className="win95-inset"
                style={{
                  padding: '10px',
                  fontSize: '11px',
                  color: '#444',
                  lineHeight: '1.6',
                  marginBottom: '12px',
                }}
              >
                自動起動したコンベアの搬送面をカメラで撮影し、異物の混入や部品の欠落がないか記録してください。
              </div>

              {photoStatus === 'PENDING' && (
                <div
                  style={{
                    padding: '8px',
                    fontSize: '12px',
                    backgroundColor: '#fff9c4',
                    color: '#f57f17',
                    border: '1px solid #fbc02d',
                    marginBottom: '10px',
                    textAlign: 'center',
                    fontWeight: 'bold',
                  }}
                >
                  写真を本部へ送信しました。確認・承認までその場でお待ちください...
                </div>
              )}

              {photoStatus === 'REJECTED' && (
                <div
                  style={{
                    padding: '8px',
                    fontSize: '11px',
                    backgroundColor: '#ffebee',
                    color: '#c62828',
                    border: '1px solid #ef9a9a',
                    marginBottom: '10px',
                    textAlign: 'center',
                  }}
                >
                  写真が差戻されました。再度鮮明に撮影してください。
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="zone1-file-input"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              <button
                onClick={handleCaptureClick}
                disabled={isProcessing}
                className="win95-btn btn-natural-wrap break-keep leading-snug"
                style={{
                  width: '100%',
                  padding: '16px 12px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  backgroundColor: '#1565c0',
                  color: '#ffffff',
                  boxShadow: '0 0 10px rgba(21, 101, 192, 0.4)',
                }}
              >
                {isProcessing ? (
                  '写真送信処理中...'
                ) : photoStatus === 'PENDING' ? (
                  <>
                    <span className="inline-block">再撮影して再送信</span>{' '}
                    <span className="inline-block">[上書き]</span>
                  </>
                ) : (
                  <>
                    <span className="inline-block">ベルトコンベアを撮影して送信</span>{' '}
                  </>
                )}
              </button>
            </div>
          ) : (
            /* 写真承認と同時にジャンプスケア演出発生後のパニック指示 */
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: '900',
                  color: '#d50000',
                  marginBottom: '10px',
                  lineHeight: '1.4',
                  animation: 'pulse 0.8s infinite alternate',
                }}
              >
                生首ギミック作動！
                <br />
                直ちに逃げてください！
              </div>

              <div
                className="win95-inset-dark"
                style={{
                  padding: '12px',
                  fontSize: '12px',
                  color: '#ff8a80',
                  backgroundColor: '#1a0000',
                  border: '1px solid #d50000',
                  lineHeight: '1.8',
                  marginBottom: '16px',
                  textAlign: 'left',
                }}
              >
                <div>[CRITICAL] コンベア奥より怪異生首ギミックが突如作動</div>
                <div>[ALARM] 悲鳴・警告音響を全スピーカーより出力中</div>
                <div>[ORDER] その場を離れ、「モニター室」へ即座に移動せよ！</div>
              </div>

              <button
                onClick={onProceedMonitorRoom}
                className="win95-btn btn-natural-wrap break-keep leading-snug"
                style={{
                  width: '100%',
                  padding: '16px 12px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  backgroundColor: '#d50000',
                  color: '#ffffff',
                  border: '2px solid #ffffff',
                  boxShadow: '0 0 16px rgba(213, 0, 0, 0.7)',
                }}
              >
                <span className="inline-block">モニター室へ逃げる -&gt;</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
