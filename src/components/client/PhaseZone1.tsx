'use client';

import React, { useState, useRef } from 'react';
import { InspectionTask, ReviewStatus } from '../../lib/types';

interface PhaseZone1Props {
  deviceId: string;
  tasks: InspectionTask[];
  onPhotoSubmit: (taskId: number, taskTitle: string, imageBase64: string) => void;
  onProceedZone2?: () => void;
  playShutterSound?: () => void;
}

export const PhaseZone1: React.FC<PhaseZone1Props> = ({
  deviceId,
  tasks,
  onPhotoSubmit,
  onProceedZone2,
  playShutterSound,
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

    // Reset input so user can re-take if needed
    e.target.value = '';
  };

  const getStatusBadge = (status: ReviewStatus) => {
    switch (status) {
      case 'SUBMITTING':
        return <span style={{ color: '#4a729e', fontWeight: 'bold', whiteSpace: 'nowrap' }}>[送信中]</span>;
      case 'PENDING':
        return <span style={{ color: '#a3823d', fontWeight: 'bold', whiteSpace: 'nowrap' }}>[審査中]</span>;
      case 'APPROVED':
        return <span style={{ color: '#3d7a52', fontWeight: 'bold', whiteSpace: 'nowrap' }}>[合格 済]</span>;
      case 'REJECTED':
        return <span style={{ color: '#a64d4d', fontWeight: 'bold', whiteSpace: 'nowrap' }}>[要再点検]</span>;
      default:
        return <span style={{ color: '#7a818c', whiteSpace: 'nowrap' }}>[未実施]</span>;
    }
  };

  const allApproved = tasks.length > 0 && tasks.every((t) => t.status === 'APPROVED');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: '10px 12px',
        backgroundColor: '#c7c4bd',
        color: '#27292e',
        boxSizing: 'border-box',
        overflowY: 'auto',
        gap: '8px',
      }}
    >
      {/* Task List Window */}
      <div className="win95-window" style={{ flexShrink: 0 }}>
        <div className="win95-titlebar" style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>[ZONE 1] 品質管理室 - 点検対象選択</span>
          <span style={{ fontSize: '11px', flexShrink: 0, marginLeft: '6px' }}>ID: {deviceId}</span>
        </div>
        <div style={{ padding: '6px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {tasks.map((task) => {
              const isSelected = task.id === selectedTaskId;
              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={`win95-btn ${isSelected ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    backgroundColor: isSelected ? '#d1cec7' : '#dedbd4',
                    border: isSelected ? '2px inset #ffffff' : undefined,
                    cursor: 'pointer',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: '11px',
                    }}
                  >
                    <span style={{ fontWeight: 'bold', marginRight: '4px' }}>#{task.id}</span>
                    <span>{task.title}</span>
                  </div>
                  <div style={{ fontSize: '11px', flexShrink: 0, marginLeft: '6px' }}>
                    {getStatusBadge(task.status)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Task Details & Immediate Camera Action (no excessive vertical stretch) */}
      <div
        className="win95-window"
        style={{
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="win95-titlebar" style={{ background: 'linear-gradient(90deg, #2b3e54, #3d5875)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>点検詳細: #{currentTask.id} {currentTask.title}</span>
        </div>
        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '11px', color: '#2d3036', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            <strong>位置:</strong> {currentTask.location}
          </div>
          <div
            className="win95-inset"
            style={{
              padding: '6px 8px',
              fontSize: '11px',
              lineHeight: 1.4,
              backgroundColor: '#eae8e1',
            }}
          >
            {currentTask.targetDescription}
          </div>

          {/* Rejection alert banner */}
          {currentTask.status === 'REJECTED' && (
            <div
              style={{
                backgroundColor: '#382828',
                border: '1px solid #7a4444',
                color: '#dca3a3',
                padding: '6px 8px',
                fontSize: '11px',
                lineHeight: 1.3,
                fontWeight: 'bold',
              }}
            >
              [差戻し理由] {currentTask.rejectionReason || '不鮮明または指定箇所と異なります。再撮影してください。'}
            </div>
          )}

          {/* Hidden HTML5 camera file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Camera Button placed directly under description for easy thumb reach */}
          <button
            onClick={handleCaptureClick}
            disabled={isProcessing || currentTask.status === 'APPROVED'}
            className="win95-btn"
            style={{
              width: '100%',
              height: '44px',
              fontSize: '13px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
              backgroundColor: currentTask.status === 'APPROVED' ? '#c7c4bd' : '#38577a',
              color: currentTask.status === 'APPROVED' ? '#7d8085' : '#f0f3f8',
              marginTop: '2px',
            }}
          >
            {isProcessing
              ? '画像圧縮・送信処理中...'
              : currentTask.status === 'APPROVED'
              ? '点検完了 [合格確認済]'
              : currentTask.status === 'PENDING'
              ? '再撮影して提出 [審査待ち上書き]'
              : '写真を撮影して提出 [CAPTURE]'}
          </button>
        </div>
      </div>

      {/* When all tasks are approved, show Proceed button */}
      {allApproved && onProceedZone2 && (
        <div style={{ flexShrink: 0, marginTop: '2px' }}>
          <button
            onClick={onProceedZone2}
            className="win95-btn"
            style={{
              width: '100%',
              height: '42px',
              backgroundColor: '#366645',
              color: '#eff8f2',
              fontSize: '12px',
              fontWeight: 'bold',
              whiteSpace: 'nowrap',
            }}
          >
            全点検合格: ZONE 2 (第零製造ライン) へ進む -&gt;
          </button>
        </div>
      )}
    </div>
  );
};
