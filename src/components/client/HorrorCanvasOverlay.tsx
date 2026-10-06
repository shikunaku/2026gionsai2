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
      const density = mode === 'static' ? 0.15 : 0.05;
      const count = Math.floor(w * h * density * level);

      for (let i = 0; i < count; i++) {
        const index = Math.floor(Math.random() * (w * h)) * 4;
        let r = 120;
        let g = 120;
        let b = 120;

        if (mode === 'violent') {
          r = 200; g = 140; b = 180;
        } else if (mode === 'redout') {
          r = 220; g = 30; b = 30;
        } else if (mode === 'invert') {
          r = 240; g = 240; b = 240;
        } else if (mode === 'static') {
          const val = Math.random() > 0.5 ? 230 : 20;
          r = val; g = val; b = val;
        }

        data[index] = r;
        data[index + 1] = g;
        data[index + 2] = b;
        data[index + 3] = mode === 'static' ? Math.random() * 80 * level : Math.random() * 45 * level;
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
