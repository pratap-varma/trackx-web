"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTrackX } from "@/context/TrackXContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { AttendanceBadge } from "@/components/ui/AttendanceBadge";
import { AttendanceActionSheet } from "@/components/attendance/AttendanceActionSheet";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Flame,
  AlertTriangle,
  Sparkles,
  Calendar,
  Trash2,
} from "lucide-react";

export default function SubjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { subjects, subjectMetrics, records, deleteSubject, deleteAttendanceRecord, isLoading } = useTrackX();
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  const subjectId = params.id as string;
  const subject = subjects.find((s) => s.id === subjectId);
  const met = subject ? subjectMetrics[subject.id] : null;

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto py-20 flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 p-0.5 animate-pulse">
          <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center font-bold text-white text-xs">
            TX
          </div>
        </div>
        <p className="text-xs text-slate-400">Loading course telemetry...</p>
      </div>
    );
  }

  if (!subject || !met) {
    return (
      <div className="max-w-md mx-auto py-20 text-center">
        <GlassCard variant="default" className="p-8 text-center space-y-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Subject Not Found</h2>
          <p className="text-xs text-slate-400">
            This course record does not exist or was removed from your curriculum.
          </p>
          <Link href="/subjects" className="inline-block pt-2">
            <GlassButton variant="primary" size="sm">
              Return to Subjects Directory
            </GlassButton>
          </Link>
        </GlassCard>
      </div>
    );
  }

  // Records for this subject
  const subjectRecords = records.filter((r) => r.subjectId === subject.id);

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete ${subject.name}?`)) {
      deleteSubject(subject.id);
      router.push("/subjects");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Top Breadcrumb & Controls */}
      <div className="flex items-center justify-between">
        <Link
          href="/subjects"
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Subjects
        </Link>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
        >
          <Trash2 className="w-4 h-4" /> Delete Course
        </button>
      </div>

      {/* Course Header Banner */}
      <GlassCard variant="elevated" className="p-8">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                {subject.code || "Course"} • {subject.type}
              </span>
              <AttendanceBadge status={met.riskStatus} percentage={met.percentage} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {subject.name}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Faculty: <strong className="text-slate-900 dark:text-white">{subject.facultyName}</strong> • Credits: {subject.credits || 3}
            </p>
          </div>

          <GlassButton
            variant="primary"
            icon={<CheckCircle2 className="w-4 h-4 text-cyan-400" />}
            onClick={() => setIsActionSheetOpen(true)}
          >
            Log Attendance
          </GlassButton>
        </div>

        {/* Intelligence Alert Banner */}
        <div className="mt-8 p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-indigo-400">
              TrackX Academic Decision Advice
            </p>
            <p className="text-sm text-indigo-200 mt-0.5 leading-relaxed font-medium">
              {met.insightText}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Deep Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <GlassCard variant="default" className="p-6">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Attendance Ratio</span>
            <Calendar className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {met.attended} <span className="text-base text-slate-400 font-normal">/ {met.conducted}</span>
          </p>
          <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 mt-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-400"
              style={{ width: `${Math.min(met.percentage, 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Missed {met.conducted - met.attended} lectures so far
          </p>
        </GlassCard>

        <GlassCard variant="default" className="p-6">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Safe Skips</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {met.safeBunks}
          </p>
          <p className="text-xs text-slate-400 mt-3">
            Can safely miss while staying above {met.target}%
          </p>
        </GlassCard>

        <GlassCard variant="default" className="p-6">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Consecutive Recovery</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white">
            {met.requiredRecovery}
          </p>
          <p className="text-xs text-slate-400 mt-3">
            Next classes you must attend to achieve {met.target}%
          </p>
        </GlassCard>
      </div>

      {/* Attendance History for this Course */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
          Session History
        </h3>

        {subjectRecords.length === 0 ? (
          <GlassCard className="p-8 text-center text-slate-400 text-sm">
            No specific session logs recorded yet for {subject.name}. Click &quot;Log Attendance&quot; above to log a session.
          </GlassCard>
        ) : (
          <div className="divide-y divide-black/5 dark:divide-white/10 rounded-2xl glass-card overflow-hidden">
            {subjectRecords.map((rec) => (
              <div key={rec.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {rec.status === "present" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {rec.status === "present" ? "Attended Session" : "Missed Session"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(rec.date).toLocaleDateString()} • Period {rec.periodNumber || 1}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
                      rec.status === "present"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}
                  >
                    {rec.status}
                  </span>
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to delete this marked attendance session?")) {
                        deleteAttendanceRecord(rec.id);
                      }
                    }}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Delete marked attendance session"
                    aria-label="Delete marked attendance session"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Bottom Sheet */}
      <AttendanceActionSheet
        subject={subject}
        isOpen={isActionSheetOpen}
        onClose={() => setIsActionSheetOpen(false)}
      />
    </div>
  );
}
