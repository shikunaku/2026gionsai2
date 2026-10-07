'use client';

import React, { useState } from 'react';
import '../../styles/admin.css';

interface CastManualViewerProps {
  pdfUrl?: string;
}

export const CastManualViewer: React.FC<CastManualViewerProps> = ({
  pdfUrl = '/cast-manual.pdf',
}) => {
  const [loadError, setLoadError] = useState(false);

  return (
    <div className="win95-window admin-panel">
      <div className="win95-titlebar manual-titlebar">
        <span>[運営資料] キャスト運用マニュアル (PDF)</span>
        <div className="manual-title-actions">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="manual-link"
          >
            <button className="win95-btn manual-open-btn" title="別タブで開く">
              [別窓]
            </button>
          </a>
        </div>
      </div>

      <div className="manual-body">
        <div className="win95-inset-dark manual-viewport">
          {!loadError ? (
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0`}
              className="manual-iframe"
              title="キャスト運用マニュアル"
              onError={() => setLoadError(true)}
            />
          ) : (
            <div className="manual-error">
              PDFビューアの表示に失敗しました。
              <div className="manual-error-link-row">
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  マニュアルを直接開く
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="manual-footer">
          <span>緊急時: [EMERGENCY LIGHT] 押下で全点灯</span>
          <a href={pdfUrl} download="cast-manual.pdf">
            PDFダウンロード
          </a>
        </div>
      </div>
    </div>
  );
};
