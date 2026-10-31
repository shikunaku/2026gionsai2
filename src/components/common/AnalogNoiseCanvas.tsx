'use client';

import React, { useEffect, useRef } from 'react';

interface AnalogNoiseCanvasProps {
  className: string;
  fps?: number;
  resolutionScale?: number;
}

/** CPU負荷を抑えた共通アナログ砂嵐Canvas。 */
export const AnalogNoiseCanvas: React.FC<AnalogNoiseCanvasProps> = ({
  className,
  fps = 15,
  resolutionScale = 0.5,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let animationFrame = 0;
    let lastFrameAt = 0;
    let imageData: ImageData | null = null;
    let buffer: Uint32Array | null = null;
    const frameInterval = 1000 / fps;

    const resizeBuffer = () => {
      const width = Math.max(1, Math.floor(canvas.clientWidth * resolutionScale));
      const height = Math.max(1, Math.floor(canvas.clientHeight * resolutionScale));
      if (canvas.width === width && canvas.height === height && imageData && buffer) return;

      canvas.width = width;
      canvas.height = height;
      imageData = ctx.createImageData(width, height);
      buffer = new Uint32Array(imageData.data.buffer);
    };

    const render = (timestamp: number) => {
      animationFrame = requestAnimationFrame(render);
      if (document.hidden || timestamp - lastFrameAt < frameInterval) return;
      lastFrameAt = timestamp;

      resizeBuffer();
      if (!imageData || !buffer) return;

      for (let index = 0; index < buffer.length; index++) {
        const shade = Math.floor(Math.random() * 256);
        buffer[index] = (255 << 24) | (shade << 16) | (shade << 8) | shade;
      }
      ctx.putImageData(imageData, 0, 0);
    };

    const resizeObserver = new ResizeObserver(resizeBuffer);
    resizeObserver.observe(canvas);
    resizeBuffer();
    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
    };
  }, [fps, resolutionScale]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};
