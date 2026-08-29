import path from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_ROOT = path.resolve(CONFIG_DIR, "..");

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    path.join(FRONTEND_ROOT, "index.html"),
    path.join(FRONTEND_ROOT, "src/**/*.{js,jsx}"),
  ],
  theme: {
    extend: {
      colors: {
        cream: "#F6F1E7",
        ink: "#162B45",
        sage: { DEFAULT: "#4C6354", light: "rgba(76,99,84,0.08)", mid: "rgba(76,99,84,0.15)", border: "rgba(76,99,84,0.2)" },
        botanical: { DEFAULT: "#1F2E22", light: "#2d4433", dark: "#2a3f2e" },
        clay: "#C97B5E",
        sand: { DEFAULT: "#E3DCC9", light: "#F0EBE0", dark: "#d8d0c4" },
        muted: "#6B6558",
        hint: "#A39E8E",
        amber: "#F59A1A",
        wa: "#25D366",
        online: "#4ade80",
      },
      fontFamily: {
        display: ["Fraunces", "serif"],
        body: ["Work Sans", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      keyframes: {
        gesaSlideUp: { from: { opacity: "0", transform: "translateY(16px) scale(0.96)" }, to: { opacity: "1", transform: "translateY(0) scale(1)" } },
        gesaFadeMsg: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        gesaPulse: { "0%, 80%, 100%": { transform: "scale(0)", opacity: "0.4" }, "40%": { transform: "scale(1)", opacity: "1" } },
      },
      animation: {
        "gesa-slide-up": "gesaSlideUp 0.3s cubic-bezier(0.16,1,0.3,1)",
        "gesa-fade": "gesaFadeMsg 0.3s ease-out",
        "gesa-fade-slow": "gesaFadeMsg 0.4s ease-out",
      },
    },
  },
  plugins: [],
};
