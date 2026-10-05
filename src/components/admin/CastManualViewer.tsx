'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface CastManualViewerProps {
  pdfUrl?: string;
}

export const CastManualViewer: React.FC<CastManualViewerProps> = ({
  pdfUrl = '/cast-manual.pdf',
}) => {
  const [loadError, setLoadError] = useState(false);

  return (
    <div className="win95-window" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="win95-titlebar" style={{ background: 'linear-gradient(90deg, #2b463c, #3d6355)' }}>
        <span>[運営資料] キャスト運用マニュアル (PDF)</span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <button
              className="win95-btn"
              style={{ padding: '1px 6px', fontSize: '10px', minHeight: '22px', color: '#1f2228' }}
              title="別タブで開く"
            >
              [別窓]
            </button>
          </a>
        </div>
      </div>

      <div style={{ flex: 1, padding: '4px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          className="win95-inset-dark"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {!loadError ? (
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0`}
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                backgroundColor: '#ffffff',
              }}
              title="キャスト運用マニュアル"
              onError={() => setLoadError(true)}
            />
          ) : (
            <div style={{ padding: '16px', color: '#e8a87c', textAlign: 'center', fontSize: '11px' }}>
              PDFビューアの表示に失敗しました。
              <div style={{ marginTop: '8px' }}>
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#9cb885' }}>
                  マニュアルを直接開く
                </a>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            fontSize: '10px',
            color: '#4e5259',
            padding: '3px 4px 0 4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>緊急時: [EMERGENCY LIGHT] 押下で全点灯</span>
          <a
            href={pdfUrl}
            download="cast-manual.pdf"
            style={{ color: '#2b463c', textDecoration: 'underline', fontSize: '10px' }}
          >
            PDFダウンロード
          </a>
        </div>
      </div>
    </div>
  );
};
