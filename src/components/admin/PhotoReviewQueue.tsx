'use client';

import React, { useState } from 'react';
import { PhotoSubmission } from '../../lib/types';

interface PhotoReviewQueueProps {
  submissions: PhotoSubmission[];
  onReview: (submissionId: string, status: 'APPROVED' | 'REJECTED', reason?: string) => void;
}

export const PhotoReviewQueue: React.FC<PhotoReviewQueueProps> = ({
  submissions,
  onReview,
}) => {
  const [selectedSubmission, setSelectedSubmission] = useState<PhotoSubmission | null>(null);

  const getStatusBadge = (sub: PhotoSubmission) => {
    switch (sub.status) {
      case 'PENDING':
        return <span style={{ backgroundColor: '#e2d6be', color: '#574218', padding: '2px 6px', fontWeight: 'bold' }}>[審査待ち]</span>;
      case 'APPROVED':
        return <span style={{ backgroundColor: '#c7e0cf', color: '#1d4d2b', padding: '2px 6px', fontWeight: 'bold' }}>[合格 済]</span>;
      case 'REJECTED':
        return <span style={{ backgroundColor: '#e6c8c8', color: '#5e2424', padding: '2px 6px', fontWeight: 'bold' }}>[差戻し]</span>;
    }
  };

  return (
    <div className="win95-window" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="win95-titlebar">
        <span>[点検写真レビュー] Photo Review Queue ({submissions.length}件)</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {submissions.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#5f636c', fontSize: '11px' }}>
            点検写真の提出待機中...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {submissions.map((sub) => {
              const isPending = sub.status === 'PENDING';
              return (
                <div
                  key={sub.id}
                  className="win95-window"
                  style={{
                    backgroundColor: isPending ? '#e6e3dc' : '#dedbd4',
                    border: isPending ? '2px solid #3d5875' : undefined,
                    padding: '8px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {/* Thumbnail */}
                    <div
                      onClick={() => setSelectedSubmission(sub)}
                      style={{
                        width: '64px',
                        height: '64px',
                        backgroundColor: '#262930',
                        cursor: 'pointer',
                        flexShrink: 0,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #7a7974',
                      }}
                      title="クリックで拡大表示"
                    >
                      <img
                        src={sub.imageBase64}
                        alt="点検写真"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>

                    {/* Metadata & Actions */}
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '4px' }}>
                          <span style={{ fontWeight: 'bold', fontSize: '11px', color: '#25272b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            [{sub.deviceId}] Task #{sub.taskId}
                          </span>
                          <span style={{ fontSize: '10px', flexShrink: 0 }}>{getStatusBadge(sub)}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: '#3d4048', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {sub.taskTitle}
                        </div>
                        <div style={{ fontSize: '10px', color: '#6e727a' }}>
                          {new Date(sub.timestamp).toLocaleTimeString()}
                        </div>
                        {sub.reason && (
                          <div style={{ fontSize: '10px', color: '#8f3b3b' }}>
                            差戻し: {sub.reason}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      {isPending && (
                        <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => onReview(sub.id, 'APPROVED')}
                            className="win95-btn"
                            style={{
                              backgroundColor: '#38694a',
                              color: '#f0f5f1',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              padding: '4px 8px',
                              minHeight: '28px',
                            }}
                          >
                            合格 [OK]
                          </button>
                          <button
                            onClick={() => onReview(sub.id, 'REJECTED', '画像が不鮮明（ブレ・暗所）')}
                            className="win95-btn"
                            style={{
                              backgroundColor: '#7d5236',
                              color: '#fdf8f4',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              padding: '4px 8px',
                              minHeight: '28px',
                            }}
                          >
                            不鮮明
                          </button>
                          <button
                            onClick={() => onReview(sub.id, 'REJECTED', '指定された点検箇所と異なります')}
                            className="win95-btn"
                            style={{
                              backgroundColor: '#7d3838',
                              color: '#fdf4f4',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              padding: '4px 8px',
                              minHeight: '28px',
                            }}
                          >
                            箇所違い
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Enlarged Modal */}
      {selectedSubmission && (
        <div
          onClick={() => setSelectedSubmission(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(25, 28, 33, 0.75)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="win95-window"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="win95-titlebar">
              <span>写真プレビュー - 端末[{selectedSubmission.deviceId}] ({selectedSubmission.taskTitle})</span>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="win95-btn"
                style={{ padding: '0 6px', fontWeight: 'bold' }}
              >
                [X]
              </button>
            </div>
            <div style={{ padding: '10px', overflowY: 'auto', textAlign: 'center' }}>
              <img
                src={selectedSubmission.imageBase64}
                alt="点検写真拡大"
                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain', border: '1px solid #64635f' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
