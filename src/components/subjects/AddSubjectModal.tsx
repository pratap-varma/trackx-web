"use client";

import React, { useState } from "react";
import {
  X,
  Plus,
  CalendarDays,
  Clock,
  BookOpen,
  Loader2,
  MapPin,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTrackX } from "@/context/TrackXContext";
import { Subject, SubjectType, TimetableEntry } from "@/types/trackx";
import { GlassButton } from "@/components/ui/GlassButton";

interface AddSubjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDay?: number; // 1 = Monday ... 6 = Saturday
  initialPeriod?: number; // 1 to 6
  onSuccess?: (subject: Subject, assignedDays: number[]) => void;
}

const WEEKDAY_OPTIONS = [
  { day: 1, label: "Monday", short: "Mon" },
  { day: 2, label: "Tuesday", short: "Tue" },
  { day: 3, label: "Wednesday", short: "Wed" },
  { day: 4, label: "Thursday", short: "Thu" },
  { day: 5, label: "Friday", short: "Fri" },
  { day: 6, label: "Saturday", short: "Sat" },
];

const STANDARD_PERIODS = [
  { periodNumber: 1, startTime: 555, endTime: 615, label: "Period 1 (09:15 – 10:15 AM)" },
  { periodNumber: 2, startTime: 615, endTime: 675, label: "Period 2 (10:15 – 11:15 AM)" },
  { periodNumber: 3, startTime: 675, endTime: 735, label: "Period 3 (11:15 – 12:15 PM)" },
  { periodNumber: 4, startTime: 780, endTime: 840, label: "Period 4 (01:00 – 02:00 PM)" },
  { periodNumber: 5, startTime: 840, endTime: 900, label: "Period 5 (02:00 – 03:00 PM)" },
  { periodNumber: 6, startTime: 900, endTime: 960, label: "Period 6 (03:00 – 04:00 PM)" },
];

const COLOR_PRESETS = ["#5B5FEF", "#7BD0FF", "#10B981", "#8151EB", "#F59E0B", "#EF4444", "#EC4899", "#14B8A6"];

const formatMinutes = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${period}`;
};

const AddSubjectModalInner: React.FC<AddSubjectModalProps> = ({
  onClose,
  initialDay,
  initialPeriod = 1,
  onSuccess,
}) => {
  const {
    subjects,
    activeSemester,
    addSubject,
    timetable,
    batchSaveTimetable,
    user,
  } = useTrackX();

  // Mode: "new" (create new course) or "existing" (assign existing course to timetable)
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [selectedExistingId, setSelectedExistingId] = useState<string>(() =>
    subjects.length > 0 ? subjects[0].id : ""
  );

  // Course Details Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [faculty, setFaculty] = useState("");
  const [type, setType] = useState<SubjectType>("Theory");
  const [target, setTarget] = useState(user?.globalTarget || 75);
  const [color, setColor] = useState("#5B5FEF");

  // Timetable Assignment State
  const [selectedDays, setSelectedDays] = useState<number[]>(() =>
    initialDay && initialDay >= 1 && initialDay <= 6 ? [initialDay] : []
  );
  const [defaultPeriod, setDefaultPeriod] = useState<number>(initialPeriod);
  const [dayPeriods, setDayPeriods] = useState<Record<number, number>>(() =>
    initialDay && initialDay >= 1 && initialDay <= 6 ? { [initialDay]: initialPeriod } : {}
  );
  const [room, setRoom] = useState("");
  const [showCustomPerDay, setShowCustomPerDay] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const toggleDay = (dayNum: number) => {
    setSelectedDays((prev) => {
      const exists = prev.includes(dayNum);
      if (exists) {
        const next = prev.filter((d) => d !== dayNum);
        const nextPeriods = { ...dayPeriods };
        delete nextPeriods[dayNum];
        setDayPeriods(nextPeriods);
        return next;
      } else {
        const next = [...prev, dayNum].sort((a, b) => a - b);
        setDayPeriods((curr) => ({
          ...curr,
          [dayNum]: curr[dayNum] || defaultPeriod,
        }));
        return next;
      }
    });
  };

  const handleSelectAllWeekdays = () => {
    const weekdays = [1, 2, 3, 4, 5];
    const isAllSelected = weekdays.every((d) => selectedDays.includes(d));
    if (isAllSelected) {
      setSelectedDays((prev) => prev.filter((d) => !weekdays.includes(d)));
    } else {
      setSelectedDays((prev) => {
        const set = new Set([...prev, ...weekdays]);
        return Array.from(set).sort((a, b) => a - b);
      });
      const updatedPeriods = { ...dayPeriods };
      weekdays.forEach((d) => {
        if (!updatedPeriods[d]) updatedPeriods[d] = defaultPeriod;
      });
      setDayPeriods(updatedPeriods);
    }
  };

  const handleDefaultPeriodChange = (newP: number) => {
    setDefaultPeriod(newP);
    const updated = { ...dayPeriods };
    selectedDays.forEach((d) => {
      updated[d] = newP;
    });
    setDayPeriods(updated);
  };

  const handleDayPeriodChange = (dayNum: number, pNum: number) => {
    setDayPeriods((prev) => ({
      ...prev,
      [dayNum]: pNum,
    }));
  };

  const getPeriodTiming = (pNum: number) => {
    const existing = timetable.find((t) => t.periodNumber === pNum);
    if (existing) {
      return {
        startTime: existing.startTime,
        endTime: existing.endTime,
        label: `Period ${pNum} (${formatMinutes(existing.startTime)} – ${formatMinutes(existing.endTime)})`,
      };
    }
    const std = STANDARD_PERIODS.find((p) => p.periodNumber === pNum) || STANDARD_PERIODS[0];
    return {
      startTime: std.startTime,
      endTime: std.endTime,
      label: std.label,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSaving(true);

    try {
      let targetSubject: Subject | undefined;

      if (mode === "new") {
        if (!name.trim()) {
          setErrorMessage("Please enter a subject name.");
          setIsSaving(false);
          return;
        }

        const newSub = await addSubject({
          semesterId: activeSemester?.id || "sem-fall-2026",
          name: name.trim(),
          code: code.trim() || undefined,
          facultyName: faculty.trim() || "Faculty",
          colorValue: color,
          type,
          credits: 3,
          weeklyPeriods: selectedDays.length || 3,
          targetAttendance: target,
          presentClasses: 0,
          absentClasses: 0,
          status: "Active",
        });

        if (!newSub) {
          throw new Error("Failed to create subject");
        }
        targetSubject = newSub;
      } else {
        targetSubject = subjects.find((s) => s.id === selectedExistingId);
        if (!targetSubject) {
          setErrorMessage("Please select a valid subject.");
          setIsSaving(false);
          return;
        }
      }

      if (selectedDays.length > 0 && targetSubject) {
        const activeUid = user?.id || "usr-guest";
        const semId = activeSemester?.id || "sem-fall-2026";
        const isLabSubject = targetSubject.type === "Laboratory" || targetSubject.name.toLowerCase().includes("lab");

        const newTimetableEntries: TimetableEntry[] = selectedDays.map((dayOfWeek) => {
          const pNum = dayPeriods[dayOfWeek] || defaultPeriod;
          const timing = getPeriodTiming(pNum);

          return {
            id: `tt_${activeUid}_d${dayOfWeek}_p${pNum}_${targetSubject!.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            userId: activeUid,
            semesterId: semId,
            subjectId: targetSubject!.id,
            dayOfWeek,
            periodNumber: pNum,
            startTime: timing.startTime,
            endTime: timing.endTime,
            room: room.trim() || undefined,
            notes: `${targetSubject!.name}${targetSubject!.facultyName ? ` (${targetSubject!.facultyName})` : ""}${room.trim() ? ` [${room.trim()}]` : ""}`,
            isContinuousLab: isLabSubject,
            isEnabled: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
        });

        await batchSaveTimetable(newTimetableEntries, false);
      }

      onSuccess?.(targetSubject, selectedDays);
      onClose();
    } catch (err: unknown) {
      console.error("Error saving subject and schedule:", err);
      setErrorMessage("Failed to save subject. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="glass-modal max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 rounded-3xl border border-white/20 dark:border-white/10 shadow-2xl animate-in zoom-in-95 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#5B5FEF]/20 text-[#7BD0FF] border border-[#5B5FEF]/40 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-[#DEE2F4]">
                {mode === "new" ? "Add Course & Schedule" : "Schedule Existing Course"}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Configure your subject and assign it to timetable days
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher if existing subjects exist */}
        {subjects.length > 0 && (
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === "new"
                  ? "bg-[#5B5FEF] text-white shadow-md shadow-[#5B5FEF]/30"
                  : "text-slate-500 dark:text-slate-400 hover:text-white"
              }`}
            >
              + Create New Subject
            </button>
            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                mode === "existing"
                  ? "bg-[#5B5FEF] text-white shadow-md shadow-[#5B5FEF]/30"
                  : "text-slate-500 dark:text-slate-400 hover:text-white"
              }`}
            >
              Assign Existing ({subjects.length})
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* SECTION 1: COURSE INFORMATION */}
          {mode === "new" ? (
            <div className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  Subject Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Operating Systems, Microprocessors, AI Lab"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full glass-input px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#5B5FEF]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Course Code (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CS501"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full glass-input px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#5B5FEF]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Course Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as SubjectType)}
                    className="w-full glass-input px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#5B5FEF]"
                  >
                    <option value="Theory" className="bg-[#1F1F1F]">Theory</option>
                    <option value="Laboratory" className="bg-[#1F1F1F]">Laboratory</option>
                    <option value="Elective" className="bg-[#1F1F1F]">Elective</option>
                    <option value="Project" className="bg-[#1F1F1F]">Project</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Faculty / Instructor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Jane Smith"
                    value={faculty}
                    onChange={(e) => setFaculty(e.target.value)}
                    className="w-full glass-input px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#5B5FEF]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    Target Attendance (%)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={target}
                    onChange={(e) => setTarget(parseInt(e.target.value) || 75)}
                    className="w-full glass-input px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-[#5B5FEF]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Color Tag
                </label>
                <div className="flex items-center gap-2.5">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform cursor-pointer ${
                        color === c ? "scale-125 ring-2 ring-white shadow-lg" : "opacity-75 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                Select Course to Schedule
              </label>
              <select
                value={selectedExistingId}
                onChange={(e) => setSelectedExistingId(e.target.value)}
                className="w-full glass-input px-4 py-3 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#5B5FEF]"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id} className="bg-[#1F1F1F]">
                    {sub.name} {sub.code ? `(${sub.code})` : ""} • {sub.facultyName || "Faculty"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* SECTION 2: TIMETABLE ASSIGNMENT (MONDAY TO FRIDAY / SATURDAY) */}
          <div className="p-4 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-900 dark:text-[#DEE2F4]">
                  Assign to Timetable
                </span>
              </div>
              <button
                type="button"
                onClick={handleSelectAllWeekdays}
                className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
              >
                {[1, 2, 3, 4, 5].every((d) => selectedDays.includes(d))
                  ? "Deselect Weekdays"
                  : "✓ Select Mon–Fri"}
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Select which day(s) from Monday to Friday this class should appear in your weekly routine.
            </p>

            {/* Weekday Selection Chips */}
            <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
              {WEEKDAY_OPTIONS.map((day) => {
                const isSelected = selectedDays.includes(day.day);
                return (
                  <button
                    key={day.day}
                    type="button"
                    onClick={() => toggleDay(day.day)}
                    className={`py-2 px-1 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#5B5FEF] text-white shadow-md shadow-[#5B5FEF]/40 ring-1 ring-white/30"
                        : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
                    }`}
                  >
                    <span className="text-xs font-bold">{day.short}</span>
                    <span className="text-[9px] mt-0.5 opacity-80 hidden sm:inline">
                      {isSelected ? "Active" : "Off"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Slot & Room Details (Rendered when 1+ day selected) */}
            {selectedDays.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-black/5 dark:border-white/10 animate-in fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Class Period Slot</span>
                    </label>
                    <select
                      value={defaultPeriod}
                      onChange={(e) => handleDefaultPeriodChange(parseInt(e.target.value) || 1)}
                      className="w-full glass-input px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-[#5B5FEF]"
                    >
                      {STANDARD_PERIODS.map((p) => {
                        const timing = getPeriodTiming(p.periodNumber);
                        return (
                          <option key={p.periodNumber} value={p.periodNumber} className="bg-[#1F1F1F]">
                            {timing.label}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-purple-400" />
                      <span>Room / Hall (optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. LH-204 or Lab 3"
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      className="w-full glass-input px-3 py-2 rounded-xl text-xs focus:outline-none focus:border-[#5B5FEF]"
                    />
                  </div>
                </div>

                {/* Per-Day Customization Accordion */}
                {selectedDays.length > 1 && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowCustomPerDay(!showCustomPerDay)}
                      className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
                    >
                      <span>Different periods on different days?</span>
                      {showCustomPerDay ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {showCustomPerDay && (
                      <div className="mt-2.5 p-3 rounded-xl bg-black/10 dark:bg-white/5 border border-white/5 space-y-2 animate-in fade-in">
                        {selectedDays.map((d) => {
                          const dayObj = WEEKDAY_OPTIONS.find((w) => w.day === d);
                          const curPeriod = dayPeriods[d] || defaultPeriod;
                          return (
                            <div key={d} className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-slate-300 w-24">
                                {dayObj?.label}:
                              </span>
                              <select
                                value={curPeriod}
                                onChange={(e) => handleDayPeriodChange(d, parseInt(e.target.value) || 1)}
                                className="flex-1 glass-input px-2.5 py-1.5 rounded-lg text-xs font-semibold focus:outline-none"
                              >
                                {STANDARD_PERIODS.map((p) => {
                                  const t = getPeriodTiming(p.periodNumber);
                                  return (
                                    <option key={p.periodNumber} value={p.periodNumber} className="bg-[#1F1F1F]">
                                      P{p.periodNumber} ({formatMinutes(t.startTime)} – {formatMinutes(t.endTime)})
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={isSaving || (mode === "new" && !name.trim())}
              icon={isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            >
              {isSaving
                ? "Saving..."
                : selectedDays.length > 0
                ? `Save & Assign (${selectedDays.length} Days)`
                : "Save Course"}
            </GlassButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export const AddSubjectModal: React.FC<AddSubjectModalProps> = ({
  isOpen,
  onClose,
  initialDay,
  initialPeriod = 1,
  onSuccess,
}) => {
  if (!isOpen) return null;

  return (
    <AddSubjectModalInner
      key={`${initialDay ?? "none"}-${initialPeriod}`}
      isOpen={isOpen}
      onClose={onClose}
      initialDay={initialDay}
      initialPeriod={initialPeriod}
      onSuccess={onSuccess}
    />
  );
};
