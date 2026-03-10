"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Dot grid that moves very slowly on mouse movement (lightweight parallax).
 */
export function HeroParallaxGrid() {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const x = (e.clientX / w - 0.5) * 8;
      const y = (e.clientY / h - 0.5) * 8;
      setOffset({ x, y });
    };

    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0 opacity-40"
      aria-hidden
      style={{
        backgroundImage: `
          radial-gradient(circle at center, rgba(124, 58, 237, 0.15) 1px, transparent 1px)
        `,
        backgroundSize: "24px 24px",
        backgroundPosition: `${offset.x}px ${offset.y}px`,
        transition: "background-position 0.3s ease-out",
      }}
    />
  );
}
