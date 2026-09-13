"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTrackX } from "@/context/TrackXContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { AttendanceBadge } from "@/components/ui/AttendanceBadge";
import { AttendanceActionSheet } from "@/components/attendance/AttendanceActionSheet";
import { AddSubjectModal } from "@/components/subjects/AddSubjectModal";
import { Subject } from "@/types/trackx";
import {
  Plus,
  Search,
  ArrowUpRight,
  Trash2,
} from "lucide-react";

export default function SubjectsPage() {
  const { subjects, subjectMetrics, deleteSubject } = useTrackX();
  const [search, setSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  const filteredSubjects = subjects.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.code && s.code.toLowerCase().includes(search.toLowerCase())) ||
      s.facultyName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase font-bold tracking-widest text-indigo-400">
              Curriculum Architecture
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            <span className="text-xs text-slate-400">Active Courses</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Subjects & Modules
          </h1>
        </div>

        <GlassButton
          variant="primary"
          icon={<Plus className="w-4 h-4 text-cyan-400" />}
          onClick={() => setIsAddModalOpen(true)}
        >
          Add Course
        </GlassButton>
      </div>

      {/* Search Bar & Quick Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search subjects by name, code, or faculty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-2xl glass-input text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-cyan-400 transition-all"
          />
        </div>
      </div>

      {/* Subjects Grid */}
      {filteredSubjects.length === 0 ? (
        <GlassCard variant="default" className="p-12 text-center space-y-4 max-w-lg mx-auto my-8">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
            <Plus className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            {search ? "No matching subjects found" : "No courses registered yet"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {search
              ? `No subjects match "${search}". Try checking your spelling or clearing search filters.`
              : "Add your semester subjects to start logging attendance sessions, tracking percentage thresholds, and calculating safe bunks."}
          </p>
          {!search && (
            <GlassButton
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddModalOpen(true)}
              className="mx-auto"
            >
              Add Your First Course
            </GlassButton>
          )}
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSubjects.map((sub) => {
            const met = subjectMetrics[sub.id];
            if (!met) return null;

            return (
              <GlassCard
                key={sub.id}
                variant="interactive"
                className="p-6 flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {sub.code || "Course"}
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-slate-400">
                        {sub.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AttendanceBadge status={met.riskStatus} percentage={met.percentage} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          if (confirm(`Are you sure you want to delete ${sub.name}?`)) {
                            deleteSubject(sub.id);
                          }
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title={`Delete ${sub.name}`}
                        aria-label={`Delete ${sub.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <Link href={`/subjects/${sub.id}`}>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-cyan-400 transition-colors line-clamp-1">
                      {sub.name}
                    </h3>
                  </Link>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-6">
                    Faculty: {sub.facultyName} • {sub.credits || 3} Credits
                  </p>

                  {/* Progress Ring & Stats */}
                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Progress to Target</span>
                      <span className="font-semibold text-slate-900 dark:text-white">{met.percentage}% / {met.target}%</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full skeuo-well p-[1px] overflow-hidden border border-black/10 dark:border-white/10">
                      <div
                        className="h-full rounded-full transition-all duration-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_1px_3px_rgba(0,0,0,0.3)]"
                        style={{
                          width: `${Math.min(met.percentage, 100)}%`,
                          backgroundColor:
                            met.riskStatus === "healthy"
                              ? "#10B981"
                              : met.riskStatus === "attention"
                              ? "#F59E0B"
                              : "#F43F5E",
                        }}
                      />
                    </div>
                  </div>

                  {/* Telemetry pill */}
                  <div className="p-3 rounded-xl skeuo-well border border-black/10 dark:border-white/5 text-xs text-slate-400 flex items-center justify-between">
                    <span>
                      Sessions: <strong className="text-slate-900 dark:text-white font-mono">{met.conducted > 0 ? `${met.attended}/${met.conducted}` : (sub.baselinePercentage != null ? "Baseline % only" : "0/0")}</strong>
                    </span>
                    <span
                      className="font-bold flex items-center gap-1.5"
                      style={{
                        color: met.percentage >= met.target ? "#10B981" : "#F43F5E",
                      }}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          met.percentage >= met.target ? "skeuo-led-green" : "skeuo-led-coral"
                        }`}
                      />
                      <span>{met.conducted > 0 ? (met.percentage >= met.target ? `${met.safeBunks} Safe Skips` : `${met.requiredRecovery} Needed`) : (met.percentage >= met.target ? "Target Met" : `${met.percentage}% Baseline`)}</span>
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-5 border-t border-black/5 dark:border-white/10 mt-6">
                  <Link
                    href={`/subjects/${sub.id}`}
                    className="text-xs font-semibold text-cyan-500 hover:text-cyan-400 flex items-center gap-1 transition-colors"
                  >
                    Intelligence Profile <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                  <GlassButton
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setSelectedSubject(sub);
                      setIsActionSheetOpen(true);
                    }}
                  >
                    Log
                  </GlassButton>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Add Subject & Timetable Schedule Modal */}
      <AddSubjectModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
      />

      {/* Attendance Action Bottom Sheet */}
      <AttendanceActionSheet
        subject={selectedSubject}
        isOpen={isActionSheetOpen}
        onClose={() => setIsActionSheetOpen(false)}
      />
    </div>
  );
}
