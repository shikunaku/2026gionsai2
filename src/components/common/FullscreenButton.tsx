'use client';

import React, { useState, useEffect } from 'react';

import { requestFullscreenSafe, exitFullscreenSafe, isFullscreenActive } from '../../lib/fullscreen';

interface FullscreenButtonProps {
  className?: string;
}

export const FullscreenButton: React.FC<FullscreenButtonProps> = ({ className = '' }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(isFullscreenActive());
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    if (!isFullscreenActive()) {
      await requestFullscreenSafe();
    } else {
      await exitFullscreenSafe();
    }
  };

  return (
    <button
      onClick={toggleFullscreen}
      className={`win95-btn ${className}`}
      title="全画面表示切替"
    >
      {isFullscreen ? '[通常表示]' : '[全画面]'}
    </button>
  );
};
