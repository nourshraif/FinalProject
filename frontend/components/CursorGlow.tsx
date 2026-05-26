"use client";

import { useEffect, useState, useRef } from "react";

const LERP = 0.08;
const SIZE = 400;

export function CursorGlow() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const targetRef = useRef({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isTouch = typeof window !== "undefined" && "ontouchstart" in window;
    if (isTouch) return;

    const onMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY };
    };

    window.addEventListener("mousemove", onMove);

    let raf = 0;
    const update = () => {
      const t = targetRef.current;
      setPos((p) => ({
        x: p.x + (t.x - p.x) * LERP,
        y: p.y + (t.y - p.y) * LERP,
      }));
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      className="pointer-events-none fixed z-0 hidden md:block"
      aria-hidden
      style={{
        width: SIZE,
        height: SIZE,
        left: pos.x - SIZE / 2,
        top: pos.y - SIZE / 2,
        background: "radial-gradient(circle, #7c3aed10 0%, transparent 60%)",
        transition: "none",
      }}
    />
  );
}
