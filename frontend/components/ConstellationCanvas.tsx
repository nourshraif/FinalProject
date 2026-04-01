"use client";

import { useEffect, useRef } from "react";

const PURPLE = "#7c3aed";
const CYAN = "#06b6d4";
const CONNECTION_DISTANCE = 130;
const LINE_MAX_OPACITY = 0.12;
const PADDING = 10;
const POINT_COUNT_DESKTOP = 35;
const POINT_COUNT_MOBILE = 20;
const MAX_VELOCITY = 0.12;
const MIN_RADIUS = 1;
const MAX_RADIUS = 1.8;
const POINT_OPACITY_RANGE: [number, number] = [0.15, 0.45];

type Point = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  color: string;
};

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function initPoints(
  width: number,
  height: number,
  count: number
): Point[] {
  const points: Point[] = [];
  const [minOp, maxOp] = POINT_OPACITY_RANGE;
  for (let i = 0; i < count; i++) {
    points.push({
      x: PADDING + Math.random() * (width - 2 * PADDING),
      y: PADDING + Math.random() * (height - 2 * PADDING),
      vx: (Math.random() - 0.5) * 2 * MAX_VELOCITY,
      vy: (Math.random() - 0.5) * 2 * MAX_VELOCITY,
      radius: MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS),
      opacity: minOp + Math.random() * (maxOp - minOp),
      color: Math.random() < 0.7 ? PURPLE : CYAN,
    });
  }
  return points;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function ConstellationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const rafRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const canvasEl = canvas;
    const containerEl = container;

    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;

    let width = containerEl.offsetWidth;
    let height = containerEl.offsetHeight;
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    const pointCount = isMobile ? POINT_COUNT_MOBILE : POINT_COUNT_DESKTOP;

    function resize() {
      width = containerEl.offsetWidth;
      height = containerEl.offsetHeight;
      canvasEl.width = width;
      canvasEl.height = height;
      const mobile = typeof window !== "undefined" && window.innerWidth < 768;
      pointsRef.current = initPoints(
        width,
        height,
        mobile ? POINT_COUNT_MOBILE : POINT_COUNT_DESKTOP
      );
    }

    resize();

    let visible = !document.hidden;
    const visibilityHandler = () => {
      visible = !document.hidden;
      if (!visible && rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      } else if (visible && !rafRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    const resizeObserver = new ResizeObserver(() => {
      resize();
    });
    resizeObserver.observe(containerEl);

    function loop() {
      if (!ctx) return;
      const points = pointsRef.current;
      const w = canvasEl.width;
      const h = canvasEl.height;
      if (w <= 0 || h <= 0 || points.length === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      // Update positions and bounce
      for (const p of points) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x <= PADDING || p.x >= w - PADDING) p.vx *= -1;
        if (p.y <= PADDING || p.y >= h - PADDING) p.vy *= -1;
        p.x = Math.max(PADDING, Math.min(w - PADDING, p.x));
        p.y = Math.max(PADDING, Math.min(h - PADDING, p.y));
      }

      // Draw connections first
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const a = points[i];
          const b = points[j];
          const d = dist(a, b);
          if (d > CONNECTION_DISTANCE) continue;
          const alpha = (1 - d / CONNECTION_DISTANCE) * LINE_MAX_OPACITY;
          const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          gradient.addColorStop(0, hexToRgba(a.color, alpha));
          gradient.addColorStop(1, hexToRgba(b.color, alpha));
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // Draw points
      for (const p of points) {
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (visible) {
        rafRef.current = requestAnimationFrame(loop);
      }
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      document.removeEventListener("visibilitychange", visibilityHandler);
      resizeObserver.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
    >
      <canvas
        ref={canvasRef}
        className="absolute w-full h-full opacity-60"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}