'use client';

import React, { useState, useRef } from 'react';
import { InspectionTask, ReviewStatus } from '../../lib/types';
import '../../styles/client.css';

interface PhaseQualityControlProps {
  deviceId: string;
  tasks: InspectionTask[];
  arrived: boolean;
  onArrive: () => void;
  onPhotoSubmit: (taskId: number, taskTitle: string, imageBase64: string) => void;
  onProceedElevator: () => void;
  playShutterSound?: () => void;
  onPhotoTaken?: () => void;
}

export const PhaseQualityControl: React.FC<PhaseQualityControlProps> = ({
  deviceId,
  tasks,
  arrived,
  onArrive,
  onPhotoSubmit,
  onProceedElevator,
  playShutterSound,
  onPhotoTaken,
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<number>(tasks[0]?.id || 1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const currentTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0];

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
            onPhotoSubmit(currentTask.id, currentTask.title, compressedBase64);
            if (onPhotoTaken) onPhotoTaken();
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

    if (onPhotoTaken) onPhotoTaken();
    e.target.value = '';
  };

  const getStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case 'UNINSPECTED':
        return <span className="zone1-badge idle">[未撮影]</span>;
      case 'SUBMITTING':
        return <span className="zone1-badge submitting">[送信中]</span>;
      case 'PENDING':
        return <span className="zone1-badge pending">[審査待ち]</span>;
      case 'APPROVED':
        return <span className="zone1-badge approved">[承認 合格]</span>;
      case 'REJECTED':
        return <span className="zone1-badge rejected">[要再撮影]</span>;
      default:
        return <span className="zone1-badge idle">[未撮影]</span>;
    }
  };

  const allApproved = tasks.length > 0 && tasks.every((t) => t.status === 'APPROVED');
  const isCurrentApproved = currentTask.status === 'APPROVED';

  // 到着前の状態：到着ボタンを表示
  if (!arrived) {
    return (
      <div className="phase-container">
        <div className="win95-window">
          <div
            className="win95-titlebar"
            style={{ background: 'linear-gradient(90deg, #000080, #1084d0)' }}
          >
            <span>エリア1: 品質管理室 (移動中)</span>
            <span className="phase-init-title-tag">ID: {deviceId}</span>
          </div>
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <div
              style={{
                fontSize: '17px',
                fontWeight: 'bold',
                color: '#0d47a1',
                lineHeight: '1.6',
                marginBottom: '12px',
              }}
            >
              1F エリア1「品質管理室」へ向かってください。
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
              通路を進み、1F「品質管理室」に入室したら下の【到着した】ボタンを押して点検を開始してください。
            </div>

            <button
              onClick={onArrive}
              className="win95-btn btn-natural-wrap break-keep leading-snug"
              style={{
                width: '100%',
                padding: '16px 12px',
                fontSize: '16px',
                fontWeight: 'bold',
                backgroundColor: '#1b5e20',
                color: '#ffffff',
                boxShadow: '0 0 12px rgba(27, 94, 32, 0.4)',
              }}
            >
              <span className="inline-block">エリア1（品質管理室）に到着した</span>{' '}
              <span className="inline-block">[点検開始]</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 到着後の撮影ミッション
  return (
    <div className="phase-zone1 phase-container">
      {/* Task List Window */}
      <div className="win95-window">
        <div className="win95-titlebar zone1-titlebar">
          <span className="zone1-titlebar-text">第②フェーズ: 品質管理室 - 指定資料撮影点検</span>
          <span className="zone1-titlebar-tag">ID: {deviceId}</span>
        </div>
        <div className="zone1-task-list-body">
          <div className="zone1-task-list">
            {tasks.map((task) => {
              const isSelected = task.id === selectedTaskId;
              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`win95-btn zone1-task-item${isSelected ? ' active selected' : ''}`}
                >
                  <div className="zone1-task-label">
                    <span className="zone1-task-id">#{task.id}</span>
                    <span>{task.title}</span>
                  </div>
                  <div className="zone1-task-status">{getStatusBadge(task.status)}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Task Details & Immediate Camera Action */}
      <div className="win95-window zone1-detail-window">
        <div className="win95-titlebar zone1-titlebar zone1-titlebar-detail">
          <span className="zone1-titlebar-text">
            資料撮影: #{currentTask.id} {currentTask.title}
          </span>
        </div>
        <div className="zone1-detail-body">
          <div className="zone1-location">
            <strong>場所:</strong> {currentTask.location}
          </div>
          <div className="win95-inset zone1-description">{currentTask.targetDescription}</div>

          {currentTask.status === 'REJECTED' && (
            <div className="zone1-reject-banner">
              [差戻し理由] {currentTask.rejectionReason || '不鮮明または指定資料と異なります。再撮影してください。'}
            </div>
          )}

          {currentTask.status === 'PENDING' && (
            <div
              style={{
                padding: '8px',
                fontSize: '11px',
                backgroundColor: '#fff9c4',
                color: '#f57f17',
                border: '1px solid #fbc02d',
                marginBottom: '8px',
                textAlign: 'center',
                fontWeight: 'bold',
              }}
            >
              スタッフが管理画面で写真を確認・審査中です。お待ちください...
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="zone1-file-input"
            onChange={handleFileChange}
          />

          <button
            onClick={handleCaptureClick}
            disabled={isProcessing || isCurrentApproved}
            className={`win95-btn zone1-capture-btn btn-natural-wrap break-keep leading-snug${isCurrentApproved ? ' approved' : ''}`}
          >
            {isProcessing ? (
              '写真圧縮・管理卓へ即時送信中...'
            ) : isCurrentApproved ? (
              <span className="inline-block">点検完了 [スタッフ承認済]</span>
            ) : currentTask.status === 'PENDING' ? (
              <>
                <span className="inline-block">再撮影して再提出</span>{' '}
                <span className="inline-block">[審査待ち上書き]</span>
              </>
            ) : (
              <>
                <span className="inline-block">指定資料を撮影して送信</span>{' '}
                <span className="inline-block">[CAMERA CAPTURE]</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 全点検承認後：エレベーターへの移動指示表示 */}
      {allApproved && (
        <div className="win95-window" style={{ border: '2px solid #2e7d32', backgroundColor: '#e8f5e9' }}>
          <div className="win95-titlebar" style={{ background: '#2e7d32', color: '#fff' }}>
            <span>[点検完了] エレベーターへの移動指示</span>
          </div>
          <div style={{ padding: '14px', textAlign: 'center' }}>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#1b5e20',
                lineHeight: '1.6',
                marginBottom: '10px',
              }}
            >
              品質管理室の全点検が承認されました。
              <br />
              地下へ向かうため、エレベーターへ移動してください。
            </div>
            <button
              onClick={onProceedElevator}
              className="win95-btn btn-natural-wrap break-keep leading-snug"
              style={{
                width: '100%',
                padding: '14px 12px',
                fontSize: '15px',
                fontWeight: 'bold',
                backgroundColor: '#1b5e20',
                color: '#ffffff',
                boxShadow: '0 0 10px rgba(27, 94, 32, 0.4)',
              }}
            >
              <span className="inline-block">エレベーターへ向かう</span>{' '}
              <span className="inline-block">-&gt;</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
