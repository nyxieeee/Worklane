import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface AppLoadingScreenProps {
  isDark?: boolean;
}

export default function AppLoadingScreen({ isDark = true }: AppLoadingScreenProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const steps = [
      { target: 30, delay: 0 },
      { target: 55, delay: 300 },
      { target: 75, delay: 700 },
      { target: 85, delay: 1300 },
    ];
    const timers: number[] = steps.map(({ target, delay }) =>
      window.setTimeout(() => setProgress(target), delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const bg = isDark ? "#0f1117" : "#f3f4f8";
  const text = isDark ? "#e2e8f0" : "#1e293b";
  const sub = isDark ? "#64748b" : "#94a3b8";
  const accent = "#6366f1";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "'Inter', 'Outfit', sans-serif",
      }}
    >
      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}20 0%, transparent 70%)`,
          pointerEvents: "none",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, position: "relative" }}
      >
        {/* Animated logo mark */}
        <motion.div
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: 68,
            height: 68,
            borderRadius: 20,
            background: `linear-gradient(135deg, ${accent}, #8b5cf6)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 40px ${accent}50`,
          }}
        >
          <svg width="38" height="38" viewBox="0 0 36 36" fill="none">
            <rect x="5" y="8" width="10" height="20" rx="3" fill="white" opacity="0.9" />
            <rect x="18" y="4" width="10" height="24" rx="3" fill="white" opacity="0.7" />
            <rect x="5" y="31" width="23" height="2" rx="1" fill="white" opacity="0.5" />
          </svg>
        </motion.div>

        {/* Title */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 700, color: text, letterSpacing: "-0.5px" }}>
            Worklane
          </div>
          <div style={{ fontSize: 13, color: sub, marginTop: 6 }}>
            Syncing your workspace\u2026
          </div>
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: 240,
            height: 4,
            borderRadius: 99,
            background: isDark ? "#ffffff12" : "#00000010",
            overflow: "hidden",
          }}
        >
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              height: "100%",
              borderRadius: 99,
              background: `linear-gradient(90deg, ${accent}, #8b5cf6)`,
            }}
          />
        </div>

        {/* Bouncing dots */}
        <div style={{ display: "flex", gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
              style={{ width: 6, height: 6, borderRadius: "50%", background: accent }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
