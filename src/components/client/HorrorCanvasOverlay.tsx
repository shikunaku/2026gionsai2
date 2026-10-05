'use client';

import React, { useEffect, useRef } from 'react';
import { GlitchEffectOptions } from '../../lib/types';

interface HorrorCanvasOverlayProps {
  glitchOptions: GlitchEffectOptions | null;
  screenFlashActive: boolean;
}

export const HorrorCanvasOverlay: React.FC<HorrorCanvasOverlayProps> = ({
  glitchOptions,
  screenFlashActive,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !glitchOptions) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const { level, mode } = glitchOptions;

    const renderNoise = () => {
      const w = (canvas.width = window.innerWidth);
      const h = (canvas.height = window.innerHeight);

      ctx.clearRect(0, 0, w, h);

      // Soft grain noise (gentle and low-contrast)
      const imgData = ctx.createImageData(w, h);
      const data = imgData.data;
      const count = Math.floor(w * h * 0.05 * level);

      for (let i = 0; i < count; i++) {
        const index = Math.floor(Math.random() * (w * h)) * 4;
        const color = mode === 'violent' ? 180 : 120;
        data[index] = color;
        data[index + 1] = color;
        data[index + 2] = color;
        data[index + 3] = Math.random() * 45 * level;
      }
      ctx.putImageData(imgData, 0, 0);

      animId = requestAnimationFrame(renderNoise);
    };

    renderNoise();

    return () => {
      cancelAnimationFrame(animId);
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [glitchOptions]);

  return (
    <>
      {/* Screen flash fallback */}
      {screenFlashActive && <div className="screen-flash-active" />}

      {/* Dynamic Noise Canvas */}
      {glitchOptions && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 9500,
          }}
        />
      )}
    </>
  );
};
