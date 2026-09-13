"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTrackX } from "@/context/TrackXContext";

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { theme, setTheme } = useTrackX();
  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle Theme Mode"
      className={`relative inline-flex items-center justify-center p-2 rounded-xl transition-all duration-300 glass-card cursor-pointer ${className}`}
    >
      <motion.div
        key={theme}
        initial={{ rotate: -45, scale: 0.7, opacity: 0 }}
        animate={{ rotate: 0, scale: 1, opacity: 1 }}
        exit={{ rotate: 45, scale: 0.7, opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        {isDark ? (
          <Sun className="w-4 h-4 text-amber-300 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />
        ) : (
          <Moon className="w-4 h-4 text-slate-700" />
        )}
      </motion.div>
    </button>
  );
};
