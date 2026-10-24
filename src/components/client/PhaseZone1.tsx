'use client';

import React, { useState, useRef } from 'react';
import { InspectionTask, ReviewStatus } from '../../lib/types';
import '../../styles/client.css';

interface PhaseZone1Props {
  deviceId: string;
  tasks: InspectionTask[];
  onPhotoSubmit: (taskId: number, taskTitle: string, imageBase64: string) => void;
  onProceedZone2?: () => void;
  playShutterSound?: () => void;
  onPhotoTaken?: () => void;
}

export const PhaseZone1: React.FC<PhaseZone1Props> = ({
  deviceId,
  tasks,
  onPhotoSubmit,
  onProceedZone2,
  playShutterSound,
  onPhotoTaken,
}) => {
  const [selectedTaskId, setSelectedTaskId] = useState<number>(1);
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
      // 1. Read file as Image
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // 2. Resize via HTML5 Canvas (max dimension 800px)
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
            // 3. Compress to image/jpeg (quality: 0.7)
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

    // Reset input so user can re-take if needed
    e.target.value = '';
  };

  const getStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case 'SUBMITTING':
        return <span className="zone1-badge submitting">[送信中]</span>;
      case 'PENDING':
        return <span className="zone1-badge pending">[審査中]</span>;
      case 'APPROVED':
        return <span className="zone1-badge approved">[合格 済]</span>;
      case 'REJECTED':
        return <span className="zone1-badge rejected">[要再点検]</span>;
      default:
        return <span className="zone1-badge idle">[未実施]</span>;
    }
  };

  const allApproved = tasks.length > 0 && tasks.every((t) => t.status === 'APPROVED');
  const isCurrentApproved = currentTask.status === 'APPROVED';

  return (
    <div className="phase-zone1">
      {/* Task List Window */}
      <div className="win95-window">
        <div className="win95-titlebar zone1-titlebar">
          <span className="zone1-titlebar-text">[ZONE 1] 品質管理室 - 点検対象選択</span>
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

      {/* Selected Task Details & Immediate Camera Action (no excessive vertical stretch) */}
      <div className="win95-window zone1-detail-window">
        <div className="win95-titlebar zone1-titlebar zone1-titlebar-detail">
          <span className="zone1-titlebar-text">点検詳細: #{currentTask.id} {currentTask.title}</span>
        </div>
        <div className="zone1-detail-body">
          <div className="zone1-location">
            <strong>位置:</strong> {currentTask.location}
          </div>
          <div className="win95-inset zone1-description">{currentTask.targetDescription}</div>

          {/* Rejection alert banner */}
          {currentTask.status === 'REJECTED' && (
            <div className="zone1-reject-banner">
              [差戻し理由] {currentTask.rejectionReason || '不鮮明または指定箇所と異なります。再撮影してください。'}
            </div>
          )}

          {/* Hidden HTML5 camera file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="zone1-file-input"
            onChange={handleFileChange}
          />

          {/* Camera Button placed directly under description for easy thumb reach */}
          <button
            onClick={handleCaptureClick}
            disabled={isProcessing || isCurrentApproved}
            className={`win95-btn zone1-capture-btn${isCurrentApproved ? ' approved' : ''}`}
          >
            {isProcessing
              ? '画像圧縮・送信処理中...'
              : isCurrentApproved
                ? '点検完了 [合格確認済]'
                : currentTask.status === 'PENDING'
                  ? '再撮影して提出 [審査待ち上書き]'
                  : '写真を撮影して提出 [CAPTURE]'}
          </button>
        </div>
      </div>

      {/* When all tasks are approved, show Proceed button */}
      {allApproved && onProceedZone2 && (
        <div className="zone1-proceed">
          <button onClick={onProceedZone2} className="win95-btn zone1-proceed-btn">
            全点検合格: エリア3 エレベータ へ進む -&gt;
          </button>
        </div>
      )}
    </div>
  );
};
