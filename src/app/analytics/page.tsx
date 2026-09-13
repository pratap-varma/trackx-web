"use client";

import React from "react";
import Link from "next/link";
import { useTrackX } from "@/context/TrackXContext";
import { SyncStatusBadge } from "@/components/ui/SyncStatusBadge";
import {
  BarChart3,
  TrendingUp,
  Flame,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function AnalyticsPage() {
  const { subjects, subjectMetrics, overallMetrics, user } = useTrackX();

  const healthyCount = subjects.filter(
    (s) => subjectMetrics[s.id]?.riskStatus === "healthy"
  ).length;
  const attentionCount = subjects.filter(
    (s) => subjectMetrics[s.id]?.riskStatus === "attention"
  ).length;
  const criticalCount = subjects.filter(
    (s) => subjectMetrics[s.id]?.riskStatus === "critical"
  ).length;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-[1.5px] text-[#908FA0] mb-1">
            ACADEMIC ATTENDANCE TELEMETRY
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-[#DEE2F4]">
            Academic Insights & Analytics
          </h1>
        </div>

        <SyncStatusBadge />
      </div>

      {/* 1. Primary Attendance KPI Strip matching TrackX */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="glass-container p-6 rounded-3xl border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#C0C1FF]">
              Overall Attendance
            </span>
            <TrendingUp className="w-4 h-4 text-[#7BD0FF]" />
          </div>
          <div className="text-3xl font-extrabold text-slate-900 dark:text-[#DEE2F4]">
            {Math.round(overallMetrics.percentage)}%
          </div>
          <div className="w-full h-2 rounded-full skeuo-well p-[1px] mt-3 overflow-hidden border border-black/10 dark:border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
              style={{ width: `${Math.min(overallMetrics.percentage, 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            {overallMetrics.percentage >= overallMetrics.target ? "Above" : "Below"} target
            benchmark of {overallMetrics.target}%
          </p>
        </div>

        <div className="glass-container p-6 rounded-3xl border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#7BD0FF]">
              Aggregated Safe Skips
            </span>
            <Flame className="w-4 h-4 text-[#7BD0FF]" />
          </div>
          <div className="text-3xl font-extrabold text-[#7BD0FF]">
            {overallMetrics.safeBunks} Classes
          </div>
          <div className="text-xs text-slate-400 mt-3">
            Permitted absences across current course load without dropping below threshold
          </div>
        </div>

        <div className="glass-container p-6 rounded-3xl border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#FF8B94]">
              Risk Distribution
            </span>
            <AlertTriangle className="w-4 h-4 text-[#FF8B94]" />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs font-bold text-[#10B981] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full skeuo-led-green" /> {healthyCount} Healthy
            </span>
            <span className="text-xs font-bold text-[#F59E0B] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full skeuo-led-amber" /> {attentionCount} Attention
            </span>
            <span className="text-xs font-bold text-[#FF8B94] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full skeuo-led-coral" /> {criticalCount} Critical
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-3">
            {subjects.length} total courses tracked in current semester
          </div>
        </div>
      </div>

      {/* 2. Subject Attendance Comparative Progress Matrix */}
      <div className="glass-container p-6 rounded-3xl border border-white/10 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-[#DEE2F4]">
              Subject Attendance Comparison
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Live percentage compared against the {overallMetrics.target}% threshold
            </p>
          </div>
          <BarChart3 className="w-5 h-5 text-[#5B5FEF]" />
        </div>

        {subjects.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-900 dark:text-[#DEE2F4]">
              No subjects registered
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Add your semester subjects to view real-time comparative attendance bars against your target threshold.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {subjects.map((sub) => {
              const met = subjectMetrics[sub.id];
              if (!met) return null;

            return (
              <div key={sub.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full shadow-[0_0_6px_currentColor]"
                      style={{ backgroundColor: sub.colorValue || "#5B5FEF", color: sub.colorValue || "#5B5FEF" }}
                    />
                    <span className="font-bold text-slate-900 dark:text-[#DEE2F4]">
                      {sub.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-mono">
                      {met.attended}/{met.conducted} classes
                    </span>
                    <span
                      className={`font-bold ${
                        met.percentage >= (sub.targetAttendance || 75)
                          ? "text-[#10B981]"
                          : met.percentage >= 65
                          ? "text-[#F59E0B]"
                          : "text-[#EF4444]"
                      }`}
                    >
                      {Math.round(met.percentage)}%
                    </span>
                  </div>
                </div>

                <div className="relative w-full h-2.5 rounded-full skeuo-well p-[1px] overflow-hidden border border-black/10 dark:border-white/10">
                  {/* Benchmark line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-cyan-400 z-10 shadow-[0_0_6px_#00F2FE]"
                    style={{ left: `${sub.targetAttendance || 75}%` }}
                  />
                  <div
                    className="h-full rounded-full transition-all duration-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                    style={{
                      width: `${Math.min(met.percentage, 100)}%`,
                      backgroundColor:
                        met.percentage >= (sub.targetAttendance || 75)
                          ? "#10B981"
                          : met.percentage >= 65
                          ? "#F59E0B"
                          : "#EF4444",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>

      {/* 3. Actionable Attendance Forecast & Safe Bunk Intelligence */}
      <div className="glass-container p-6 sm:p-7 rounded-3xl border border-white/10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-[#5B5FEF]" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-[#DEE2F4]">
                Attendance Risk & Safe Skip Forecast
              </h3>
            </div>
            <p className="text-xs text-slate-400">
              Live mathematical margin analysis across your semester coursework
            </p>
          </div>

          <Link
            href="/attendance"
            className="inline-flex items-center gap-1.5 py-2 px-3.5 rounded-xl skeuo-button-primary text-white font-bold text-xs shadow-[0_3px_0_#2E3294,0_4px_10px_rgba(79,70,229,0.35)] transition-all cursor-pointer active:translate-y-0.5"
          >
            <span>Log Daily Attendance</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Forecast KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl skeuo-card border border-black/10 dark:border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl skeuo-inset text-[#10B981] flex items-center justify-center font-extrabold text-xl shrink-0 font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
              {overallMetrics.safeBunks}
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[#10B981]">
                Total Safe Bunks
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Combined skips available without dropping below target
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl skeuo-card border border-black/10 dark:border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl skeuo-inset text-[#FF8B94] flex items-center justify-center font-extrabold text-xl shrink-0 font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
              {overallMetrics.requiredRecovery}
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[#FF8B94]">
                Classes to Recover
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Must attend consecutively to return to safe standing
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl skeuo-card border border-black/10 dark:border-white/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl skeuo-inset text-[#7BD0FF] flex items-center justify-center font-extrabold text-xl shrink-0 font-mono shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]">
              {user?.globalTarget ?? 75}%
            </div>
            <div>
              <div className="text-[10px] uppercase font-bold tracking-wider text-[#7BD0FF]">
                Target Benchmark
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                Minimum attendance requirement set for semester
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Per-Subject Margin Table */}
        <div className="space-y-3">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Course Bunk & Recovery Breakdown ({subjects.length})
          </div>

          {subjects.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center space-y-2">
              <p className="text-xs text-slate-400">
                No courses added yet. Add your semester subjects to unlock margin analytics.
              </p>
              <Link
                href="/subjects"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#5B5FEF]/20 text-[#7BD0FF] border border-[#5B5FEF]/40 hover:bg-[#5B5FEF]/30 transition-all cursor-pointer"
              >
                <span>Add Courses →</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {subjects.map((sub) => {
                const met = subjectMetrics[sub.id];
                if (!met) return null;
                const isHealthy = met.riskStatus === "healthy";
                const isCritical = met.riskStatus === "critical";

                return (
                  <div
                    key={sub.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: sub.colorValue || "#5B5FEF" }}
                        />
                        <h5 className="text-sm font-bold text-slate-900 dark:text-[#DEE2F4]">
                          {sub.name}
                        </h5>
                        {sub.code && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-400">
                            {sub.code}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        {met.attended} attended of {met.conducted} conducted • Target: {sub.targetAttendance || 75}%
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      {isHealthy ? (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Can skip {met.safeBunks} class{met.safeBunks === 1 ? "" : "es"}</span>
                          </span>
                        </div>
                      ) : isCritical ? (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>Must attend next {met.requiredRecovery} class{met.requiredRecovery === 1 ? "" : "es"}</span>
                          </span>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>On threshold boundary</span>
                          </span>
                        </div>
                      )}

                      <span
                        className={`text-sm font-extrabold font-mono min-w-[48px] text-right ${
                          met.percentage >= (sub.targetAttendance || 75)
                            ? "text-[#10B981]"
                            : met.percentage >= 65
                            ? "text-[#F59E0B]"
                            : "text-[#EF4444]"
                        }`}
                      >
                        {Math.round(met.percentage)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
