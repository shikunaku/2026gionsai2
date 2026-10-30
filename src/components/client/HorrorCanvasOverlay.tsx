'use client';

import React, { useEffect, useRef } from 'react';
import { GlitchEffectOptions } from '../../lib/types';
import '../../styles/client.css';

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
    let frameCount = 0;
    const { level = 1, mode = 'creepy' } = glitchOptions;

    // 演出バリエーションを支える恐怖のサブリミナルテキスト・記号群
    const creepyWords = [
      '逃ゲラレナイ',
      '見テルゾ',
      'ウシロ',
      'ココニイル',
      'ミツカッタ',
      'コロシテ',
      '助ケテ',
      'ERROR 666',
      'FATAL_ORGAN_FAILURE',
      'SUBJECT_TERMINATED',
      'DONT_LOOK_BACK',
      '01001000 01000101 01001100 01010000',
      'SYSTEM CORRUPTED',
      '呼吸ヲ止メロ',
      '開ケテ',
    ];

    // 血滴・インダストリアル傷のランダム配置
    const scratches = Array.from({ length: 6 }).map(() => ({
      x1: Math.random(),
      y1: Math.random(),
      x2: Math.random(),
      y2: Math.random(),
      alpha: Math.random() * 0.35 + 0.1,
    }));

    const render = () => {
      frameCount++;
      const w = window.innerWidth || canvas.clientWidth || 360;
      const h = window.innerHeight || canvas.clientHeight || 640;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);

      // ----------------------------------------------------------------------
      // 1. 周辺減光（Vignette）と不気味なトーンマッピング
      // ----------------------------------------------------------------------
      const vignetteGrad = ctx.createRadialGradient(
        w / 2, h / 2, Math.min(w, h) * (mode === 'stalker' ? 0.08 : 0.22),
        w / 2, h / 2, Math.max(w, h) * (mode === 'stalker' ? 0.65 : 0.78)
      );

      if (mode === 'redout' || mode === 'heartbeat') {
        vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignetteGrad.addColorStop(0.55, 'rgba(140, 5, 5, 0.45)');
        vignetteGrad.addColorStop(1, 'rgba(40, 0, 0, 0.98)');
      } else if (mode === 'nightmare') {
        vignetteGrad.addColorStop(0, 'rgba(15, 0, 20, 0.05)');
        vignetteGrad.addColorStop(0.65, 'rgba(100, 0, 30, 0.6)');
        vignetteGrad.addColorStop(1, 'rgba(5, 0, 5, 0.98)');
      } else if (mode === 'stalker') {
        const pulse = Math.sin(frameCount * 0.08) * 0.12;
        vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0.15)');
        vignetteGrad.addColorStop(0.5, `rgba(0, 0, 0, ${0.78 + pulse})`);
        vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.99)');
      } else if (mode === 'corruption') {
        vignetteGrad.addColorStop(0, 'rgba(0, 20, 20, 0)');
        vignetteGrad.addColorStop(0.7, 'rgba(25, 0, 50, 0.55)');
        vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.96)');
      } else {
        vignetteGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        vignetteGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0.45)');
        vignetteGrad.addColorStop(1, 'rgba(0, 0, 0, 0.92)');
      }
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, w, h);

      // ----------------------------------------------------------------------
      // 2. リアルなフィルム傷・ひび割れ（Gritty Film Scratches）
      // ----------------------------------------------------------------------
      ctx.lineWidth = 1;
      scratches.forEach((s) => {
        if (Math.random() < 0.6) {
          ctx.strokeStyle = `rgba(255, 255, 255, ${s.alpha})`;
          ctx.beginPath();
          ctx.moveTo(s.x1 * w, s.y1 * h);
          ctx.lineTo(s.x2 * w, s.y2 * h);
          ctx.stroke();
        }
      });

      // ----------------------------------------------------------------------
      // 3. アナログVHS走査線・微細インターレース (CRT Scanlines)
      // ----------------------------------------------------------------------
      ctx.fillStyle = mode === 'nightmare' || mode === 'heartbeat'
        ? 'rgba(255, 0, 0, 0.08)'
        : mode === 'corruption'
        ? 'rgba(0, 255, 200, 0.06)'
        : 'rgba(0, 0, 0, 0.22)';
      const step = mode === 'signalLoss' ? 6 : 4;
      for (let y = (frameCount % 4); y < h; y += step) {
        ctx.fillRect(0, y, w, 1.5);
      }

      // ----------------------------------------------------------------------
      // 4. データ崩壊ブロック＆水平引き裂き (Corruption Blocks / Tearing)
      // ----------------------------------------------------------------------
      if (mode === 'corruption') {
        const blockCount = Math.floor(Math.random() * 6 * level) + 2;
        for (let b = 0; b < blockCount; b++) {
          const bx = Math.random() * w;
          const by = Math.random() * h;
          const bw = Math.random() * 80 + 15;
          const bh = Math.random() * 20 + 8;
          ctx.fillStyle = Math.random() > 0.5
            ? `rgba(0, 255, 180, ${Math.random() * 0.6})`
            : `rgba(255, 0, 80, ${Math.random() * 0.6})`;
          ctx.fillRect(bx, by, bw, bh);

          ctx.fillStyle = '#ffffff';
          ctx.font = '11px monospace';
          ctx.fillText('0x' + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase(), bx + 3, by + 12);
        }
      } else {
        // 水平テアリング・色収差スライス
        const tearCount = Math.floor(Math.random() * 3 * level) + 1;
        for (let t = 0; t < tearCount; t++) {
          if (Math.random() < 0.5) {
            const tearY = Math.random() * h;
            const tearH = Math.random() * 20 * level + 4;
            const shiftX = (Math.random() * 30 - 15) * level;

            ctx.fillStyle = mode === 'redout' || mode === 'heartbeat'
              ? `rgba(200, 20, 20, ${Math.random() * 0.3 + 0.1})`
              : `rgba(255, 255, 255, ${Math.random() * 0.25 + 0.08})`;
            ctx.fillRect(0, tearY, w, tearH);

            ctx.fillStyle = 'rgba(255, 0, 40, 0.5)';
            ctx.fillRect(shiftX, tearY, w, 2);
            ctx.fillStyle = 'rgba(0, 230, 255, 0.5)';
            ctx.fillRect(-shiftX, tearY + tearH - 2, w, 2);
          }
        }
      }

      // ----------------------------------------------------------------------
      // 5. 高品位フィルムグレインノイズ (Film Grain - 生々しいフィルム粒子)
      // ----------------------------------------------------------------------
      const grainH = Math.min(h, 280);
      const imgData = ctx.createImageData(w, grainH);
      const buf = new Uint32Array(imgData.data.buffer);
      const density = mode === 'static' || mode === 'signalLoss'
        ? 0.28
        : mode === 'nightmare' || mode === 'corruption'
        ? 0.18
        : 0.08;
      const totalPixels = buf.length;
      const count = Math.floor(totalPixels * density * level);

      for (let i = 0; i < count; i++) {
        const idx = Math.floor(Math.random() * totalPixels);
        const val = Math.floor(Math.random() * 255);
        if (mode === 'redout' || mode === 'heartbeat') {
          buf[idx] = (140 << 24) | (15 << 16) | (15 << 8) | val;
        } else if (mode === 'nightmare' || mode === 'corruption') {
          buf[idx] = (180 << 24) | (val << 16) | (Math.random() > 0.5 ? 240 : 0) | val;
        } else {
          buf[idx] = (Math.floor(Math.random() * 90 + 20) << 24) | (val << 16) | (val << 8) | val;
        }
      }
      ctx.putImageData(imgData, 0, (frameCount * 43) % (h > grainH ? h - grainH : 1));

      // ----------------------------------------------------------------------
      // 6. サブリミナル文字・凝視怪異フラッシュ (Subliminal Horror Frames)
      // ----------------------------------------------------------------------
      const shouldFlashWord =
        (frameCount % 24 < 2 && level >= 2) ||
        mode === 'nightmare' ||
        mode === 'hallucination' ||
        mode === 'stalker';

      if (shouldFlashWord) {
        ctx.save();
        const word = creepyWords[Math.floor(Math.random() * creepyWords.length)];
        ctx.font = `bold ${Math.floor(26 + Math.random() * 28 * level)}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const textX = w / 2 + (Math.random() * 50 - 25);
        const textY = h / 2 + (Math.random() * 80 - 40);

        ctx.fillStyle = 'rgba(220, 0, 0, 0.9)';
        ctx.fillText(word, textX - 3, textY);
        ctx.fillStyle = 'rgba(0, 220, 255, 0.9)';
        ctx.fillText(word, textX + 3, textY);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.98)';
        ctx.fillText(word, textX, textY);

        ctx.restore();
      }

      // ----------------------------------------------------------------------
      // 7. 突発暗転・停電バンディング (Blackout bands)
      // ----------------------------------------------------------------------
      if (Math.random() < (mode === 'blackout' ? 0.55 : 0.18 * level)) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
        const bandH = Math.random() * (h * 0.4);
        const bandY = Math.random() * (h - bandH);
        ctx.fillRect(0, bandY, w, bandH);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [glitchOptions]);

  // モードに応じたフォトリアル血痕レイヤーの表示制御
  const hasBlood = glitchOptions && (
    glitchOptions.mode === 'stalker' ||
    glitchOptions.mode === 'heartbeat' ||
    glitchOptions.mode === 'nightmare' ||
    glitchOptions.mode === 'redout'
  );

  return (
    <>
      {/* Screen flash fallback */}
      {screenFlashActive && <div className="screen-flash-active" />}

      {/* フォトリアル血痕・手形オーバーレイ (映画用高解像度テクスチャ) */}
      {hasBlood && (
        <div className="horror-blood-overlay">
          <div className="horror-blood-layer splatter" />
          {(glitchOptions.mode === 'stalker' || glitchOptions.mode === 'nightmare') && (
            <div className="horror-blood-layer handprint" />
          )}
        </div>
      )}

      {/* Dynamic Horror Noise Canvas */}
      {glitchOptions && (
        <canvas ref={canvasRef} className="horror-noise-canvas" />
      )}
    </>
  );
};
