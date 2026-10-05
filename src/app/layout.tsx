import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import '../styles/win95.css';
import '../styles/glitch.css';

export const metadata: Metadata = {
  title: '文化祭 工場点検ホラーアトラクション制御システム',
  description: 'Next.js + Socket.io リアルタイム統合演出・保守端末制御システム',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <main className="safe-area-container">{children}</main>
      </body>
    </html>
  );
}
