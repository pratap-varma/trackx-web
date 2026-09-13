"use client";

import React, { useState } from "react";
import { useTrackX } from "@/context/TrackXContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  Target,
  Sun,
  Moon,
  RotateCcw,
  Save,
  Check,
} from "lucide-react";

export default function SettingsPage() {
  const { user, theme, setTheme, updateGlobalTarget, resetToDemoData } = useTrackX();
  const [targetInput, setTargetInput] = useState<number | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const effectiveTarget = targetInput ?? user?.globalTarget ?? 75;

  const handleSaveTarget = () => {
    updateGlobalTarget(effectiveTarget);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs uppercase font-bold tracking-widest text-cyan-400">
            System Preferences
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
          <span className="text-xs text-slate-400">Platform Control</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Settings & Configuration
        </h1>
      </div>

      {/* Target Attendance Configuration (Critical Requirement) */}
      <GlassCard variant="elevated" className="p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Target Attendance Threshold
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Standard default is 75%. Configures all recovery calculations, risk classifications, and safe bunk limits.
            </p>
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              Current Target
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={50}
                max={100}
                value={effectiveTarget}
                onChange={(e) => setTargetInput(Number(e.target.value))}
                className="w-20 px-3 py-1.5 rounded-xl glass-input text-lg font-bold text-cyan-400 text-center focus:outline-cyan-400"
              />
              <span className="font-bold text-slate-400">%</span>
            </div>
          </div>

          <input
            type="range"
            min={50}
            max={95}
            step={1}
            value={effectiveTarget}
            onChange={(e) => setTargetInput(Number(e.target.value))}
            className="w-full accent-cyan-400 cursor-pointer"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>50% (Lenient)</span>
            <span>75% (Standard University Requirement)</span>
            <span>90% (Honors / Strict)</span>
          </div>

          <div className="flex items-center justify-end pt-2">
            <GlassButton
              variant="primary"
              size="sm"
              icon={savedSuccess ? <Check className="w-4 h-4 text-emerald-400" /> : <Save className="w-4 h-4 text-cyan-400" />}
              onClick={handleSaveTarget}
            >
              {savedSuccess ? "Target Saved!" : "Save New Target"}
            </GlassButton>
          </div>
        </div>
      </GlassCard>

      {/* Visual Spatial Appearance */}
      <GlassCard variant="default" className="p-8 space-y-6">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            Visual Spatial Theme
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Choose between Flagship Smoked Architectural Charcoal or Crisp Clear Optical Glass.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setTheme("dark")}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
              theme === "dark"
                ? "bg-cyan-500/10 border-cyan-500 shadow-lg shadow-cyan-500/10 ring-1 ring-cyan-500/30"
                : "glass-card border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20"
            }`}
          >
            <Moon className="w-6 h-6 text-cyan-600 dark:text-cyan-400 mb-3" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Dark Mode (Flagship)</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Smoked charcoal glass, physical spatial depth, near-black architecture.
            </p>
          </button>

          <button
            onClick={() => setTheme("light")}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer ${
              theme === "light"
                ? "bg-amber-500/10 border-amber-500 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30"
                : "glass-card border-black/5 dark:border-white/5 hover:border-black/20 dark:hover:border-white/20"
            }`}
          >
            <Sun className="w-6 h-6 text-amber-500 mb-3" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">Light Mode</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Architectural alabaster, clear optical glass, diffuse soft shadows.
            </p>
          </button>
        </div>
      </GlassCard>

      {/* Data Management & Session Reset */}
      <GlassCard variant="default" className="p-8 space-y-4 border-rose-500/20">
        <div>
          <h3 className="text-lg font-bold text-rose-500 mb-1">
            Clear Account Attendance Data
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Purge cached local attendance marks, timetable schedules, and start with a fresh blank state.
          </p>
        </div>

        <GlassButton
          variant="danger"
          size="sm"
          icon={<RotateCcw className="w-4 h-4" />}
          onClick={() => {
            if (confirm("Are you sure you want to clear your local attendance data and cached sessions?")) {
              resetToDemoData();
              alert("Data cleared to clean fresh state.");
            }
          }}
        >
          Clear All Attendance Data
        </GlassButton>
      </GlassCard>
    </div>
  );
}
