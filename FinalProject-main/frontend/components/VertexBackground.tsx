"use client";

import { AuroraBackground } from "./AuroraBackground";
import { ConstellationCanvas } from "./ConstellationCanvas";

export default function VertexBackground() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
      style={{
        background: "linear-gradient(165deg, #1e1b4b 0%, #2d2a5c 35%, #3d2c6e 70%, #4c3d7a 100%)",
        backgroundAttachment: "fixed",
      }}
      aria-hidden
    >
      <AuroraBackground />
      <ConstellationCanvas />
    </div>
  );
}
