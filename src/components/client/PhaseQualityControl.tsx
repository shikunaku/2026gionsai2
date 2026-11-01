'use client';

import React, { useState, useRef } from 'react';
import { InspectionTask, ReviewStatus } from '../../lib/types';
import { compressPhotoToJpeg } from '../../lib/photoCompression';
import '../../styles/client.css';

interface PhaseQualityControlProps {
  deviceId: string;
  tasks: InspectionTask[];
  arrived: boolean;
  onArrive: () => void;
  onPhotoSubmit: (taskId: number, taskTitle: string, image: Blob) => Promise<void>;
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
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allApproved = tasks.length > 0 && tasks.every((task) => task.status === 'APPROVED');
  const firstIncompleteIndex = tasks.findIndex((task) => task.status !== 'APPROVED');
  const activeTaskIndex = firstIncompleteIndex >= 0 ? firstIncompleteIndex : tasks.length - 1;
  const currentTask = tasks[activeTaskIndex] || tasks[0];
  const progressNumber = allApproved ? tasks.length : activeTaskIndex + 1;

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
      const compressedImage = await compressPhotoToJpeg(file);
      onPhotoTaken?.();
      await onPhotoSubmit(currentTask.id, currentTask.title, compressedImage);
    } catch (err) {
      console.error('Photo processing error:', err);
      window.alert(err instanceof Error ? err.message : '写真を送信できませんでした。もう一度お試しください。');
    } finally {
      setIsProcessing(false);
      e.target.value = '';
    }
  };

  const getTaskbarStatus = (status: ReviewStatus, index: number) => {
    if (status === 'APPROVED') {
      return { label: '完了', className: 'complete' };
    }

    if (index !== activeTaskIndex) {
      return { label: '待機', className: 'waiting' };
    }

    switch (status) {
      case 'SUBMITTING':
        return { label: '送信中', className: 'reviewing' };
      case 'PENDING':
        return { label: '確認中', className: 'reviewing' };
      case 'REJECTED':
        return { label: '要再撮影', className: 'rejected' };
      default:
        return { label: '現在', className: 'current' };
    }
  };

  // 到着前の状態：到着ボタンを表示
  if (!arrived) {
    return (
      <div className="phase-container">
        <div className="win95-window">
          <div
            className="win95-titlebar"
            style={{ background: '#1f4f7a' }}
          >
            <span>品質管理室へ移動</span>
            <span className="phase-init-title-tag">端末 {deviceId}</span>
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
              1F 品質管理室へ向かってください。
            </div>
            <div
              className="win95-inset"
              style={{
                padding: '12px',
                fontSize: '14px',
                color: '#333',
                lineHeight: '1.6',
                marginBottom: '20px',
                textAlign: 'left',
              }}
            >
              品質管理室に入ったら、下のボタンを押してください。
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
              <span className="inline-block">品質管理室に到着した</span>{' '}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 到着後の撮影ミッション
  return (
    <div className="phase-zone1 phase-container">
      {/* Automatic task progress bar */}
      <div className="win95-window">
        <div className="win95-titlebar zone1-titlebar">
          <span className="zone1-titlebar-text">品質管理室 - 資料を撮影</span>
          <span className="zone1-titlebar-tag">端末 {deviceId}</span>
        </div>
        <div className="zone1-task-progress-body">
          <div className="zone1-task-progress-heading">
            点検進行 {progressNumber} / {tasks.length}
          </div>
          <div className="zone1-task-progress" role="list" aria-label="撮影タスクの進行状況">
            {tasks.map((task, index) => {
              const status = getTaskbarStatus(task.status, index);
              const isCurrent = !allApproved && index === activeTaskIndex;
              return (
                <div
                  key={task.id}
                  role="listitem"
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`zone1-progress-item ${status.className}`}
                >
                  <span className="zone1-progress-task">TASK {String(index + 1).padStart(2, '0')}</span>
                  <span className="zone1-progress-status">{status.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Task Details & Immediate Camera Action */}
      {!allApproved && (
        <div className="win95-window zone1-detail-window">
          <div className="win95-titlebar zone1-titlebar zone1-titlebar-detail">
            <span className="zone1-titlebar-text">現在の撮影タスク</span>
          </div>
          <div className="zone1-detail-body">
            <div className="zone1-target-card">
              <div className="zone1-target-label">撮影するもの</div>
              <div className="zone1-target-value">{currentTask.title}</div>
              <div className="client-camera-target-guide">
                下の「カメラを開いて撮影する」ボタンを押してください。撮影した写真は自動でスタッフへ送られます。
              </div>
            </div>
            <div className="zone1-location">
              <strong>撮影場所:</strong> {currentTask.location}
            </div>
            <div className="win95-inset zone1-description">{currentTask.targetDescription}</div>

            {currentTask.status === 'REJECTED' && (
              <div className="zone1-reject-banner">
                [撮り直してください] {currentTask.rejectionReason || '写真が不鮮明か、指定された資料と異なります。'}
              </div>
            )}

            {currentTask.status === 'PENDING' && (
              <div
                style={{
                  padding: '8px',
                  fontSize: '13px',
                  backgroundColor: '#fff9c4',
                  color: '#f57f17',
                  border: '1px solid #fbc02d',
                  marginBottom: '8px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                }}
              >
                スタッフが写真を確認しています。そのままお待ちください。
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
              disabled={isProcessing}
              className="win95-btn zone1-capture-btn btn-natural-wrap break-keep leading-snug"
            >
              {isProcessing ? (
                '写真を送信しています...'
              ) : currentTask.status === 'PENDING' ? (
                <span className="inline-block">カメラを開いて撮り直す</span>
              ) : (
                <span className="inline-block">カメラを開いて撮影する</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 全点検承認後：エレベーターへの移動指示表示 */}
      {allApproved && (
        <div className="win95-window" style={{ border: '2px solid #2e7d32', backgroundColor: '#e8f5e9' }}>
          <div className="win95-titlebar" style={{ background: '#2e7d32', color: '#fff' }}>
            <span>品質管理室の点検完了</span>
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
              すべての写真を確認しました。
              <br />
              エレベーターへ向かってください。
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
