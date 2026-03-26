/**
 * Ambient depth: Stitch-style aurora + subtle grain + soft horizon line for a finished “product” feel.
 */
export function StitchBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      {/* Primary glows */}
      <div className="absolute right-0 top-0 h-[min(520px,85vw)] w-[min(520px,85vw)] animate-aurora-drift aurora-glow opacity-[0.55]" />
      <div className="absolute bottom-0 left-0 h-[min(640px,95vw)] w-[min(640px,95vw)] animate-aurora-drift-slow aurora-glow opacity-35 [animation-delay:-8s]" />
      {/* Center lift — draws the eye toward content */}
      <div
        className="absolute left-1/2 top-[18%] h-[min(420px,60vh)] w-[min(900px,120vw)] -translate-x-1/2 opacity-[0.12]"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(192, 193, 255, 0.35) 0%, transparent 65%)",
        }}
      />
      {/* Horizon */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px opacity-30"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(192,193,255,0.25) 50%, transparent 100%)",
        }}
      />
      {/* Film grain — ultra subtle texture */}
      <div
        className="absolute inset-0 opacity-[0.04] mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
