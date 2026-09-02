import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import sidebarDark from "../assets/sidebar-dark.png";
import sidebarLight from "../assets/sidebar.png";
import logo from "../assets/logo.png";

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

  const accent = "#6366f1";
  const bg = isDark ? sidebarDark : sidebarLight;
  const sub = isDark ? "#94a3b8" : "#64748b";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: `url(${bg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "'Inter', 'Outfit', sans-serif",
      }}
    >
      {/* Dark overlay so content is readable */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: isDark ? "rgba(10,11,18,0.72)" : "rgba(240,242,248,0.65)",
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        {/* Logo image */}
        <motion.img
          src={logo}
          alt="Worklane"
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: 96,
            height: 96,
            objectFit: "contain",
            filter: `drop-shadow(0 0 24px ${accent}80)`,
            borderRadius: 22,
          }}
        />

        {/* Subtitle */}
        <div
          style={{
            fontSize: 14,
            color: sub,
            letterSpacing: "0.03em",
          }}
        >
          Syncing your workspace...
        </div>

        {/* Progress bar */}
        <div
          style={{
            width: 220,
            height: 4,
            borderRadius: 99,
            background: "rgba(255,255,255,0.1)",
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

        {/* Pulsing dots */}
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