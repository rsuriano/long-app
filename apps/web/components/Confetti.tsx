"use client";
import { useEffect, useRef } from "react";

/** A short burst of paper from the top, drawn on a canvas; nothing to install. */
export function Confetti({ duration = 2600 }: { duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = canvas.clientWidth, H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.scale(dpr, dpr);
    const colors = ["#0052FF", "#3D7BFF", "#B4CDFF", "#FFD166", "#06D6A0", "#EF476F", "#FFFFFF"];
    const N = 140;
    const pieces = Array.from({ length: N }, () => ({
      x: W * (0.2 + Math.random() * 0.6), y: -10 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 6, vy: 2 + Math.random() * 5,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)]!,
    }));
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const age = t - start;
      ctx.clearRect(0, 0, W, H);
      const fade = age > duration - 600 ? Math.max(0, (duration - age) / 600) : 1;
      for (const p of pieces) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.vx *= 0.99; p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (age < duration) raf = requestAnimationFrame(tick);
      else ctx.clearRect(0, 0, W, H);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [duration]);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
