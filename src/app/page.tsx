"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AttendanceOrb } from "@/components/ui/AttendanceOrb";
import { useTrackX } from "@/context/TrackXContext";
import { useIsMounted } from "@/hooks/useIsMounted";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  CheckCircle2,
  FileScan,
  TrendingUp,
  Award,
  ChevronRight,
  Cpu,
} from "lucide-react";

export default function LandingPage() {
  const { overallMetrics } = useTrackX();
  const mounted = useIsMounted();

  const hasLiveMetrics = mounted && overallMetrics && overallMetrics.conducted > 0;
  const heroPercentage = hasLiveMetrics ? overallMetrics.percentage : 78.6;
  const heroAttended = hasLiveMetrics ? overallMetrics.attended : 22;
  const heroConducted = hasLiveMetrics ? overallMetrics.conducted : 28;
  const heroStatus = hasLiveMetrics ? overallMetrics.riskStatus : "healthy";

  // Mini interactive state for Card 2 (What-If demo)
  const [demoAttendance, setDemoAttendance] = useState(19);
  const demoConducted = 26;
  const demoPct = (demoAttendance / demoConducted) * 100;

  return (
    <div className="space-y-28 py-6 md:py-12 animate-in fade-in duration-500 overflow-hidden">
      {/* 1. HERO SECTION */}
      <section className="relative flex flex-col lg:flex-row items-center justify-between gap-12 pt-6 pb-12">
        <div className="flex-1 space-y-6 text-center lg:text-left z-10">
          {/* Spatial OS pill */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-container border border-cyan-500/30 dark:border-cyan-400/40 shadow-[0_0_20px_rgba(0,242,254,0.15)] dark:shadow-[0_0_20px_rgba(0,242,254,0.25)] text-xs font-bold text-cyan-700 dark:text-cyan-300 backdrop-blur-xl">
            <Sparkles className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 animate-pulse" />
            <span>Spatial Attendance Intelligence Operating System</span>
          </div>

          {/* Master 3D Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.08]">
            Track smarter. <br />
            <span className="bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 dark:from-cyan-400 dark:via-indigo-300 dark:to-purple-400 bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(99,102,241,0.2)] dark:drop-shadow-[0_4px_24px_rgba(99,102,241,0.4)]">
              Decide with precision.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
            Track your semester attendance with Apple-spatial depth. Understand your percentages in real time. Know exactly how many classes you can safely skip, and how many you must attend to stay above your target.
          </p>

          {/* 3D Physical Extruded Call to Action Buttons */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2">
            <Link href="/dashboard">
              <button className="skeuo-3d-btn-primary px-8 py-4 rounded-2xl font-black text-white text-base tracking-wide flex items-center gap-2.5 cursor-pointer">
                <span>Launch Dashboard</span>
                <ArrowRight className="w-5 h-5 text-cyan-300" />
              </button>
            </Link>

            <Link href="/login">
              <button className="skeuo-3d-btn-secondary px-7 py-4 rounded-2xl font-bold text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white text-base tracking-wide flex items-center gap-2 cursor-pointer">
                <span>Student Sign In</span>
                <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </button>
            </Link>
          </div>

          {/* Trust telemetry tags */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-6 pt-4 text-xs text-slate-600 dark:text-slate-400 font-semibold">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
              <CheckCircle2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" /> Deterministic Math
            </span>
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Local-First Privacy
            </span>
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5">
              <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" /> Zero Gimmicks
            </span>
          </div>
        </div>

        {/* Hero Signature Visual: Living 3D Spatial Cockpit */}
        <div className="flex-1 flex items-center justify-center w-full relative z-10 py-6">
          <motion.div
            initial={{ scale: 0.88, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="w-full flex justify-center"
          >
            <AttendanceOrb
              percentage={heroPercentage}
              attended={heroAttended}
              conducted={heroConducted}
              target={75}
              status={heroStatus}
              size="hero"
              interactive={true}
            />
          </motion.div>
        </div>
      </section>

      {/* 2. LIVING 3D INTERACTIVE FEATURE SHOWCASES */}
      <section className="space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[11px] uppercase font-bold tracking-widest text-indigo-300">
            <Cpu className="w-3.5 h-3.5" />
            <span>Interactive Spatial Mechanics</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Designed for Student Clarity
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Three interactive architectural layers that transform static attendance records into proactive intelligence.
          </p>
        </div>

        {/* 3D Tilt Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: Instant Portal Ingestion */}
          <div className="card-3d-wrap">
            <div className="card-3d-body h-full rounded-3xl p-7 glass-panel border border-cyan-500/20 dark:border-cyan-400/30 shadow-2xl flex flex-col justify-between group hover:border-cyan-500/50 dark:hover:border-cyan-400/70">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 flex items-center justify-center font-black text-lg shadow-lg shadow-cyan-500/10">
                    <FileScan className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-bold text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                    LAYER 01
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                  Instant Schedule Ingestion
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Upload attendance ledgers or screenshots from ERP systems. TrackX automatically recognizes periods, multi-hour labs, and exact attended integers without synthesizing fake estimates.
                </p>
              </div>

              {/* Interactive Mini Scanning Ledger Visualization (Simulated Dark Cockpit Terminal) */}
              <div className="mt-6 p-4 rounded-2xl bg-slate-900/95 dark:bg-black/50 border border-slate-700/40 dark:border-white/10 relative overflow-hidden shadow-inner">
                {/* Laser scan line */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#00F2FE] animate-laser-scan pointer-events-none" />

                <div className="space-y-2 text-[11px] font-mono">
                  <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-white/10">
                    <span>COURSE MODULE</span>
                    <span>ATTENDANCE</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200">
                    <span>Algorithm Design</span>
                    <span className="text-emerald-400 font-bold">22 / 26 (84.6%)</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200">
                    <span>Network Systems Lab</span>
                    <span className="text-emerald-400 font-bold">14 / 16 (87.5%)</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-200">
                    <span>Database Architecture</span>
                    <span className="text-amber-400 font-bold">18 / 25 (72.0%)</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-cyan-300 font-bold">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-cyan-400" /> 100% OCR Accuracy
                  </span>
                  <span>18 SLOTS READY</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Dynamic What-If Engine (Interactive Simulation) */}
          <div className="card-3d-wrap">
            <div className="card-3d-body h-full rounded-3xl p-7 glass-panel border border-indigo-500/20 dark:border-indigo-400/30 shadow-2xl flex flex-col justify-between group hover:border-indigo-500/50 dark:hover:border-indigo-400/70">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-black text-lg shadow-lg shadow-indigo-500/10">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                    LAYER 02
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                  Dynamic What-If Engine
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Before making a decision to attend or bunk a class, test the exact consequence in real time. Simulate lecture misses and see immediate projected percentages.
                </p>
              </div>

              {/* Live Interactive Stepper Inside Card 2 (Simulated Cockpit Display) */}
              <div className="mt-6 p-4 rounded-2xl bg-slate-900/95 dark:bg-black/50 border border-slate-700/40 dark:border-white/10 space-y-3 shadow-inner">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-semibold">Simulated Course:</span>
                  <span className="text-white font-bold">Operating Systems</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Current Standing
                    </span>
                    <span
                      className={`text-lg font-black ${
                        demoPct >= 75 ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {demoPct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setDemoAttendance((p) => Math.max(0, p - 1))}
                      className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/30 font-bold flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                      title="Simulate Missed Class"
                    >
                      -1
                    </button>
                    <button
                      onClick={() => setDemoAttendance((p) => Math.min(demoConducted, p + 1))}
                      className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 font-bold flex items-center justify-center cursor-pointer active:scale-95 transition-all"
                      title="Simulate Attended Class"
                    >
                      +1
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-slate-400">
                    Sessions: {demoAttendance}/{demoConducted}
                  </span>
                  <span
                    className={
                      demoPct >= 75 ? "text-emerald-400" : "text-rose-400"
                    }
                  >
                    {demoPct >= 75
                      ? "+2 Safe Skips Available ✓"
                      : "Debarment Risk Warning ⚠"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Proactive Recovery Advice */}
          <div className="card-3d-wrap">
            <div className="card-3d-body h-full rounded-3xl p-7 glass-panel border border-amber-500/20 dark:border-amber-400/30 shadow-2xl flex flex-col justify-between group hover:border-amber-500/50 dark:hover:border-amber-400/70">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 flex items-center justify-center font-black text-lg shadow-lg shadow-amber-500/10">
                    <Award className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    LAYER 03
                  </span>
                </div>

                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors">
                  Proactive Recovery Advice
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Never get surprised by exam hall-ticket debarment notices. TrackX instantly computes the exact consecutive sessions required to safely regain your target status.
                </p>
              </div>

              {/* Recovery Roadmap Timeline Visualization */}
              <div className="mt-6 p-4 rounded-2xl bg-slate-900/95 dark:bg-black/50 border border-slate-700/40 dark:border-white/10 space-y-2.5 shadow-inner">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Automated Recovery Roadmap
                </span>

                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 font-bold flex items-center justify-center text-[10px]">
                      1
                    </span>
                    <span className="text-slate-300">
                      Attendance at <strong>69.2%</strong> (Critical Deficit)
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-bold flex items-center justify-center text-[10px]">
                      2
                    </span>
                    <span className="text-amber-300 font-bold">
                      Attend next 6 consecutive lectures
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold flex items-center justify-center text-[10px]">
                      ✓
                    </span>
                    <span className="text-emerald-300 font-bold">
                      75.0% Target Reclaimed (Safe)
                    </span>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-400">
                  Guaranteed safe hall-ticket eligibility with zero guesswork.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. CALL TO ACTION FOOTER */}
      <section className="text-center space-y-6 py-12 relative z-10">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-500 to-indigo-500 p-0.5 shadow-2xl shadow-cyan-500/20 mx-auto animate-spatial-float">
          <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center font-black text-2xl text-white">
            TX
          </div>
        </div>

        <h2 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Ready to experience TrackX?
        </h2>
        <p className="text-base text-slate-400 max-w-md mx-auto">
          Start in guest sandbox mode or connect your university courses in seconds.
        </p>

        <div className="flex justify-center gap-4 pt-2">
          <Link href="/dashboard">
            <button className="skeuo-3d-btn-primary px-9 py-4 rounded-2xl font-black text-white text-base tracking-wide flex items-center gap-2 cursor-pointer">
              <span>Launch TrackX Now</span>
              <ArrowRight className="w-5 h-5 text-cyan-300" />
            </button>
          </Link>
        </div>
      </section>
    </div>
  );
}
