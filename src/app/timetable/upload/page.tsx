"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTrackX } from "@/context/TrackXContext";
import { apiClient } from "@/lib/apiClient";
import { findMatchingSubject, isNonAcademicSubject } from "@/lib/subjectMatcher";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { TimetableEntry } from "@/types/trackx";
import {
  UploadCloud,
  Camera,
  FileImage,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowLeft,
  ScanLine,
  Loader2,
  Trash2,
  Clock,
  BookOpen,
} from "lucide-react";

interface ExtractedEntryItem {
  id: string;
  day: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  startTimeMinutes: number;
  endTimeMinutes: number;
  durationMinutes: number;
  isContinuous: boolean;
  isContinuousLab?: boolean;
  subjectCode: string;
  subjectName: string;
  displayName?: string;
  faculty: string;
  location: string;
  classType: "lecture" | "lab" | "activity" | "training" | "other";
  type: "lecture" | "lab" | "break" | "lunch" | "free" | "activity" | "other";
  confidence: number;
  warnings: string[];
  requiresReview: boolean;
  possibleSubjects?: string[];
  assignedSubjectId?: string; // ID of existing subject, or "__new__", or "__skip__"
}

// Sunday is universally a holiday for all colleges; timetable days are Mon-Sat
const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function TimetableUploadPage() {
  const router = useRouter();
  const { batchSaveTimetable, subjects, addSubject, updateSubject, user, timetable, updateUserProfile } = useTrackX();
  const [step, setStep] = useState<"upload" | "scanning" | "review">("upload");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [extractedEntries, setExtractedEntries] = useState<ExtractedEntryItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const processFile = async (file: File) => {
    if (!file) return;

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMessage("Please upload a supported image format (PNG, JPEG, WebP, or HEIC).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("File size exceeds 10MB limit. Please upload a smaller timetable screenshot.");
      return;
    }

    setErrorMessage(null);
    setStep("scanning");

    try {
      // Real server-side Gemini Vision OCR call with spatial grid and subject mapping
      const data = await apiClient.extractTimetable(file);

      const items: ExtractedEntryItem[] = (data.entries || []).map((e, idx) => {
        const isNonAcad = isNonAcademicSubject(e.subjectName, e.classType, e.type);
        const isLab = Boolean(e.isContinuousLab || e.classType === "lab" || e.type === "lab");
        let assignedSubjectId = "__new__";
        let resolvedName = e.subjectName || `Period ${idx + 1}`;

        if (isNonAcad) {
          assignedSubjectId = "__skip__";
        } else {
          // Intelligently auto-match against user's existing subjects
          const matched = findMatchingSubject(
            { name: e.subjectName, code: e.subjectCode || undefined, type: isLab ? "Laboratory" : "Theory" },
            subjects
          );
          if (matched) {
            assignedSubjectId = matched.id;
            if (e.subjectName.length <= 6 && matched.name.length > 6) {
              resolvedName = matched.name;
            }
          }
        }

        return {
          id: `ocr-tt-${idx + 1}-${Date.now()}`,
          day: e.day,
          dayOfWeek: e.dayOfWeek,
          startTime: e.startTime,
          endTime: e.endTime,
          startTimeMinutes: e.startTimeMinutes,
          endTimeMinutes: e.endTimeMinutes,
          durationMinutes: e.durationMinutes || (e.endTimeMinutes - e.startTimeMinutes) || 60,
          isContinuous: Boolean(e.isContinuous || e.isContinuousLab || (e.endTimeMinutes - e.startTimeMinutes) >= 90),
          isContinuousLab: Boolean(e.isContinuousLab || (e.classType === "lab" && (e.endTimeMinutes - e.startTimeMinutes) >= 90)),
          subjectCode: e.subjectCode || "",
          subjectName: resolvedName,
          displayName: e.displayName || resolvedName,
          faculty: e.faculty || "",
          location: e.location || "",
          classType: e.classType || (e.type === "lab" ? "lab" : "lecture"),
          type: e.type || (e.classType === "lab" ? "lab" : "lecture"),
          confidence: e.confidence ?? 0.9,
          warnings: e.warnings || [],
          requiresReview: Boolean(e.requiresReview),
          possibleSubjects: e.possibleSubjects || [],
          assignedSubjectId,
        };
      });

      setExtractedEntries(items);
      setWarnings(data.warnings || []);
      setStep("review");
    } catch (err: unknown) {
      console.error("Timetable extraction failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to extract timetable schedule from image.";
      setErrorMessage(msg);
      setStep("upload");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleUpdateEntry = (
    id: string,
    field: keyof ExtractedEntryItem,
    val: string | number | boolean
  ) => {
    setExtractedEntries((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };

        if (field === "day") {
          const idx = WEEKDAY_NAMES.indexOf(String(val));
          if (idx !== -1) updated.dayOfWeek = idx + 1;
        }

        if (field === "startTime" && typeof val === "string") {
          const parts = val.split(":");
          if (parts.length === 2) {
            updated.startTimeMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
            updated.durationMinutes = updated.endTimeMinutes - updated.startTimeMinutes;
            updated.isContinuous = updated.durationMinutes >= 90;
          }
        }

        if (field === "endTime" && typeof val === "string") {
          const parts = val.split(":");
          if (parts.length === 2) {
            updated.endTimeMinutes = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
            updated.durationMinutes = updated.endTimeMinutes - updated.startTimeMinutes;
            updated.isContinuous = updated.durationMinutes >= 90;
          }
        }

        if (field === "classType") {
          updated.type = val === "lab" ? "lab" : val === "other" ? "other" : "lecture";
          updated.isContinuousLab = updated.isContinuous && val === "lab";
        }

        return updated;
      })
    );
  };

  const handleBatchAssignSubject = (sourceKey: string, targetSubjectId: string) => {
    setExtractedEntries((prev) =>
      prev.map((item) => {
        const matches =
          (item.subjectCode && item.subjectCode.toLowerCase() === sourceKey.toLowerCase()) ||
          item.subjectName.toLowerCase() === sourceKey.toLowerCase();
        if (matches) {
          const matchedSub = subjects.find((s) => s.id === targetSubjectId);
          return {
            ...item,
            assignedSubjectId: targetSubjectId,
            ...(matchedSub ? { subjectName: matchedSub.name, ...(matchedSub.code ? { subjectCode: matchedSub.code } : {}) } : {}),
          };
        }
        return item;
      })
    );
  };

  const handleResolveAmbiguity = (id: string, selectedSubject: string) => {
    setExtractedEntries((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const matched = findMatchingSubject(
          { name: selectedSubject, type: item.classType === "lab" ? "Laboratory" : "Theory" },
          subjects
        );
        return {
          ...item,
          subjectName: selectedSubject,
          assignedSubjectId: matched ? matched.id : "__new__",
          requiresReview: false,
          warnings: item.warnings.filter((w) => !w.includes("Ambiguous")),
        };
      })
    );
  };

  const handleRemoveEntry = (id: string) => {
    setExtractedEntries((prev) => prev.filter((item) => item.id !== id));
  };

  const handleConfirmTimetable = async () => {
    setIsSaving(true);
    try {
      const activeUid = user?.id || "default_user";
      const semesterId = "sem-fall-2026";
      const createdSubjectMap = new Map<string, string>();

      // Populate existing subjects
      subjects.forEach((s) => {
        if (s.code) createdSubjectMap.set(s.code.toUpperCase(), s.id);
        createdSubjectMap.set(s.name.toLowerCase(), s.id);
      });

      // Group valid entries by dayOfWeek and sort by startTimeMinutes
      const entriesByDay: Record<number, ExtractedEntryItem[]> = {};
      extractedEntries.forEach((item) => {
        // STRICT RULE: Sunday is universally a holiday for all colleges. Never create classes on Sunday!
        if (item.dayOfWeek === 7 || item.day.toLowerCase() === "sunday") {
          return;
        }

        // STRICT RULE: Exclude skipped / non-academic entries (lunch, student activities, etc.)
        if (
          item.assignedSubjectId === "__skip__" ||
          isNonAcademicSubject(item.subjectName, item.classType, item.type)
        ) {
          return;
        }

        if (!entriesByDay[item.dayOfWeek]) {
          entriesByDay[item.dayOfWeek] = [];
        }
        entriesByDay[item.dayOfWeek].push(item);
      });

      const finalTimetableEntries: TimetableEntry[] = [];
      const newSubjectCache = new Map<string, string>();

      for (const dayOfWeekStr of Object.keys(entriesByDay)) {
        const dayOfWeek = parseInt(dayOfWeekStr, 10);
        const dayItems = entriesByDay[dayOfWeek].sort((a, b) => a.startTimeMinutes - b.startTimeMinutes);

        for (let pIdx = 0; pIdx < dayItems.length; pIdx++) {
          const item = dayItems[pIdx];
          const periodNumber = pIdx + 1; // Real 1-indexed period per day (P1, P2, P3...)
          const isLab = item.classType === "lab" || item.type === "lab" || Boolean(item.isContinuousLab);

          let targetSubjectId: string | undefined = undefined;

          if (item.assignedSubjectId && item.assignedSubjectId !== "__new__" && item.assignedSubjectId !== "__skip__") {
            // User confirmed assignment to an existing subject
            targetSubjectId = item.assignedSubjectId;
          } else {
            // Check cache or match existing
            const codeKey = item.subjectCode ? item.subjectCode.toUpperCase() : "";
            const nameKey = item.subjectName.toLowerCase();
            targetSubjectId = newSubjectCache.get(nameKey) || createdSubjectMap.get(codeKey) || createdSubjectMap.get(nameKey);

            if (!targetSubjectId) {
              const matched = findMatchingSubject(
                { name: item.subjectName, code: item.subjectCode, type: isLab ? "Laboratory" : "Theory" },
                subjects
              );
              if (matched) {
                targetSubjectId = matched.id;
                if (item.subjectCode) createdSubjectMap.set(codeKey, matched.id);
                createdSubjectMap.set(nameKey, matched.id);
                if (!matched.code && item.subjectCode) {
                  updateSubject(matched.id, { code: item.subjectCode }).catch(() => {});
                }
              }
            }

            // If subject truly doesn't exist, create it in Firestore
            if (!targetSubjectId) {
              const newSub = await addSubject({
                semesterId,
                name: item.subjectName,
                code: item.subjectCode || undefined,
                facultyName: item.faculty || "Faculty",
                colorValue: isLab ? "#A855F7" : "#00F2FE",
                type: isLab ? "Laboratory" : "Theory",
                targetAttendance: 75,
                presentClasses: 0,
                absentClasses: 0,
                status: "Active",
              });
              if (newSub) {
                targetSubjectId = newSub.id;
                newSubjectCache.set(nameKey, newSub.id);
                if (item.subjectCode) createdSubjectMap.set(codeKey, newSub.id);
                createdSubjectMap.set(nameKey, newSub.id);
              }
            }
          }

          if (targetSubjectId) {
            const deterministicId = `tt_${activeUid}_d${dayOfWeek}_p${periodNumber}_${targetSubjectId}`;

            const alreadyAdded = finalTimetableEntries.some(
              (e) =>
                e.dayOfWeek === dayOfWeek &&
                e.startTime === item.startTimeMinutes &&
                e.endTime === item.endTimeMinutes &&
                e.subjectId === targetSubjectId
            );

            if (!alreadyAdded) {
              finalTimetableEntries.push({
                id: deterministicId,
                userId: activeUid,
                semesterId,
                subjectId: targetSubjectId,
                dayOfWeek,
                periodNumber,
                startTime: item.startTimeMinutes,
                endTime: item.endTimeMinutes,
                room: item.location || undefined,
                notes: `${item.subjectName}${item.faculty ? ` (${item.faculty})` : ""}${item.location ? ` [${item.location}]` : ""}`,
                isContinuousLab: Boolean(item.isContinuousLab || (item.classType === "lab" && item.durationMinutes >= 90)),
                isEnabled: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
            }
          }
        }
      }

      if (finalTimetableEntries.length > 0) {
        await batchSaveTimetable(finalTimetableEntries, true);
      }

      await updateUserProfile({
        onboardingCompleted: true,
        onboardingState: {
          profileCompleted: true,
          attendanceBaselineCompleted: user?.onboardingState?.attendanceBaselineCompleted ?? true,
          timetableCompleted: true,
          completed: true,
          currentStep: "complete",
        },
      });

      router.push("/calendar?view=timetable");
    } catch (err) {
      console.error("Failed to save timetable to Firestore:", err);
      setErrorMessage("Failed to save timetable entries. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/heic"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/calendar?view=timetable"
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Timetable
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
            Step {step === "upload" ? "1/3" : step === "scanning" ? "2/3" : "3/3"}
          </span>
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Intelligent Timetable Scanner
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Upload your semester timetable screenshot. Gemini Vision extracts class periods with continuous merged-cell preservation.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-sm text-rose-300">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {timetable.length > 0 && step === "upload" && (
        <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-cyan-300">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-semibold">
              You already have {timetable.length} classes scheduled. Uploading a new timetable screenshot will allow you to review and replace your routine.
            </span>
          </div>
          <Link href="/calendar?view=timetable" className="shrink-0">
            <span className="text-xs font-bold text-cyan-400 hover:underline">
              View Current Timetable →
            </span>
          </Link>
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === "upload" && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-black/15 dark:border-white/15 hover:border-purple-500/50 rounded-3xl p-12 text-center glass-panel cursor-pointer group transition-all"
            >
              <div className="w-16 h-16 rounded-3xl bg-purple-500/10 text-purple-400 group-hover:scale-110 flex items-center justify-center mx-auto mb-4 transition-transform shadow-lg shadow-purple-500/10">
                <UploadCloud className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                Drop your timetable schedule here
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
                Supports PNG, JPEG, WebP captures from department circulars, student portals, or spreadsheet exports.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <GlassButton
                  size="sm"
                  variant="secondary"
                  icon={<Camera className="w-4 h-4" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    cameraInputRef.current?.click();
                  }}
                >
                  Use Camera
                </GlassButton>
                <GlassButton
                  size="sm"
                  variant="primary"
                  icon={<FileImage className="w-4 h-4 text-purple-400" />}
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Browse Files
                </GlassButton>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                  Merged Cell Integrity Rule
                </p>
                <p className="text-xs text-purple-200 mt-0.5 leading-relaxed">
                  2-hour continuous labs and multi-period workshops (e.g. 10:15–12:15) are preserved as single unified slots, maintaining accurate scheduling for attendance marking.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {step === "scanning" && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="space-y-6 text-center"
          >
            <GlassCard variant="elevated" className="p-12 relative overflow-hidden">
              <motion.div
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-purple-400 to-transparent shadow-[0_0_15px_#A855F7] pointer-events-none"
              />

              <div className="w-20 h-20 rounded-3xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-6">
                <ScanLine className="w-10 h-10 animate-pulse" />
              </div>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Extracting Timetable Routine with Gemini Vision...
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
                Parsing schedule grid, recognizing continuous lab slots, and classifying lecture periods.
              </p>

              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-purple-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing timetable schedule securely on server...
              </div>
            </GlassCard>
          </motion.div>
        )}

        {step === "review" && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-300 font-medium">
                Extraction complete ({extractedEntries.length} periods detected). Review your weekly schedule before committing to your calendar.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2.5 text-xs text-amber-300">
              <span className="text-base">🎉</span>
              <span>
                <strong>College Holiday Engine:</strong> Sunday is universally marked as a holiday for all colleges. All official public holidays are automatically synchronized into your timetable routine and calendar.
              </span>
            </div>

            {warnings.length > 0 && (
              <div className="space-y-2">
                {warnings.map((warn, wIdx) => (
                  <div
                    key={wIdx}
                    className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-300"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>{warn}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {extractedEntries.length === 0 ? (
                <div className="p-8 text-center glass-card rounded-2xl text-slate-400 text-sm">
                  No timetable entries were detected. Please upload a higher resolution screenshot.
                </div>
              ) : (
                extractedEntries.map((item) => (
                  <GlassCard key={item.id} variant="default" className="p-4 space-y-3">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      {/* Day, Times & Continuous Badge */}
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={item.day}
                          onChange={(e) => handleUpdateEntry(item.id, "day", e.target.value)}
                          className="px-2.5 py-1 rounded-xl bg-black/10 dark:bg-white/10 border border-white/15 text-xs font-bold text-slate-900 dark:text-white focus:outline-purple-400"
                        >
                          {WEEKDAY_NAMES.map((d) => (
                            <option key={d} value={d} className="bg-slate-900 text-white">
                              {d}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            value={item.startTime}
                            placeholder="09:15"
                            onChange={(e) => handleUpdateEntry(item.id, "startTime", e.target.value)}
                            className="w-14 px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 border border-white/10 text-xs font-mono font-bold text-center text-slate-200 focus:outline-purple-400"
                          />
                          <span>–</span>
                          <input
                            type="text"
                            value={item.endTime}
                            placeholder="10:15"
                            onChange={(e) => handleUpdateEntry(item.id, "endTime", e.target.value)}
                            className="w-14 px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 border border-white/10 text-xs font-mono font-bold text-center text-slate-200 focus:outline-purple-400"
                          />
                        </div>

                        {item.isContinuous && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            {item.durationMinutes}m Continuous
                          </span>
                        )}

                        {/lunch|break/i.test(item.subjectName) && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-500/20 text-slate-400 border border-slate-500/30">
                            Lunch Period
                          </span>
                        )}
                      </div>

                      {/* Course info (Code + Name) */}
                      <div className="flex-1 flex flex-wrap sm:flex-nowrap items-center gap-2">
                        <input
                          type="text"
                          value={item.subjectCode}
                          placeholder="CODE"
                          onChange={(e) => handleUpdateEntry(item.id, "subjectCode", e.target.value)}
                          className="w-16 px-2 py-1 rounded-lg bg-black/10 dark:bg-white/10 border border-white/10 text-[11px] font-mono font-bold uppercase text-slate-300 focus:outline-purple-400"
                        />
                        <input
                          type="text"
                          value={item.subjectName}
                          placeholder="Subject Name"
                          onChange={(e) => handleUpdateEntry(item.id, "subjectName", e.target.value)}
                          className="flex-1 min-w-[140px] px-2 py-1 rounded-lg bg-transparent border-b border-white/10 text-sm font-bold text-slate-900 dark:text-white focus:outline-purple-400"
                        />
                      </div>

                      {/* Faculty, Location & Class Type */}
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={item.faculty}
                          placeholder="Faculty"
                          onChange={(e) => handleUpdateEntry(item.id, "faculty", e.target.value)}
                          className="w-28 px-2 py-1 rounded-lg bg-transparent text-xs text-slate-400 border-b border-white/10 focus:outline-purple-400"
                        />

                        <input
                          type="text"
                          value={item.location}
                          placeholder="Room/Lab"
                          onChange={(e) => handleUpdateEntry(item.id, "location", e.target.value)}
                          className="w-20 px-2 py-1 rounded-lg bg-transparent text-xs text-cyan-400 border-b border-white/10 focus:outline-purple-400"
                        />

                        <select
                          value={item.classType}
                          onChange={(e) =>
                            handleUpdateEntry(item.id, "classType", e.target.value as ExtractedEntryItem["classType"])
                          }
                          className="px-2 py-1 rounded-lg bg-black/10 dark:bg-white/10 border border-white/10 text-xs text-slate-300 focus:outline-purple-400"
                        >
                          <option value="lecture" className="bg-slate-900">Lecture</option>
                          <option value="lab" className="bg-slate-900">Lab</option>
                          <option value="activity" className="bg-slate-900">Activity</option>
                          <option value="training" className="bg-slate-900">Training</option>
                          <option value="other" className="bg-slate-900">Other</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleRemoveEntry(item.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Subject Assignment Selector */}
                    <div className="pt-2 border-t border-black/5 dark:border-white/5 flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                        <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                          Assigned Subject:
                        </span>
                        <select
                          value={item.assignedSubjectId || "__new__"}
                          onChange={(e) => {
                            const newSubId = e.target.value;
                            handleUpdateEntry(item.id, "assignedSubjectId", newSubId);
                            if (newSubId !== "__new__" && newSubId !== "__skip__") {
                              const s = subjects.find((x) => x.id === newSubId);
                              if (s) {
                                handleUpdateEntry(item.id, "subjectName", s.name);
                                if (s.code) handleUpdateEntry(item.id, "subjectCode", s.code);
                              }
                            }
                          }}
                          className={`flex-1 min-w-[220px] px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                            item.assignedSubjectId === "__skip__"
                              ? "bg-slate-500/15 text-slate-400 border-slate-500/30"
                              : item.assignedSubjectId === "__new__"
                              ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                              : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                          }`}
                        >
                          <option value="__skip__" className="bg-slate-900 text-slate-400">
                            🚫 Non-academic (No Attendance Needed)
                          </option>
                          {subjects.length > 0 && (
                            <optgroup label="Your Existing Subjects" className="bg-slate-900 text-white font-bold">
                              {subjects.map((s) => (
                                <option key={s.id} value={s.id} className="bg-slate-900 text-slate-100 font-normal">
                                  📚 {s.name} {s.code ? `(${s.code})` : ""} [{s.type}]
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <option value="__new__" className="bg-slate-900 text-purple-300 font-bold">
                            ✨ + Create as New Course: &quot;{item.subjectName}&quot;
                          </option>
                        </select>
                      </div>

                      {/* Quick batch apply button */}
                      {item.assignedSubjectId && item.assignedSubjectId !== "__new__" && item.assignedSubjectId !== "__skip__" && (
                        <button
                          type="button"
                          onClick={() => handleBatchAssignSubject(item.subjectCode || item.subjectName, item.assignedSubjectId!)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                          title="Assign this subject to all slots with the same code or title"
                        >
                          <span>Apply to all &quot;{item.subjectCode || item.subjectName}&quot;</span>
                        </button>
                      )}
                    </div>

                    {/* Ambiguous Subject Resolution Pill Selector */}
                    {item.requiresReview && item.possibleSubjects && item.possibleSubjects.length > 0 && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-amber-300 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                          Resolve Elective / Ambiguous:
                        </span>
                        {item.possibleSubjects.map((candidate, cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() => handleResolveAmbiguity(item.id, candidate)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                              item.subjectName.toLowerCase() === candidate.toLowerCase()
                                ? "bg-purple-500 text-white shadow-sm"
                                : "bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10"
                            }`}
                          >
                            {candidate}
                          </button>
                        ))}
                      </div>
                    )}
                  </GlassCard>
                ))
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <GlassButton variant="secondary" onClick={() => setStep("upload")} disabled={isSaving}>
                Upload Another
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={handleConfirmTimetable}
                disabled={isSaving || extractedEntries.length === 0}
                icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
              >
                {isSaving ? "Saving Timetable..." : "Confirm & Import Timetable"}
              </GlassButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
