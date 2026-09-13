"use client";

import React, { useRef, useState } from "react";
import { motion, useSpring, useMotionValue, useTransform } from "framer-motion";
import { RiskStatus } from "@/types/trackx";
import { Plus, Minus, RotateCcw, ShieldCheck, CheckCircle2, Zap } from "lucide-react";

interface AttendanceOrbProps {
  percentage: number;
  target?: number;
  status?: RiskStatus;
  size?: "sm" | "md" | "lg" | "hero";
  interactive?: boolean;
  attended?: number;
  conducted?: number;
}

export const AttendanceOrb: React.FC<AttendanceOrbProps> = ({
  percentage: initialPercentage,
  target = 75,
  status: initialStatus = "healthy",
  size = "lg",
  interactive = true,
  attended,
  conducted,
}) => {
  const orbRef = useRef<HTMLDivElement>(null);

  // Simulated interactive state
  const [attendedDelta, setAttendedDelta] = useState(0);
  const [conductedDelta, setConductedDelta] = useState(0);

  // Derive dynamic starting baseline
  const baseAttended = attended ?? Math.round((initialPercentage / 100) * (conducted ?? 28));
  const baseConducted = conducted ?? 28;

  const currentAttended = Math.max(0, baseAttended + attendedDelta);
  const currentConducted = Math.max(1, baseConducted + conductedDelta);
  const livePct = (currentAttended / currentConducted) * 100;

  const displayPct = conductedDelta !== 0 ? livePct : initialPercentage;
  const displayStatus: RiskStatus =
    conductedDelta !== 0
      ? displayPct >= target
        ? "healthy"
        : displayPct >= target - 10
        ? "attention"
        : "critical"
      : initialStatus;

  // Safe skips calculation
  const safeSkips = Math.max(0, Math.floor((100 * currentAttended - target * currentConducted) / target));
  const recoveryNeeded = Math.max(
    0,
    Math.ceil((target * currentConducted - 100 * currentAttended) / (100 - target))
  );

  // Parallax 3D Tilt Coordinates
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springConfig = { damping: 18, stiffness: 140, mass: 0.5 };
  const rotateX = useSpring(useTransform(y, [-120, 120], [16, -16]), springConfig);
  const rotateY = useSpring(useTransform(x, [-120, 120], [-16, 16]), springConfig);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!interactive || !orbRef.current) return;
    const rect = orbRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set(e.clientX - centerX);
    y.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  // Dimensions
  const dimensionClasses = {
    sm: "w-28 h-28 text-lg",
    md: "w-44 h-44 text-2xl",
    lg: "w-60 h-60 text-4xl",
    hero: "w-80 h-80 sm:w-96 sm:h-96 text-5xl sm:text-6xl",
  }[size];

  // Theme Colors
  const colorMap = {
    healthy: {
      glow: "#10B981",
      arcColor: "url(#emeraldGradient)",
      glowFilter: "drop-shadow(0 0 14px rgba(16, 185, 129, 0.75))",
      ledClass: "skeuo-led-green",
      label: "Healthy",
      badgeText: "text-emerald-400",
    },
    attention: {
      glow: "#F59E0B",
      arcColor: "url(#amberGradient)",
      glowFilter: "drop-shadow(0 0 14px rgba(245, 158, 11, 0.75))",
      ledClass: "skeuo-led-amber",
      label: "Attention",
      badgeText: "text-amber-400",
    },
    critical: {
      glow: "#EF4444",
      arcColor: "url(#coralGradient)",
      glowFilter: "drop-shadow(0 0 14px rgba(244, 63, 94, 0.75))",
      ledClass: "skeuo-led-coral",
      label: "Critical Deficit",
      badgeText: "text-rose-400",
    },
  }[displayStatus];

  // Arc circumference (radius 42 -> 2 * PI * 42 = 263.89)
  const circumference = 263.89;
  const strokeOffset = circumference - (Math.min(displayPct, 100) / 100) * circumference;

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none"
      style={{ perspective: 1200 }}
    >
      {/* Visual Orb Instrument Cluster (concentric halo, dashed ring, satellites, and 3D deck) */}
      <div className="relative flex items-center justify-center">
        {/* 3D Kinetic Volumetric Atmosphere Halo */}
        <div
          className="absolute inset-0 rounded-full blur-[70px] opacity-50 pointer-events-none transition-all duration-500 animate-aura-pulse"
          style={{
            background: `radial-gradient(circle, ${colorMap.glow} 0%, rgba(99, 102, 241, 0.4) 60%, transparent 80%)`,
          }}
        />

        {/* Rotating Chromatic Outer Horizon Ring (concentric with orb) */}
        <div className="absolute -inset-4 sm:-inset-6 rounded-full border border-dashed border-cyan-400/25 pointer-events-none animate-[spin_40s_linear_infinite]" />

        {/* 3D Floating Satellites (Hero size only - positioned around circular orb) */}
        {size === "hero" && (
          <>
            {/* Satellite 1: Top-Right Safe Skips Hologram Card */}
            <div className="absolute -top-4 -right-4 sm:-right-10 z-20 animate-spatial-float pointer-events-none">
              <div className="px-4 py-2.5 rounded-2xl glass-panel border border-cyan-400/40 shadow-[0_12px_32px_rgba(0,0,0,0.12),0_0_20px_rgba(0,242,254,0.2)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(0,242,254,0.35)] backdrop-blur-xl flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
                    Safe to Miss
                  </span>
                  <span className="text-xs font-black text-cyan-600 dark:text-cyan-300">
                    {safeSkips > 0 ? `+${safeSkips} Classes` : `${recoveryNeeded} Needed`}
                  </span>
                </div>
              </div>
            </div>

            {/* Satellite 2: Lower-Left Verifiable Math Hologram Card (floats at 8-o'clock of circular deck, well above controls) */}
            <div className="absolute bottom-8 -left-4 sm:-left-10 z-20 animate-spatial-float-reverse pointer-events-none">
              <div className="px-4 py-2.5 rounded-2xl glass-panel border border-emerald-400/35 shadow-[0_12px_32px_rgba(0,0,0,0.12),0_0_20px_rgba(16,185,129,0.2)] dark:shadow-[0_12px_32px_rgba(0,0,0,0.6),0_0_20px_rgba(16,185,129,0.3)] backdrop-blur-xl flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 block">
                    Deterministic Math
                  </span>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-300">
                    100% Verifiable
                  </span>
                </div>
              </div>
            </div>

            {/* Satellite 3: Floating Live Telemetry Pill (centered on right equator) */}
            <div className="absolute top-1/2 -translate-y-1/2 -right-8 sm:-right-14 z-20 animate-spatial-float pointer-events-none hidden sm:block">
              <div className="px-3 py-1.5 rounded-full glass-subtle border border-indigo-400/30 text-[10px] font-bold text-indigo-600 dark:text-indigo-300 flex items-center gap-2 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span>Spatial Telemetry</span>
              </div>
            </div>
          </>
        )}

        {/* Main 3D Instrument Deck */}
        <motion.div
          ref={orbRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
          }}
          className={`relative rounded-full cursor-pointer flex flex-col items-center justify-center transition-all duration-300 group shadow-[0_24px_70px_rgba(0,0,0,0.85),inset_0_1.5px_2px_rgba(255,255,255,0.4),0_0_1px_1px_rgba(255,255,255,0.2)] ${dimensionClasses}`}
        >
        {/* Layer 0: Titanium Knurled Outer Bezel */}
        <div
          className="absolute inset-0 rounded-full p-[2px] pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.45) 0%, rgba(100,116,139,0.2) 50%, rgba(255,255,255,0.15) 100%)",
          }}
        >
          <div className="w-full h-full rounded-full bg-[#121727] opacity-95" />
        </div>

        {/* Layer 1: Recessed Sunken Chamber */}
        <div className="absolute inset-3 sm:inset-4 rounded-full overflow-hidden shadow-[inset_0_4px_12px_rgba(0,0,0,0.9),inset_0_1px_3px_rgba(0,0,0,0.8)]">
          {/* Radial depth gradient */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, #182038 0%, #0D1222 65%, #050810 100%)",
            }}
          />

          {/* Concentric Instrument Calibrations */}
          <div className="absolute inset-3 rounded-full border border-white/5" />
          <div className="absolute inset-7 rounded-full border border-white/5" />
          <div className="absolute inset-11 rounded-full border border-white/5" />
        </div>

        {/* Layer 2: Precision Analog Laser Arc Scale */}
        <svg
          className="absolute inset-2 sm:inset-3 w-[calc(100%-16px)] sm:w-[calc(100%-24px)] h-[calc(100%-16px)] sm:h-[calc(100%-24px)] -rotate-90 pointer-events-none p-2 sm:p-3"
          viewBox="0 0 100 100"
        >
          <defs>
            <linearGradient id="emeraldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#34D399" />
              <stop offset="50%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="amberGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#D97706" />
            </linearGradient>
            <linearGradient id="coralGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FECDD3" />
              <stop offset="50%" stopColor="#FF8B94" />
              <stop offset="100%" stopColor="#E11D48" />
            </linearGradient>
          </defs>

          {/* Outer Sunken Channel */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="rgba(0, 0, 0, 0.7)"
            strokeWidth="6"
          />
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="5"
          />

          {/* Target Reference Mark (Notch) */}
          <circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke="rgba(255, 255, 255, 0.55)"
            strokeWidth="6.5"
            strokeDasharray={`${(target / 100) * circumference} ${circumference}`}
            strokeDashoffset="0"
          />

          {/* Active Glowing Laser Gauge Arc */}
          <motion.circle
            cx="50"
            cy="50"
            r="42"
            fill="none"
            stroke={colorMap.arcColor}
            strokeWidth="6"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: strokeOffset }}
            transition={{ type: "spring", damping: 22, stiffness: 140 }}
            style={{
              filter: colorMap.glowFilter,
            }}
          />
        </svg>

        {/* Layer 3: Embossed Central 3D Readout Hub */}
        <div
          className="relative z-10 flex flex-col items-center justify-center text-center"
          style={{ transform: "translateZ(30px)" }}
        >
          <div className="flex items-baseline gap-1">
            <span
              className="font-black tracking-tight text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] transition-all duration-300"
              suppressHydrationWarning
              style={{
                textShadow:
                  "0 3px 6px rgba(0,0,0,0.9), 0 0 25px rgba(255,255,255,0.25)",
              }}
            >
              {displayPct.toFixed(1)}
            </span>
            <span className="text-lg sm:text-2xl font-bold text-cyan-300 font-mono">
              %
            </span>
          </div>

          {/* Physical Hardware Status Pill */}
          <div className="mt-1.5 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/15 text-[11px] font-bold tracking-wider uppercase backdrop-blur-md shadow-inner">
            <span className={`w-2.5 h-2.5 rounded-full ${colorMap.ledClass}`} />
            <span className={colorMap.badgeText}>{colorMap.label}</span>
          </div>

          <span className="text-[11px] font-medium text-slate-400 mt-1.5">
            Target Benchmark: {target}%
          </span>
        </div>

        {/* Layer 4: Curved Convex Optical Glass Specular Lens Glare */}
        <div
          className="absolute inset-1 rounded-full pointer-events-none"
          style={{
            background:
              "linear-gradient(135deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.05) 45%, transparent 60%)",
          }}
        />
      </motion.div>
      </div>

      {/* Interactive 3D Stepper Controls (When in hero mode) */}
      {interactive && size === "hero" && (
        <div className="mt-8 flex flex-col items-center gap-2 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setAttendedDelta((p) => p + 1);
                setConductedDelta((p) => p + 1);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-b from-emerald-500 to-emerald-700 text-white shadow-[0_4px_0_#065f46,0_8px_20px_rgba(16,185,129,0.4)] hover:brightness-110 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Simulate Attending (+1)</span>
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                setConductedDelta((p) => p + 1);
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-b from-rose-500 to-rose-700 text-white shadow-[0_4px_0_#9f1239,0_8px_20px_rgba(244,63,94,0.4)] hover:brightness-110 active:translate-y-1 active:shadow-none transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Minus className="w-3.5 h-3.5" />
              <span>Simulate Skipping (-1)</span>
            </button>

            {(attendedDelta !== 0 || conductedDelta !== 0) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAttendedDelta(0);
                  setConductedDelta(0);
                }}
                className="p-2 rounded-xl glass-card hover:bg-black/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer transition-all"
                title="Reset simulation"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-500 dark:text-amber-400" />
            <span>Interactive 3D Simulation • Click buttons to test percentage consequences live</span>
          </span>
        </div>
      )}
    </div>
  );
};
