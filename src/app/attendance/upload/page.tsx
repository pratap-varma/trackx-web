"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTrackX } from "@/context/TrackXContext";
import { apiClient } from "@/lib/apiClient";
import { findMatchingSubject, isLabSubject } from "@/lib/subjectMatcher";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
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
  Plus,
} from "lucide-react";

interface ExtractedItem {
  id: string;
  name: string;
  code: string;
  faculty: string;
  attended: number | null;
  conducted: number | null;
  percentage: number | null;
  percentageOnly?: boolean;
}

export default function AttendanceUploadPage() {
  const router = useRouter();
  const {
    addSubject,
    updateSubject,
    user,
    subjects,
    timetable,
    generateTimetableFromSubjects,
    updateUserProfile,
  } = useTrackX();
  const [step, setStep] = useState<"upload" | "scanning" | "review">("upload");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number>(0);
  const [overall, setOverall] = useState<{
    attended: number | null;
    conducted: number | null;
    percentage: number | null;
  } | null>(null);

  // Extracted subjects state for review
  const [extractedData, setExtractedData] = useState<ExtractedItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Check if attendance baseline has already been imported
  const isAlreadyExtracted = Boolean(
    user?.onboardingState?.attendanceBaselineCompleted ||
    (subjects.length > 0 && subjects.some((s) => s.baselinePercentage != null || (s.presentClasses + s.absentClasses > 0)))
  );

  // File input refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const processFile = async (file: File) => {
    if (!file) return;

    // Validate client-side format
    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setErrorMessage("Please upload a supported image format (PNG, JPEG, WebP, or HEIC).");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("File size exceeds 10MB limit. Please upload a smaller screenshot.");
      return;
    }

    setErrorMessage(null);
    setStep("scanning");

    try {
      // Real server-side Gemini Vision OCR call
      const data = await apiClient.extractAttendance(file);

      const items: ExtractedItem[] = (data.subjects || []).map((s, idx) => ({
        id: `ocr-${idx + 1}-${Date.now()}`,
        name: s.subjectName || `Subject ${idx + 1}`,
        code: s.subjectCode || "",
        faculty: s.faculty || "Department Faculty",
        attended: s.attended,
        conducted: s.conducted,
        percentage: s.percentage,
        percentageOnly: s.attended === null || s.conducted === null,
      }));

      setExtractedData(items);
      setWarnings(data.warnings || []);
      setConfidence(data.confidence || 0);
      setOverall(data.overall || null);
      setStep("review");
    } catch (err: unknown) {
      console.error("Attendance extraction failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to extract attendance records from image.";
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

  const handleUpdateItem = (
    id: string,
    field: "attended" | "conducted" | "name" | "code" | "faculty",
    val: string | number
  ) => {
    setExtractedData((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: val };

        if (field === "attended" || field === "conducted") {
          const att = typeof updated.attended === "number" ? updated.attended : 0;
          const cond = typeof updated.conducted === "number" ? updated.conducted : 0;
          if (cond > 0) {
            updated.percentage = parseFloat(((att / cond) * 100).toFixed(1));
            updated.percentageOnly = false;
          }
        }
        return updated;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setExtractedData((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddItem = () => {
    const newItem: ExtractedItem = {
      id: `manual-${Date.now()}`,
      name: "New Subject",
      code: "",
      faculty: "Department Faculty",
      attended: 0,
      conducted: 0,
      percentage: 0,
      percentageOnly: false,
    };
    setExtractedData((prev) => [...prev, newItem]);
  };

  const loadExistingSubjectsForReview = () => {
    if (subjects.length > 0) {
      const items: ExtractedItem[] = subjects.map((s) => {
        const attended = s.presentClasses ?? 0;
        const conducted = (s.presentClasses ?? 0) + (s.absentClasses ?? 0);
        return {
          id: s.id,
          name: s.name,
          code: s.code || "",
          faculty: s.facultyName || "Department Faculty",
          attended,
          conducted,
          percentage: s.baselinePercentage ?? (conducted > 0 ? parseFloat(((attended / conducted) * 100).toFixed(1)) : 0),
          percentageOnly: false,
        };
      });
      setExtractedData(items);
    } else {
      setExtractedData([
        {
          id: `manual-${Date.now()}`,
          name: "Subject 1",
          code: "",
          faculty: "Department Faculty",
          attended: 0,
          conducted: 0,
          percentage: 0,
          percentageOnly: false,
        },
      ]);
    }
    setStep("review");
  };

  const handleConfirmBaseline = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      let currentSubjects = [...subjects];

      for (const item of extractedData) {
        if (!item.name.trim()) continue;

        const hasCounts = typeof item.attended === "number" && typeof item.conducted === "number";
        const attended = hasCounts ? Math.max(0, item.attended!) : 0;
        const conducted = hasCounts ? Math.max(0, item.conducted!) : 0;
        const isLab = isLabSubject(item.name, undefined, item.code);

        // Intelligently find if a subject with this name/code/acronym already exists
        const matched = findMatchingSubject(
          { name: item.name.trim(), code: item.code.trim(), type: isLab ? "Laboratory" : "Theory" },
          currentSubjects
        );

        if (matched) {
          // Update existing subject without creating duplicate files/tiles!
          const updates = {
            presentClasses: attended,
            absentClasses: Math.max(0, conducted - attended),
            baselinePercentage: item.percentage,
            countsUnavailable: !hasCounts,
            // Upgrade short name if attendance report provided full title (e.g. "OS" -> "Operating Systems")
            ...(item.name.trim().length > matched.name.length && !/^[A-Z0-9\s]{1,6}$/.test(item.name.trim())
              ? { name: item.name.trim(), code: matched.code || item.code.trim() || undefined }
              : {}),
            ...(item.faculty && item.faculty !== "Department Faculty" && (!matched.facultyName || matched.facultyName === "Faculty")
              ? { facultyName: item.faculty }
              : {}),
          };
          await updateSubject(matched.id, updates);
          currentSubjects = currentSubjects.map((s) => (s.id === matched.id ? { ...s, ...updates } : s));
        } else {
          // Genuinely new subject
          const newSub = await addSubject({
            semesterId: "sem-fall-2026",
            name: item.name.trim() || "Untitled Subject",
            code: item.code.trim() || undefined,
            facultyName: item.faculty.trim() || "Faculty",
            colorValue: isLab ? "#A855F7" : "#00F2FE",
            type: isLab ? "Laboratory" : "Theory",
            targetAttendance: user?.globalTarget || 75,
            presentClasses: attended,
            absentClasses: Math.max(0, conducted - attended),
            baselinePercentage: item.percentage,
            countsUnavailable: !hasCounts,
            status: "Active",
          });
          if (newSub) {
            currentSubjects.push(newSub);
          }
        }
      }

      // If user doesn't have timetable entries yet, auto-schedule so timetable and attendance calendar populate immediately!
      if (timetable.length === 0 && currentSubjects.length > 0) {
        await generateTimetableFromSubjects(currentSubjects);
      }

      await updateUserProfile({
        onboardingCompleted: true,
        onboardingState: {
          profileCompleted: true,
          attendanceBaselineCompleted: true,
          timetableCompleted: user?.onboardingState?.timetableCompleted || false,
          completed: true,
          currentStep: user?.onboardingState?.timetableCompleted ? "complete" : "timetable",
        },
      });

      setIsUpdating(false);
      router.push("/attendance");
    } catch (err) {
      console.error("Failed to save subjects to Firestore:", err);
      // Even if remote sync experiences an error, ensure user is redirected since local state was committed
      setIsUpdating(false);
      router.push("/attendance");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Hidden file inputs */}
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
          href="/attendance"
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Attendance
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/timetable/upload"
            className="text-xs font-semibold text-slate-400 hover:text-cyan-400 transition-colors"
          >
            Upload Timetable →
          </Link>
          <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Step {step === "upload" ? "1/3" : step === "scanning" ? "2/3" : "3/3"}
          </span>
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          Intelligent Attendance Scanner
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Upload an official portal screenshot or attendance ledger. Real Gemini Vision AI extracts verifiable counts.
        </p>
      </div>

      {/* Error alert */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-sm text-rose-300">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isAlreadyExtracted && !isUpdating ? (
        <GlassCard className="p-8 sm:p-10 text-center space-y-6 max-w-xl mx-auto border-emerald-500/30 bg-emerald-950/10 shadow-[0_8px_32px_rgba(16,185,129,0.1)]">
          <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              ✓ Already extracted
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Attendance Baseline</h2>
            <p className="text-sm text-slate-400 dark:text-slate-300">
              Your attendance baseline has already been imported and confirmed.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href="/attendance" className="w-full sm:w-auto">
              <GlassButton variant="primary" className="w-full">
                View Attendance
              </GlassButton>
            </Link>
            <GlassButton
              variant="secondary"
              className="w-full sm:w-auto border-white/20 hover:border-emerald-400/50"
              onClick={() => {
                setIsUpdating(true);
                loadExistingSubjectsForReview();
              }}
            >
              Update Attendance
            </GlassButton>
          </div>
        </GlassCard>
      ) : (
        <>
          {isUpdating && (
            <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between gap-3 text-cyan-300">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-semibold">
                  Updating Attendance Baseline. Upload a new screenshot to review before replacing.
                </span>
              </div>
              <button
                onClick={() => {
                  setIsUpdating(false);
                  setStep("upload");
                  setExtractedData([]);
                }}
                className="px-3 py-1 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* Step 1: Upload Surface */}
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
                  className="border-2 border-dashed border-black/15 dark:border-white/15 hover:border-cyan-500/50 rounded-3xl p-12 text-center glass-panel cursor-pointer group transition-all"
                >
                  <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 text-cyan-500 group-hover:scale-110 flex items-center justify-center mx-auto mb-4 transition-transform shadow-lg shadow-cyan-500/10">
                    <UploadCloud className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">
                    Drop your attendance screenshot here
                  </h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
                    Supports PNG, JPEG, WebP, or HEIC portal captures from ERP systems, student dashboards, or university ledgers.
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
                      icon={<FileImage className="w-4 h-4 text-cyan-400" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Browse Files
                    </GlassButton>
                    <GlassButton
                      size="sm"
                      variant="secondary"
                      icon={<Plus className="w-4 h-4 text-cyan-400" />}
                      onClick={(e) => {
                        e.stopPropagation();
                        loadExistingSubjectsForReview();
                      }}
                    >
                      Enter Manually
                    </GlassButton>
                  </div>
                </div>

            {/* Strict TrackX Principle Banner */}
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  Mathematical Integrity Guarantee
                </p>
                <p className="text-xs text-indigo-200 mt-0.5 leading-relaxed">
                  TrackX never invents attended/conducted counts from naked percentages. If your screenshot only contains percentages without counts, you will be invited to enter the actual numbers for accurate safe bunk & recovery calculations.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Step 2: Real AI Scanning State */}
        {step === "scanning" && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="space-y-6 text-center"
          >
            <GlassCard variant="elevated" className="p-12 relative overflow-hidden">
              {/* Laser Scan Animation Line */}
              <motion.div
                animate={{ top: ["0%", "100%", "0%"] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#00F2FE] pointer-events-none"
              />

              <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-6">
                <ScanLine className="w-10 h-10 animate-pulse" />
              </div>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                Analyzing Attendance Records with Gemini Vision...
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
                Detecting subject rows, parsing course codes, and extracting verified conducted and attended integers.
              </p>

              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-cyan-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing image securely on server...
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* Step 3: Attendance Review & Verification */}
        {step === "review" && (
          <motion.div
            key="review"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* Status Banner */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-300 font-medium">
                  Gemini Vision extraction complete ({extractedData.length} subjects detected, {Math.round(confidence * 100)}% confidence). Review and verify counts before committing.
                </p>
              </div>
              <GlassButton size="sm" variant="secondary" onClick={handleAddItem} icon={<Plus className="w-3.5 h-3.5" />}>
                Add Subject
              </GlassButton>
            </div>

            {/* Warnings display */}
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

            {/* Overall Portal Stats if detected */}
            {overall && (overall.percentage !== null || overall.attended !== null) && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Detected Overall Portal Attendance
                  </span>
                  <p className="text-sm font-semibold text-slate-200">
                    {overall.attended !== null && overall.conducted !== null
                      ? `${overall.attended} / ${overall.conducted} classes attended`
                      : "Aggregate percentage detected"}
                  </p>
                </div>
                {overall.percentage !== null && (
                  <span className="text-xl font-extrabold text-cyan-400">
                    {overall.percentage.toFixed(1)}%
                  </span>
                )}
              </div>
            )}

            {/* Extracted Subject List */}
            <div className="space-y-4">
              {extractedData.length === 0 ? (
                <div className="p-8 text-center glass-card rounded-2xl text-slate-400 text-sm">
                  No subject rows were clearly detected in the image. You can click &quot;Add Subject&quot; to enter them manually, or re-upload a clearer screenshot.
                </div>
              ) : (
                extractedData.map((item) => {
                  const percentageDisplay =
                    item.percentage !== null
                      ? item.percentage.toFixed(1)
                      : typeof item.conducted === "number" && item.conducted > 0 && typeof item.attended === "number"
                      ? ((item.attended / item.conducted) * 100).toFixed(1)
                      : "--";

                  return (
                    <GlassCard key={item.id} variant="default" className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.code}
                              placeholder="CODE"
                              onChange={(e) => handleUpdateItem(item.id, "code", e.target.value)}
                              className="w-24 px-2 py-0.5 rounded-lg bg-black/10 dark:bg-white/10 border border-white/10 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 focus:outline-cyan-400"
                            />
                            <input
                              type="text"
                              value={item.name}
                              placeholder="Subject Name"
                              onChange={(e) => handleUpdateItem(item.id, "name", e.target.value)}
                              className="flex-1 px-2 py-0.5 rounded-lg bg-transparent border-b border-white/10 text-sm font-bold text-slate-900 dark:text-white focus:outline-cyan-400"
                            />
                          </div>
                          <input
                            type="text"
                            value={item.faculty}
                            placeholder="Faculty Name"
                            onChange={(e) => handleUpdateItem(item.id, "faculty", e.target.value)}
                            className="w-full px-2 py-0.5 rounded-lg bg-transparent text-xs text-slate-500 dark:text-slate-400 focus:outline-cyan-400"
                          />
                        </div>

                        {/* Attended / Conducted Inputs */}
                        <div className="flex items-center gap-4">
                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                              Attended
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={item.attended ?? ""}
                              placeholder="--"
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                handleUpdateItem(item.id, "attended", val ?? 0);
                              }}
                              className="w-20 px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/10 border border-white/15 text-sm font-bold text-slate-900 dark:text-white text-center focus:outline-cyan-400"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                              Conducted
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={item.conducted ?? ""}
                              placeholder="--"
                              onChange={(e) => {
                                const val = e.target.value === "" ? null : parseInt(e.target.value, 10);
                                handleUpdateItem(item.id, "conducted", val ?? 0);
                              }}
                              className="w-20 px-3 py-1.5 rounded-xl bg-black/10 dark:bg-white/10 border border-white/15 text-sm font-bold text-slate-900 dark:text-white text-center focus:outline-cyan-400"
                            />
                          </div>

                          <div className="text-right min-w-[70px]">
                            <label className="text-[10px] uppercase tracking-wider text-slate-400 block mb-1">
                              Attendance
                            </label>
                            <span className="text-base font-extrabold text-cyan-400">
                              {percentageDisplay}%
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors rounded-lg"
                            title="Remove subject"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Warning if missing conducted count */}
                      {item.percentageOnly && (
                        <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-300">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>
                            Only percentage was visible in screenshot. Please enter actual Attended and Conducted counts above for accurate safe bunk calculations.
                          </span>
                        </div>
                      )}
                    </GlassCard>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <GlassButton variant="secondary" onClick={() => setStep("upload")} disabled={isSaving}>
                Upload Another
              </GlassButton>
              <GlassButton
                id="save-update-attendance-btn"
                variant="primary"
                onClick={handleConfirmBaseline}
                disabled={isSaving || extractedData.length === 0}
                icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : undefined}
              >
                {isSaving ? "Saving & Updating Attendance..." : "Save and Update Attendance"}
              </GlassButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </>
      )}
    </div>
  );
}
