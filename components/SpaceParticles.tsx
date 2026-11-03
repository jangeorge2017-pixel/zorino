'use client';
import React, { useEffect, useRef } from 'react';

export default function SpaceParticles() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // High contrast stars: White, Cyan, Yellow Gold
    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 3 + 1.5,
      color: ['#ffffff', '#22d3ee', '#facc15'][Math.floor(Math.random() * 3)],
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.04 + 0.02
    }));

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        s.phase += s.speed;
        // Fast, highly-visible high-contrast neon twinkling
        const alpha = (Math.sin(s.phase) + 1) / 2 * 0.7 + 0.3;
        ctx.fillStyle = s.color;
        ctx.globalAlpha = alpha;
        ctx.shadowBlur = 20;
        ctx.shadowColor = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 block w-full h-full pointer-events-none mix-blend-screen opacity-90" style={{ zIndex: -1 }} />;
}