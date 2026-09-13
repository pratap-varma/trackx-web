"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Subject } from "@/types/trackx";
import { useTrackX } from "@/context/TrackXContext";
import {
  calculateAttendancePercentage,
  calculateIfAttend,
  calculateIfBunk,
  generateAttendanceInsight,
  getRiskStatus,
} from "@/lib/attendanceMath";
import { CheckCircle2, XCircle, AlertCircle, X, Sparkles, Trash2 } from "lucide-react";
import { AttendanceBadge } from "@/components/ui/AttendanceBadge";

interface AttendanceActionSheetProps {
  subject: Subject | null;
  isOpen: boolean;
  onClose: () => void;
  periodNumber?: number;
}

export const AttendanceActionSheet: React.FC<AttendanceActionSheetProps> = ({
  subject,
  isOpen,
  onClose,
  periodNumber,
}) => {
  const { markAttendance, unmarkAttendance, user } = useTrackX();

  if (!subject) return null;

  const attended = subject.presentClasses;
  const conducted = subject.presentClasses + subject.absentClasses;
  const target = subject.targetAttendance || user?.globalTarget || 75;

  const currentPct = calculateAttendancePercentage(attended, conducted);
  const presentPct = calculateIfAttend(attended, conducted, 1);
  const absentPct = calculateIfBunk(attended, conducted, 1);

  const currentStatus = getRiskStatus(currentPct, target);

  const insight = generateAttendanceInsight(attended, conducted, target);

  const handleMark = (status: "present" | "absent") => {
    markAttendance(subject.id, status, periodNumber);
    onClose();
  };

  const handleUnmark = () => {
    unmarkAttendance(subject.id, new Date(), periodNumber);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4">
          {/* Smoked Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-md transition-opacity"
          />

          {/* Modal / Bottom Sheet Card */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl glass-panel p-6 sm:p-8 z-10 border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden"
          >
            {/* Top specularity bar */}
            <div className="w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-6 sm:hidden" />

            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs uppercase font-semibold tracking-wider text-slate-400">
                    {subject.code || "Course"} • Period {periodNumber || "Session"}
                  </span>
                  <AttendanceBadge status={currentStatus} percentage={currentPct} showText={false} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  {subject.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Faculty: {subject.facultyName}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current State & Stats Strip */}
            <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/10 mb-6 text-center">
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Current</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{currentPct}%</p>
                <p className="text-[10px] text-slate-400">({attended}/{conducted})</p>
              </div>
              <div className="border-x border-white/10">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Target</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{target}%</p>
                <p className="text-[10px] text-slate-400">Benchmark</p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Status</p>
                <p className="text-sm font-semibold capitalize mt-1" style={{ color: currentStatus === "healthy" ? "#00F2FE" : currentStatus === "attention" ? "#F59E0B" : "#F43F5E" }}>
                  {currentStatus}
                </p>
              </div>
            </div>

            {/* Real-time What-If Projection Simulator */}
            <div className="mb-6">
              <p className="text-xs uppercase font-medium tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Live Projection (What-If Simulation)
              </p>

              <div className="grid grid-cols-2 gap-3">
                {/* If Marked Present */}
                <div className="p-3.5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 dark:bg-cyan-500/10 transition-all">
                  <div className="flex items-center justify-between text-xs text-cyan-600 dark:text-cyan-400 font-medium mb-1">
                    <span>If Present</span>
                    <span className="text-[10px] opacity-80">+{1} class</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{presentPct}%</span>
                    <span className="text-xs text-cyan-500 font-semibold">
                      (+{(presentPct - currentPct).toFixed(1)}%)
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {attended + 1}/{conducted + 1} classes
                  </p>
                </div>

                {/* If Marked Absent */}
                <div className="p-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/5 dark:bg-rose-500/10 transition-all">
                  <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400 font-medium mb-1">
                    <span>If Absent</span>
                    <span className="text-[10px] opacity-80">Missed</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-slate-900 dark:text-white">{absentPct}%</span>
                    <span className="text-xs text-rose-500 font-semibold">
                      ({(absentPct - currentPct).toFixed(1)}%)
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {attended}/{conducted + 1} classes
                  </p>
                </div>
              </div>
            </div>

            {/* AI Guidance Box */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-6 text-indigo-900 dark:text-indigo-200">
              <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed font-medium">
                {insight}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleMark("present")}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-lg shadow-cyan-500/25 transition-all skeuo-press cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Mark Present
                </button>

                <button
                  onClick={() => handleMark("absent")}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-600 dark:text-rose-400 border border-rose-500/30 font-semibold transition-all skeuo-press cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  Mark Absent
                </button>
              </div>

              <button
                type="button"
                onClick={handleUnmark}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-500/10 hover:bg-rose-500/15 text-slate-600 dark:text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 border border-slate-500/20 hover:border-rose-500/30 text-xs font-semibold transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete / Clear Marked Attendance</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
