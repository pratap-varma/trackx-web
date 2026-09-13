"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { useTrackX } from "@/context/TrackXContext";
import { apiClient } from "@/lib/apiClient";
import { findMatchingSubject, isLabSubject, isNonAcademicSubject } from "@/lib/subjectMatcher";
import { TimetableEntry } from "@/types/trackx";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  UploadCloud,
  FileImage,
  Camera,
  AlertCircle,
  ScanLine,
  Loader2,
  Plus,
  Trash2,
  Clock,
  BookOpen,
  Calendar,
  User,
  RefreshCw,
} from "lucide-react";

interface ExtractedSubjectItem {
  id: string;
  name: string;
  code: string;
  faculty: string;
  attended: number | null;
  conducted: number | null;
  percentage: number | null;
  percentageOnly?: boolean;
}

interface ExtractedTimetableItem {
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

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function OnboardingPage() {
  const router = useRouter();
  const {
    user,
    updateUserProfile,
    addSubject,
    updateSubject,
    batchSaveTimetable,
    subjects,
    timetable,
    isLoading,
    authStatus,
    firestoreStatus,
    profileStatus,
    firestoreErrorMessage,
    retryFirestoreConnection,
  } = useTrackX();

  const [isRetrying, setIsRetrying] = useState(false);
  const [isUpdatingAttendance, setIsUpdatingAttendance] = useState(false);
  const [isUpdatingTimetable, setIsUpdatingTimetable] = useState(false);

  // Derive resume step strictly when profile is available
  const resumeStep = React.useMemo(() => {
    if (!user) return 1;
    const state = user.onboardingState;
    if (state?.completed || user.onboardingCompleted) return 4;
    if (state?.profileCompleted && state?.attendanceBaselineCompleted && !state?.timetableCompleted) return 3;
    if (state?.profileCompleted && !state?.attendanceBaselineCompleted) return 2;
    return 1;
  }, [user]);

  const [activeStep, setActiveStep] = useState<number | null>(null);
  const step = activeStep ?? resumeStep;
  const setStep = (s: number) => setActiveStep(s);

  // Step 1: Profile fields derived from user with local override
  const [nameInput, setNameInput] = useState<string | null>(null);
  const [branchInput, setBranchInput] = useState<string | null>(null);
  const [semesterInput, setSemesterInput] = useState<number | null>(null);
  const [globalTargetInput, setGlobalTargetInput] = useState<number | null>(null);

  const name = nameInput ?? (user?.name || "");
  const branch = branchInput ?? (user?.branch || "Computer Science & Engineering");
  const semester = semesterInput ?? (user?.semester || 1);
  const globalTarget = globalTargetInput ?? (user?.globalTarget || 75);

  const setName = (v: string) => setNameInput(v);
  const setBranch = (v: string) => setBranchInput(v);
  const setSemester = (v: number) => setSemesterInput(v);
  const setGlobalTarget = (v: number) => setGlobalTargetInput(v);

  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Step 2: Attendance extraction state
  const [attendanceSubStep, setAttendanceSubStep] = useState<"upload" | "scanning" | "review">("upload");
  const [extractedSubjects, setExtractedSubjects] = useState<ExtractedSubjectItem[]>([]);
  const [attendanceWarnings, setAttendanceWarnings] = useState<string[]>([]);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  // Step 3: Timetable extraction state
  const [timetableSubStep, setTimetableSubStep] = useState<"upload" | "scanning" | "review">("upload");
  const [extractedTimetable, setExtractedTimetable] = useState<ExtractedTimetableItem[]>([]);
  const [timetableWarnings, setTimetableWarnings] = useState<string[]>([]);
  const [timetableError, setTimetableError] = useState<string | null>(null);
  const [isSavingTimetable, setIsSavingTimetable] = useState(false);

  // File input refs
  const attendanceFileRef = useRef<HTMLInputElement | null>(null);
  const attendanceCameraRef = useRef<HTMLInputElement | null>(null);
  const timetableFileRef = useRef<HTMLInputElement | null>(null);
  const timetableCameraRef = useRef<HTMLInputElement | null>(null);

  // Redirect if user has already completed onboarding
  useEffect(() => {
    if (isLoading || profileStatus === "loading") return;
    const isComplete =
      Boolean(user?.onboardingCompleted) &&
      (user?.onboardingState ? Boolean(user.onboardingState.completed) : true);

    if (isComplete) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, profileStatus, router]);

  // Prevent flash of Step 1 if auth/firestore is still connecting
  if (
    profileStatus !== "loaded" &&
    (isLoading ||
      authStatus === "loading" ||
      (authStatus === "authenticated" && (firestoreStatus === "loading" || profileStatus === "loading")))
  ) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[#1A1A1A] text-lg"
            style={{ background: "#4ADE80" }}
          >
            TX
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Connecting to TrackX... Your setup is being restored.</span>
          </div>
        </div>
      </div>
    );
  }

  // Show retry UI if Firestore is unavailable and profile is not loaded
  if (firestoreStatus === "unavailable" && profileStatus !== "loaded") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl border border-white/10 text-center space-y-6 glass-panel">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[#1A1A1A] text-xl mx-auto shadow-lg"
            style={{ background: "#4ADE80" }}
          >
            TX
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Connecting to TrackX...</h2>
            <p className="text-sm text-slate-300">Your setup is being restored.</p>
            <p className="text-xs text-amber-400/90 pt-1">
              {firestoreErrorMessage || "Could not reach Cloud Firestore backend. Operating in offline mode."}
            </p>
          </div>
          <GlassButton
            variant="primary"
            className="w-full justify-center py-3 font-bold"
            icon={isRetrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            onClick={async () => {
              setIsRetrying(true);
              await retryFirestoreConnection();
              setIsRetrying(false);
            }}
            disabled={isRetrying}
          >
            {isRetrying ? "Reconnecting..." : "Retry"}
          </GlassButton>
        </div>
      </div>
    );
  }

  // ==========================================
  // STEP 1: Profile Submission Handler
  // ==========================================
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSavingProfile(true);
    try {
      await updateUserProfile({
        name: name.trim(),
        branch: branch.trim(),
        semester,
        globalTarget,
        onboardingState: {
          profileCompleted: true,
          attendanceBaselineCompleted: user?.onboardingState?.attendanceBaselineCompleted || false,
          timetableCompleted: user?.onboardingState?.timetableCompleted || false,
          completed: false,
          currentStep: "attendance",
        },
      });
      setStep(2);
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  // ==========================================
  // STEP 2: Attendance Extraction & Baseline
  // ==========================================
  const handleAttendanceFile = async (file: File) => {
    if (!file) return;

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setAttendanceError("Please upload a PNG, JPEG, WebP, or HEIC screenshot.");
      return;
    }

    setAttendanceError(null);
    setAttendanceSubStep("scanning");

    try {
      const data = await apiClient.extractAttendance(file);

      const items: ExtractedSubjectItem[] = (data.subjects || []).map((s, idx) => ({
        id: `att-extracted-${idx + 1}-${Date.now()}`,
        name: s.subjectName || `Subject ${idx + 1}`,
        code: s.subjectCode || "",
        faculty: s.faculty || "Faculty",
        attended: s.attended,
        conducted: s.conducted,
        percentage: s.percentage,
        percentageOnly: s.attended === null || s.conducted === null,
      }));

      setExtractedSubjects(items);
      setAttendanceWarnings(data.warnings || []);
      setAttendanceSubStep("review");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to extract attendance data.";
      setAttendanceError(msg);
      setAttendanceSubStep("upload");
    }
  };

  const handleUpdateSubjectItem = (
    id: string,
    field: "name" | "code" | "faculty" | "attended" | "conducted",
    val: string | number
  ) => {
    setExtractedSubjects((prev) =>
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

  const handleAddManualSubject = () => {
    const newSub: ExtractedSubjectItem = {
      id: `manual-${Date.now()}`,
      name: "New Course",
      code: "",
      faculty: "Faculty",
      attended: 0,
      conducted: 0,
      percentage: 0,
      percentageOnly: false,
    };
    setExtractedSubjects((prev) => [...prev, newSub]);
    setAttendanceSubStep("review");
  };

  const handleConfirmAttendanceBaseline = async () => {
    setIsSavingAttendance(true);
    try {
      let currentSubjects = [...subjects];

      for (const item of extractedSubjects) {
        if (!item.name.trim()) continue;

        const hasCounts = typeof item.attended === "number" && typeof item.conducted === "number";
        const attended = hasCounts ? Math.max(0, item.attended!) : 0;
        const conducted = hasCounts ? Math.max(0, item.conducted!) : 0;
        const isLab = isLabSubject(item.name, undefined, item.code);

        // Check if subject already exists (matching name, code, or acronym)
        const matched = findMatchingSubject(
          { name: item.name.trim(), code: item.code.trim(), type: isLab ? "Laboratory" : "Theory" },
          currentSubjects
        );

        if (matched) {
          // Update existing subject with extracted baseline rather than duplicating
          const updates = {
            presentClasses: attended,
            absentClasses: Math.max(0, conducted - attended),
            baselinePercentage: item.percentage,
            countsUnavailable: !hasCounts,
            ...(item.name.trim().length > matched.name.length && !/^[A-Z0-9\s]{1,6}$/.test(item.name.trim())
              ? { name: item.name.trim(), code: matched.code || item.code.trim() || undefined }
              : {}),
            ...(item.faculty && item.faculty !== "Faculty" && (!matched.facultyName || matched.facultyName === "Faculty")
              ? { facultyName: item.faculty }
              : {}),
          };
          await updateSubject(matched.id, updates);
          currentSubjects = currentSubjects.map((s) => (s.id === matched.id ? { ...s, ...updates } : s));
        } else {
          // Add newly discovered subject
          const newSub = await addSubject({
            semesterId: "sem-fall-2026",
            name: item.name.trim() || "Untitled Subject",
            code: item.code.trim() || undefined,
            facultyName: item.faculty.trim() || "Faculty",
            colorValue: isLab ? "#A855F7" : "#00F2FE",
            type: isLab ? "Laboratory" : "Theory",
            targetAttendance: globalTarget,
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

      // Persist step 2 completion to Firestore
      await updateUserProfile({
        onboardingState: {
          profileCompleted: true,
          attendanceBaselineCompleted: true,
          timetableCompleted: user?.onboardingState?.timetableCompleted || false,
          completed: false,
          currentStep: "timetable",
        },
      });

      setStep(3);
    } catch (err) {
      console.error("Failed to confirm attendance baseline:", err);
      setAttendanceError("Could not save baseline. Please try again.");
    } finally {
      setIsSavingAttendance(false);
    }
  };

  // ==========================================
  // STEP 3: Timetable Extraction & Confirmation
  // ==========================================
  const handleTimetableFile = async (file: File) => {
    if (!file) return;

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setTimetableError("Please upload a PNG, JPEG, WebP, or HEIC schedule screenshot.");
      return;
    }

    setTimetableError(null);
    setTimetableSubStep("scanning");

    try {
      const data = await apiClient.extractTimetable(file);

      const items: ExtractedTimetableItem[] = (data.entries || []).map((e, idx) => {
        const isNonAcad = isNonAcademicSubject(e.subjectName, e.classType, e.type);
        const isLab = Boolean(e.isContinuousLab || e.classType === "lab" || e.type === "lab");
        let assignedSubjectId = "__new__";
        let resolvedName = e.subjectName || `Period ${idx + 1}`;

        if (isNonAcad) {
          assignedSubjectId = "__skip__";
        } else {
          // Intelligently auto-match against subjects (including those saved in Step 2)
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
          id: `tt-extracted-${idx + 1}-${Date.now()}`,
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

      setExtractedTimetable(items);
      setTimetableWarnings(data.warnings || []);
      setTimetableSubStep("review");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to extract timetable schedule.";
      setTimetableError(msg);
      setTimetableSubStep("upload");
    }
  };

  const handleUpdateTimetableItem = (
    id: string,
    field: keyof ExtractedTimetableItem,
    val: string | number | boolean
  ) => {
    setExtractedTimetable((prev) =>
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

  const handleBatchAssignTimetableSubject = (sourceKey: string, targetSubjectId: string) => {
    setExtractedTimetable((prev) =>
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
    setExtractedTimetable((prev) =>
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

  const handleConfirmTimetable = async () => {
    setIsSavingTimetable(true);
    try {
      const activeUid = user?.id || "student";
      const semesterId = "sem-fall-2026";
      const createdSubjectMap = new Map<string, string>();

      subjects.forEach((s) => {
        if (s.code) createdSubjectMap.set(s.code.toUpperCase(), s.id);
        createdSubjectMap.set(s.name.toLowerCase(), s.id);
      });

      // Group valid entries by dayOfWeek and sort by startTimeMinutes
      const entriesByDay: Record<number, ExtractedTimetableItem[]> = {};
      extractedTimetable.forEach((item) => {
        // STRICT RULE: Sunday is universally a holiday for all colleges
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

      const finalEntries: TimetableEntry[] = [];
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
            // User explicitly confirmed assignment to existing subject
            targetSubjectId = item.assignedSubjectId;
          } else {
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

            if (!targetSubjectId) {
              const newSub = await addSubject({
                semesterId,
                name: item.subjectName,
                code: item.subjectCode || undefined,
                facultyName: item.faculty || "Faculty",
                colorValue: isLab ? "#A855F7" : "#00F2FE",
                type: isLab ? "Laboratory" : "Theory",
                targetAttendance: globalTarget,
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

            const alreadyAdded = finalEntries.some(
              (e) =>
                e.dayOfWeek === dayOfWeek &&
                e.startTime === item.startTimeMinutes &&
                e.endTime === item.endTimeMinutes &&
                e.subjectId === targetSubjectId
            );

            if (!alreadyAdded) {
              finalEntries.push({
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

      if (finalEntries.length > 0) {
        await batchSaveTimetable(finalEntries, true);
      }

      // Final Onboarding Completion: All 3 steps completed!
      await updateUserProfile({
        onboardingCompleted: true,
        onboardingState: {
          profileCompleted: true,
          attendanceBaselineCompleted: true,
          timetableCompleted: true,
          completed: true,
          currentStep: "complete",
        },
      });

      setStep(4);
    } catch (err) {
      console.error("Failed to save timetable:", err);
      setTimetableError("Could not save timetable. Please try again.");
    } finally {
      setIsSavingTimetable(false);
    }
  };

  const handleLaunchDashboard = () => {
    router.replace("/dashboard");
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 space-y-6 animate-in fade-in duration-500">
      {/* Hidden Inputs */}
      <input
        ref={attendanceFileRef}
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && handleAttendanceFile(e.target.files[0])}
        className="hidden"
      />
      <input
        ref={attendanceCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => e.target.files?.[0] && handleAttendanceFile(e.target.files[0])}
        className="hidden"
      />
      <input
        ref={timetableFileRef}
        type="file"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && handleTimetableFile(e.target.files[0])}
        className="hidden"
      />
      <input
        ref={timetableCameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => e.target.files?.[0] && handleTimetableFile(e.target.files[0])}
        className="hidden"
      />

      {/* Modern 4-Step Progress Indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
          <span className="uppercase tracking-wider">
            {step === 1 && "Step 1: Profile & Target"}
            {step === 2 && "Step 2: Attendance Baseline"}
            {step === 3 && "Step 3: Weekly Timetable"}
            {step === 4 && "Step 4: Activation Ready"}
          </span>
          <span className="text-cyan-400 font-bold">{step} of 4</span>
        </div>

        <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full transition-all duration-500"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ==================================================== */}
        {/* STEP 1: Profile Setup                                */}
        {/* ==================================================== */}
        {step === 1 && (
          <motion.div
            key="step-profile"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
          >
            <GlassCard variant="elevated" className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                    Set Up Your Student Profile
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define your degree path and institutional attendance requirement.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    placeholder="e.g. Alex Rivera"
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-black/10 dark:bg-white/10 border border-white/15 text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-500 focus:outline-cyan-400"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                      Academic Branch / Discipline
                    </label>
                    <input
                      type="text"
                      required
                      value={branch}
                      placeholder="e.g. Computer Science & Engineering"
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/10 dark:bg-white/10 border border-white/15 text-sm text-slate-900 dark:text-white focus:outline-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                      Current Semester
                    </label>
                    <select
                      value={semester}
                      onChange={(e) => setSemester(parseInt(e.target.value, 10))}
                      className="w-full px-4 py-2.5 rounded-xl bg-black/10 dark:bg-white/10 border border-white/15 text-sm font-semibold text-slate-900 dark:text-white focus:outline-cyan-400"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                        <option key={s} value={s} className="bg-slate-900 text-white">
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Target attendance goal */}
                <div className="p-5 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Minimum Attendance Target
                    </span>
                    <span className="text-2xl font-black text-cyan-400">
                      {globalTarget}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={95}
                    value={globalTarget}
                    onChange={(e) => setGlobalTarget(parseInt(e.target.value, 10))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>65% (Relaxed)</span>
                    <span>75% (Mandatory Standard)</span>
                    <span>85% (High Honors)</span>
                  </div>
                </div>

                <GlassButton
                  variant="primary"
                  className="w-full justify-center py-3 font-bold"
                  icon={isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4 text-cyan-400" />}
                  disabled={isSavingProfile || !name.trim()}
                >
                  {isSavingProfile ? "Saving Profile..." : "Continue to Attendance Setup"}
                </GlassButton>
              </form>
            </GlassCard>
          </motion.div>
        )}

        {/* ==================================================== */}
        {/* STEP 2: Attendance Baseline                          */}
        {/* ==================================================== */}
        {step === 2 && (
          <motion.div
            key="step-attendance"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            <GlassCard variant="elevated" className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                      Attendance Baseline
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Upload an ERP portal screenshot or enter baseline course counts.
                    </p>
                  </div>
                </div>
                <GlassButton
                  size="sm"
                  variant="secondary"
                  icon={<ArrowLeft className="w-3.5 h-3.5" />}
                  onClick={() => setStep(1)}
                >
                  Back
                </GlassButton>
              </div>

              {attendanceError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{attendanceError}</span>
                </div>
              )}

              {user?.onboardingState?.attendanceBaselineCompleted && !isUpdatingAttendance ? (
                <div className="p-8 text-center space-y-6 max-w-xl mx-auto border border-emerald-500/30 bg-emerald-950/10 rounded-3xl shadow-[0_8px_32px_rgba(16,185,129,0.1)]">
                  <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      ✓ Attendance Already Extracted
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
                      onClick={() => setIsUpdatingAttendance(true)}
                    >
                      Update Attendance
                    </GlassButton>
                    <GlassButton
                      variant="primary"
                      className="w-full sm:w-auto"
                      onClick={() => setStep(3)}
                    >
                      Continue to Timetable
                    </GlassButton>
                  </div>
                </div>
              ) : (
                <>
                  {isUpdatingAttendance && (
                    <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between gap-3 text-cyan-300 text-xs">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-400" />
                        <span>Updating Attendance Baseline. Upload a new screenshot to review before replacing.</span>
                      </div>
                      <button
                        onClick={() => setIsUpdatingAttendance(false)}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Attendance Upload Surface */}
                  {attendanceSubStep === "upload" && (
                <div className="space-y-4">
                  <div
                    onClick={() => attendanceFileRef.current?.click()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) handleAttendanceFile(e.dataTransfer.files[0]);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-black/15 dark:border-white/15 hover:border-cyan-500/50 rounded-3xl p-8 sm:p-10 text-center glass-panel cursor-pointer group transition-all"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                      Upload Attendance Screenshot
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
                      Gemini Vision AI extracts verifiable attended & conducted numbers directly from your portal.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <GlassButton
                        size="sm"
                        variant="secondary"
                        icon={<Camera className="w-4 h-4" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          attendanceCameraRef.current?.click();
                        }}
                      >
                        Camera
                      </GlassButton>
                      <GlassButton
                        size="sm"
                        variant="primary"
                        icon={<FileImage className="w-4 h-4 text-cyan-400" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          attendanceFileRef.current?.click();
                        }}
                      >
                        Browse Files
                      </GlassButton>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleAddManualSubject}
                      className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 underline"
                    >
                      + Or enter course counts manually
                    </button>
                    <span className="text-[11px] text-slate-400">
                      Step 2 of 4
                    </span>
                  </div>
                </div>
              )}

              {/* Attendance Scanning State */}
              {attendanceSubStep === "scanning" && (
                <div className="py-10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto animate-pulse">
                    <ScanLine className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Analyzing Portal Screenshot...
                  </h3>
                  <div className="flex items-center justify-center gap-2 text-xs text-cyan-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting subjects and attendance counts with Gemini Vision...
                  </div>
                </div>
              )}

              {/* Attendance Review & Confirmation */}
              {attendanceSubStep === "review" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      {extractedSubjects.length} Courses Ready for Verification
                    </span>
                    <GlassButton size="sm" variant="secondary" onClick={handleAddManualSubject} icon={<Plus className="w-3.5 h-3.5" />}>
                      Add Course
                    </GlassButton>
                  </div>

                  {attendanceWarnings.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                      {attendanceWarnings.map((w, idx) => (
                        <p key={idx} className="flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          {w}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                    {extractedSubjects.map((item) => {
                      const pct =
                        item.percentage !== null
                          ? item.percentage.toFixed(1)
                          : typeof item.conducted === "number" && item.conducted > 0 && typeof item.attended === "number"
                          ? ((item.attended / item.conducted) * 100).toFixed(1)
                          : "--";

                      return (
                        <div key={item.id} className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/10 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={item.code}
                              placeholder="CODE"
                              onChange={(e) => handleUpdateSubjectItem(item.id, "code", e.target.value)}
                              className="w-20 px-2 py-1 rounded bg-black/10 dark:bg-white/10 border border-white/10 text-[11px] font-mono font-bold uppercase text-slate-200"
                            />
                            <input
                              type="text"
                              value={item.name}
                              placeholder="Course Title"
                              onChange={(e) => handleUpdateSubjectItem(item.id, "name", e.target.value)}
                              className="flex-1 px-2 py-1 rounded bg-transparent border-b border-white/10 text-xs font-bold text-slate-900 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => setExtractedSubjects((p) => p.filter((x) => x.id !== item.id))}
                              className="p-1 text-slate-500 hover:text-rose-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                            <div className="flex items-center gap-2">
                              <span>Attended:</span>
                              <input
                                type="number"
                                min="0"
                                value={item.attended ?? ""}
                                placeholder="--"
                                onChange={(e) => {
                                  const v = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                  handleUpdateSubjectItem(item.id, "attended", isNaN(v) ? 0 : v);
                                }}
                                className="w-16 px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 border border-white/10 font-bold text-center text-slate-200"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span>Conducted:</span>
                              <input
                                type="number"
                                min="0"
                                value={item.conducted ?? ""}
                                placeholder="--"
                                onChange={(e) => {
                                  const v = e.target.value === "" ? 0 : parseInt(e.target.value, 10);
                                  handleUpdateSubjectItem(item.id, "conducted", isNaN(v) ? 0 : v);
                                }}
                                className="w-16 px-2 py-0.5 rounded bg-black/10 dark:bg-white/10 border border-white/10 font-bold text-center text-slate-200"
                              />
                            </div>
                            <span className="font-extrabold text-cyan-400 min-w-[50px] text-right">
                              {pct}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <GlassButton size="sm" variant="secondary" onClick={() => setAttendanceSubStep("upload")}>
                      Upload Another
                    </GlassButton>
                    <GlassButton
                      size="sm"
                      variant="primary"
                      onClick={handleConfirmAttendanceBaseline}
                      disabled={isSavingAttendance || extractedSubjects.length === 0}
                      icon={isSavingAttendance ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    >
                      {isSavingAttendance ? "Saving Baseline..." : "Confirm & Proceed to Timetable"}
                    </GlassButton>
                  </div>
                </div>
              )}
            </>
          )}
        </GlassCard>
      </motion.div>
    )}

        {/* ==================================================== */}
        {/* STEP 3: Timetable Setup                              */}
        {/* ==================================================== */}
        {step === 3 && (
          <motion.div
            key="step-timetable"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="space-y-4"
          >
            <GlassCard variant="elevated" className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                      Weekly Schedule Routine
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Upload your timetable image with continuous merged-cell support.
                    </p>
                  </div>
                </div>
                <GlassButton
                  size="sm"
                  variant="secondary"
                  icon={<ArrowLeft className="w-3.5 h-3.5" />}
                  onClick={() => setStep(2)}
                >
                  Back
                </GlassButton>
              </div>

              {timetableError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{timetableError}</span>
                </div>
              )}

              {user?.onboardingState?.timetableCompleted && !isUpdatingTimetable ? (
                <div className="p-8 text-center space-y-6 max-w-xl mx-auto border border-purple-500/30 bg-purple-950/10 rounded-3xl shadow-[0_8px_32px_rgba(168,85,247,0.1)]">
                  <div className="w-16 h-16 rounded-3xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30">
                      ✓ Timetable Already Extracted
                    </span>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Weekly Timetable</h2>
                    <p className="text-sm text-slate-400 dark:text-slate-300">
                      Your timetable schedule has already been imported and confirmed.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <Link href="/timetable" className="w-full sm:w-auto">
                      <GlassButton variant="primary" className="w-full">
                        View Timetable
                      </GlassButton>
                    </Link>
                    <GlassButton
                      variant="secondary"
                      className="w-full sm:w-auto border-white/20 hover:border-purple-400/50"
                      onClick={() => setIsUpdatingTimetable(true)}
                    >
                      Update Timetable
                    </GlassButton>
                    <GlassButton
                      variant="primary"
                      className="w-full sm:w-auto"
                      onClick={() => router.replace("/dashboard")}
                    >
                      Go to Dashboard
                    </GlassButton>
                  </div>
                </div>
              ) : (
                <>
                  {isUpdatingTimetable && (
                    <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between gap-3 text-purple-300 text-xs">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span>Updating Weekly Timetable. Upload a new screenshot to replace.</span>
                      </div>
                      <button
                        onClick={() => setIsUpdatingTimetable(false)}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* Timetable Upload Surface */}
                  {timetableSubStep === "upload" && (
                <div className="space-y-4">
                  <div
                    onClick={() => timetableFileRef.current?.click()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files?.[0]) handleTimetableFile(e.dataTransfer.files[0]);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    className="border-2 border-dashed border-black/15 dark:border-white/15 hover:border-purple-500/50 rounded-3xl p-8 sm:p-10 text-center glass-panel cursor-pointer group transition-all"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                      Upload Timetable Screenshot
                    </h3>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mb-5">
                      Extracts class hours, days, faculty, and preserves 2-hour continuous practical blocks.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <GlassButton
                        size="sm"
                        variant="secondary"
                        icon={<Camera className="w-4 h-4" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          timetableCameraRef.current?.click();
                        }}
                      >
                        Camera
                      </GlassButton>
                      <GlassButton
                        size="sm"
                        variant="primary"
                        icon={<FileImage className="w-4 h-4 text-purple-400" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          timetableFileRef.current?.click();
                        }}
                      >
                        Browse Files
                      </GlassButton>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Populate a standard default schedule if no timetable screenshot is available
                        const defaults: ExtractedTimetableItem[] = [
                          {
                            id: `tt-def-1-${Date.now()}`,
                            day: "Monday",
                            dayOfWeek: 1,
                            startTime: "09:00",
                            endTime: "10:00",
                            startTimeMinutes: 540,
                            endTimeMinutes: 600,
                            durationMinutes: 60,
                            isContinuous: false,
                            isContinuousLab: false,
                            subjectCode: "CS101",
                            subjectName: "Programming Foundations",
                            displayName: "Programming Foundations",
                            faculty: "Department Faculty",
                            location: "LH-101",
                            classType: "lecture",
                            type: "lecture",
                            confidence: 1.0,
                            warnings: [],
                            requiresReview: false,
                          },
                          {
                            id: `tt-def-2-${Date.now()}`,
                            day: "Monday",
                            dayOfWeek: 1,
                            startTime: "10:15",
                            endTime: "12:15",
                            startTimeMinutes: 615,
                            endTimeMinutes: 735,
                            durationMinutes: 120,
                            isContinuous: true,
                            isContinuousLab: true,
                            subjectCode: "CS102L",
                            subjectName: "Computing Practical Lab",
                            displayName: "Computing Practical Lab",
                            faculty: "Lab Faculty",
                            location: "LAB-2",
                            classType: "lab",
                            type: "lab",
                            confidence: 1.0,
                            warnings: [],
                            requiresReview: false,
                          },
                        ];
                        setExtractedTimetable(defaults);
                        setTimetableSubStep("review");
                      }}
                      className="text-xs font-semibold text-purple-400 hover:text-purple-300 underline"
                    >
                      + Or generate standard weekday routine
                    </button>
                    <span className="text-[11px] text-slate-400">Step 3 of 4</span>
                  </div>
                </div>
              )}

              {/* Timetable Scanning State */}
              {timetableSubStep === "scanning" && (
                <div className="py-10 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center mx-auto animate-pulse">
                    <ScanLine className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Parsing Timetable Schedule...
                  </h3>
                  <div className="flex items-center justify-center gap-2 text-xs text-purple-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Detecting class slots and continuous merged practical periods...
                  </div>
                </div>
              )}

              {/* Timetable Review & Confirmation */}
              {timetableSubStep === "review" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      {extractedTimetable.length} Schedule Slots Extracted
                    </span>
                  </div>

                  {timetableWarnings.length > 0 && (
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                      {timetableWarnings.map((w, idx) => (
                        <p key={idx} className="flex items-center gap-2">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          {w}
                        </p>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                    {extractedTimetable.map((item) => (
                      <div key={item.id} className="p-3.5 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/10 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">
                              {item.day}
                            </span>
                            {item.isContinuous && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                {item.durationMinutes}m Continuous
                              </span>
                            )}
                            {/lunch|break/i.test(item.subjectName) && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-500/20 text-slate-400 border border-slate-500/30">
                                Lunch
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <input
                              type="text"
                              value={item.startTime}
                              placeholder="09:15"
                              onChange={(e) => handleUpdateTimetableItem(item.id, "startTime", e.target.value)}
                              className="w-14 px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 border border-white/10 text-xs font-mono font-bold text-center text-slate-200 focus:outline-purple-400"
                            />
                            <span>–</span>
                            <input
                              type="text"
                              value={item.endTime}
                              placeholder="10:15"
                              onChange={(e) => handleUpdateTimetableItem(item.id, "endTime", e.target.value)}
                              className="w-14 px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 border border-white/10 text-xs font-mono font-bold text-center text-slate-200 focus:outline-purple-400"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                          <input
                            type="text"
                            value={item.subjectCode}
                            placeholder="CODE"
                            onChange={(e) => handleUpdateTimetableItem(item.id, "subjectCode", e.target.value)}
                            className="w-16 px-2 py-1 rounded bg-black/10 dark:bg-white/10 border border-white/10 text-[11px] font-mono uppercase text-slate-200"
                          />
                          <input
                            type="text"
                            value={item.subjectName}
                            placeholder="Subject Name"
                            onChange={(e) => handleUpdateTimetableItem(item.id, "subjectName", e.target.value)}
                            className="flex-1 min-w-[140px] px-2 py-1 rounded bg-transparent border-b border-white/10 text-xs font-bold text-slate-900 dark:text-white focus:outline-purple-400"
                          />
                          <input
                            type="text"
                            value={item.faculty}
                            placeholder="Faculty"
                            onChange={(e) => handleUpdateTimetableItem(item.id, "faculty", e.target.value)}
                            className="w-24 px-2 py-1 rounded bg-transparent text-xs text-slate-400 border-b border-white/10 focus:outline-purple-400"
                          />
                          <input
                            type="text"
                            value={item.location}
                            placeholder="Room"
                            onChange={(e) => handleUpdateTimetableItem(item.id, "location", e.target.value)}
                            className="w-20 px-2 py-1 rounded bg-transparent text-xs text-cyan-400 border-b border-white/10 focus:outline-purple-400"
                          />
                          <select
                            value={item.classType}
                            onChange={(e) => handleUpdateTimetableItem(item.id, "classType", e.target.value)}
                            className="px-2 py-1 rounded bg-black/10 dark:bg-white/10 border border-white/10 text-[11px] text-slate-300 focus:outline-purple-400"
                          >
                            <option value="lecture" className="bg-slate-900">Lecture</option>
                            <option value="lab" className="bg-slate-900">Lab</option>
                            <option value="activity" className="bg-slate-900">Activity</option>
                            <option value="training" className="bg-slate-900">Training</option>
                            <option value="other" className="bg-slate-900">Other</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setExtractedTimetable((p) => p.filter((x) => x.id !== item.id))}
                            className="p-1 text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Subject Assignment Selector */}
                        <div className="pt-2 border-t border-black/5 dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                            <span className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                              Assigned:
                            </span>
                            <select
                              value={item.assignedSubjectId || "__new__"}
                              onChange={(e) => {
                                const newSubId = e.target.value;
                                handleUpdateTimetableItem(item.id, "assignedSubjectId", newSubId);
                                if (newSubId !== "__new__" && newSubId !== "__skip__") {
                                  const s = subjects.find((x) => x.id === newSubId);
                                  if (s) {
                                    handleUpdateTimetableItem(item.id, "subjectName", s.name);
                                    if (s.code) handleUpdateTimetableItem(item.id, "subjectCode", s.code);
                                  }
                                }
                              }}
                              className={`flex-1 min-w-[200px] px-2 py-1 rounded-xl text-xs font-bold border transition-colors ${
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
                                ✨ + Create New: &quot;{item.subjectName}&quot;
                              </option>
                            </select>
                          </div>

                          {/* Quick batch apply button */}
                          {item.assignedSubjectId && item.assignedSubjectId !== "__new__" && item.assignedSubjectId !== "__skip__" && (
                            <button
                              type="button"
                              onClick={() => handleBatchAssignTimetableSubject(item.subjectCode || item.subjectName, item.assignedSubjectId!)}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-bold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                              title="Assign this subject to all slots with the same code or title"
                            >
                              <span>Apply to all &quot;{item.subjectCode || item.subjectName}&quot;</span>
                            </button>
                          )}
                        </div>

                        {/* Ambiguous Subject Resolution Pill Selector */}
                        {item.requiresReview && item.possibleSubjects && item.possibleSubjects.length > 0 && (
                          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center gap-1.5 text-xs">
                            <span className="font-semibold text-amber-300 flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                              Select Subject:
                            </span>
                            {item.possibleSubjects.map((candidate, cIdx) => (
                              <button
                                key={cIdx}
                                type="button"
                                onClick={() => handleResolveAmbiguity(item.id, candidate)}
                                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition-all ${
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
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <GlassButton size="sm" variant="secondary" onClick={() => setTimetableSubStep("upload")}>
                      Upload Another
                    </GlassButton>
                    <GlassButton
                      size="sm"
                      variant="primary"
                      onClick={handleConfirmTimetable}
                      disabled={isSavingTimetable || extractedTimetable.length === 0}
                      icon={isSavingTimetable ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-purple-400" />}
                    >
                      {isSavingTimetable ? "Activating TrackX..." : "Complete Setup & Activate TrackX"}
                    </GlassButton>
                  </div>
                </div>
              )}
            </>
          )}
        </GlassCard>
      </motion.div>
    )}

        {/* ==================================================== */}
        {/* STEP 4: Activation Celebration                       */}
        {/* ==================================================== */}
        {step === 4 && (
          <motion.div
            key="step-activation"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            <GlassCard variant="elevated" className="p-8 sm:p-10 space-y-6">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-500 to-indigo-500 p-0.5 shadow-xl shadow-cyan-500/25 mx-auto">
                <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center text-cyan-400">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              </div>

              <div>
                <span className="text-xs uppercase font-extrabold tracking-widest text-cyan-400">
                  Setup Complete
                </span>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                  Welcome to TrackX, {user?.name || "Student"}!
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                  Your academic profile, attendance baseline, and weekly timetable have been verified and permanently persisted to Firestore.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto text-left">
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Subjects</span>
                  <span className="text-lg font-extrabold text-cyan-400">{subjects.length} active</span>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Schedule</span>
                  <span className="text-lg font-extrabold text-purple-400">{timetable.length} periods</span>
                </div>
              </div>

              <GlassButton
                variant="primary"
                className="w-full justify-center py-3.5 font-extrabold text-sm"
                icon={<ArrowRight className="w-4 h-4 text-cyan-400" />}
                onClick={handleLaunchDashboard}
              >
                Launch TrackX Dashboard
              </GlassButton>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
