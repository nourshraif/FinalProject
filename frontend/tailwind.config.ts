import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        headline: ["var(--font-headline)", "Manrope", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
        label: ["var(--font-body)", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        /** Stitch / Material-style Vertex palette (use bg-v-*, text-v-*) */
        /** Stitch `vertex_obsidian` / Material tokens — see `stitch/stitch/vertex_obsidian/DESIGN.md` */
        v: {
          bg: "#0b1326",
          background: "#0b1326",
          surface: "#0b1326",
          onBg: "#dae2fd",
          onBackground: "#dae2fd",
          onSurface: "#dae2fd",
          onSurfaceVariant: "#c7c4d7",
          primary: "#c0c1ff",
          primaryContainer: "#8083ff",
          primaryFixedDim: "#c0c1ff",
          onPrimary: "#1000a9",
          onPrimaryContainer: "#0d0096",
          onPrimaryFixed: "#07006c",
          tertiary: "#d0bcff",
          tertiaryContainer: "#a078ff",
          onTertiaryContainer: "#340080",
          surfaceContainer: "#171f33",
          surfaceContainerHigh: "#222a3d",
          surfaceContainerHighest: "#2d3449",
          surfaceContainerLow: "#131b2e",
          surfaceContainerLowest: "#060e20",
          outline: "#908fa0",
          outlineVariant: "#464554",
          footer: "#131b2e",
          secondary: "#c4c1fb",
          secondaryContainer: "#444173",
          error: "#ffb4ab",
          inversePrimary: "#494bd6",
        },
        vertex: {
          black: "#0a0a0f",
          navy: "#0d0d1a",
          card: "#13131f",
          border: "#2a2a3d",
          purple: "#7c3aed",
          violet: "#6366f1",
          cyan: "#06b6d4",
          white: "#ffffff",
          muted: "#94a3b8",
          success: "#22c55e",
          warning: "#f59e0b",
          danger: "#ef4444",
          glow: "#7c3aed33",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: "hsl(var(--destructive))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        navy: {
          DEFAULT: "hsl(222 47% 11%)",
          light: "hsl(222 30% 18%)",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        /** Stitch tailwind.config `full` override (0.75rem) — use for cards, not circles */
        stitch: "0.75rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
