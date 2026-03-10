"use client";

export function AuroraBackground() {
  return (
    <>
      {/* Band 1 — Purple */}
      <div
        className="constellation-aurora-1 absolute will-change-transform"
        style={{
          width: "110vw",
          height: "280px",
          top: "8%",
          left: "-5%",
          background: `linear-gradient(90deg,
            transparent 0%,
            rgba(124, 58, 237, 0.07) 35%,
            rgba(99, 102, 241, 0.10) 65%,
            transparent 100%
          )`,
          filter: "blur(55px)",
        }}
        aria-hidden
      />
      {/* Band 2 — Cyan */}
      <div
        className="constellation-aurora-2 absolute will-change-transform"
        style={{
          width: "120vw",
          height: "220px",
          top: "38%",
          left: "-10%",
          background: `linear-gradient(90deg,
            transparent 0%,
            rgba(6, 182, 212, 0.06) 40%,
            rgba(8, 145, 178, 0.09) 70%,
            transparent 100%
          )`,
          filter: "blur(65px)",
        }}
        aria-hidden
      />
      {/* Band 3 — Indigo */}
      <div
        className="constellation-aurora-3 absolute will-change-transform"
        style={{
          width: "105vw",
          height: "200px",
          top: "65%",
          left: "-3%",
          background: `linear-gradient(90deg,
            transparent 0%,
            rgba(79, 70, 229, 0.06) 45%,
            rgba(124, 58, 237, 0.08) 75%,
            transparent 100%
          )`,
          filter: "blur(50px)",
        }}
        aria-hidden
      />
    </>
  );
}
