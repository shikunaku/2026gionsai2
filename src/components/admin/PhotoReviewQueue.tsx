'use client';

import React, { useState } from 'react';
import { PhotoSubmission } from '../../lib/types';
import '../../styles/admin.css';

interface PhotoReviewQueueProps {
  submissions: PhotoSubmission[];
  onReview: (submissionId: string, status: 'APPROVED' | 'REJECTED', reason?: string) => void;
  onClearSubmissions?: (deviceId?: string) => void;
}

export const PhotoReviewQueue: React.FC<PhotoReviewQueueProps> = ({
  submissions,
  onReview,
  onClearSubmissions,
}) => {
  const [selectedSubmission, setSelectedSubmission] = useState<PhotoSubmission | null>(null);

  const getStatusBadge = (sub: PhotoSubmission) => {
    switch (sub.status) {
      case 'PENDING':
        return <span className="review-badge pending">[審査待ち]</span>;
      case 'APPROVED':
        return <span className="review-badge approved">[合格済]</span>;
      case 'REJECTED':
        return <span className="review-badge rejected">[差戻し]</span>;
    }
  };

  return (
    <div className="win95-window admin-panel">
      <div className="win95-titlebar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>[点検写真レビュー] ({submissions.length}件)</span>
        {submissions.length > 0 && onClearSubmissions && (
          <button
            onClick={() => {
              if (window.confirm('点検写真のレビュー履歴をすべてクリアしますか？')) {
                onClearSubmissions();
              }
            }}
            className="win95-btn"
            style={{ fontSize: '10px', padding: '1px 6px', background: '#b71c1c', color: '#fff', border: '1px solid #7f0000' }}
          >
            全写真クリア
          </button>
        )}
      </div>

      <div className="review-body">
        {submissions.length === 0 ? (
          <div className="admin-empty">点検写真の提出待機中...</div>
        ) : (
          <div className="review-list">
            {submissions.map((sub) => {
              const isPending = sub.status === 'PENDING';
              return (
                <div
                  key={sub.id}
                  className={`win95-window review-card${isPending ? ' pending' : ''}`}
                >
                  <div className="review-card-row">
                    {/* Thumbnail */}
                    <div
                      onClick={() => setSelectedSubmission(sub)}
                      className="review-thumb"
                      title="クリックで拡大表示"
                    >
                      <img src={sub.imageBase64} alt="点検写真" />
                    </div>

                    {/* Metadata & Actions */}
                    <div className="review-meta">
                      <div>
                        <div className="review-meta-head">
                          <span className="review-meta-title">
                            [{sub.deviceId}] {sub.taskId === 10 ? '【④製造ライン】' : '【②品質管理室】'} Task #{sub.taskId}
                          </span>
                          <span className="review-meta-badge">{getStatusBadge(sub)}</span>
                        </div>
                        <div className="review-task-title">{sub.taskTitle}</div>
                        {sub.taskId === 10 && (
                          <div style={{ fontSize: '10px', color: '#ff5252', fontWeight: 'bold' }}>
                            ※ 合格承認と同時に「生首ギミック &amp; 悲鳴SE」が発火します
                          </div>
                        )}
                        <div className="review-time">
                          {new Date(sub.timestamp).toLocaleTimeString()}
                        </div>
                        {sub.reason && (
                          <div className="review-reason">差戻し: {sub.reason}</div>
                        )}
                      </div>

                      {/* Action buttons (non-wrapping single line) */}
                      {isPending && (
                        <div className="review-actions">
                          <button
                            onClick={() => onReview(sub.id, 'APPROVED')}
                            className="win95-btn review-btn ok"
                          >
                            合格 [OK]
                          </button>
                          <button
                            onClick={() => onReview(sub.id, 'REJECTED', '画像が不鮮明（ブレ・暗所）')}
                            className="win95-btn review-btn blur"
                          >
                            不鮮明
                          </button>
                          <button
                            onClick={() => onReview(sub.id, 'REJECTED', '指定された点検箇所と異なります')}
                            className="win95-btn review-btn wrong"
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
          className="review-modal-backdrop"
        >
          <div
            className="win95-window review-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="win95-titlebar">
              <span>写真プレビュー - 端末[{selectedSubmission.deviceId}] ({selectedSubmission.taskTitle})</span>
              <button
                onClick={() => setSelectedSubmission(null)}
                className="win95-btn review-modal-close"
              >
                [X]
              </button>
            </div>
            <div className="review-modal-body">
              <img src={selectedSubmission.imageBase64} alt="点検写真拡大" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
