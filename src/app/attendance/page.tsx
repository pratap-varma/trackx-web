"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useTrackX } from "@/context/TrackXContext";
import { SyncStatusBadge } from "@/components/ui/SyncStatusBadge";
import { Subject, TimetableEntry } from "@/types/trackx";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowLeftRight,
  CheckCircle2,
  MapPin,
  Sparkles,
  History,
  FileScan,
  Grid3X3,
  PartyPopper,
  X,
  Trash2,
  FileText,
  PencilLine,
  UploadCloud,
  RotateCcw,
  Umbrella,
} from "lucide-react";
import { getHolidayInfo } from "@/lib/holidays";
import { ClassNoteModal } from "@/components/attendance/ClassNoteModal";
import { AddSubjectModal } from "@/components/subjects/AddSubjectModal";

const WEEKDAY_OPTIONS = [
  { day: 1, label: "Monday", short: "Mon" },
  { day: 2, label: "Tuesday", short: "Tue" },
  { day: 3, label: "Wednesday", short: "Wed" },
  { day: 4, label: "Thursday", short: "Thu" },
  { day: 5, label: "Friday", short: "Fri" },
];

export default function AttendanceLogPage() {
  const {
    subjects,
    activeSemester,
    subjectMetrics,
    records,
    timetable,
    classSubstitutes,
    holidayOverrides,
    saturdayTimetableOverrides,
    setSaturdayTimetableOverride,
    markAttendance,
    unmarkAttendance,
    getClassNote,
    saveClassNote,
    deleteClassNote,
    setSubstitute,
    removeSubstitute,
    toggleHolidayOverride,
    resetHolidayOverride,
    generateTimetableFromSubjects,
  } = useTrackX();

  // Selected date state (defaults to today)
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const datePickerRef = React.useRef<HTMLInputElement>(null);
  const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [isHeatmapModalOpen, setIsHeatmapModalOpen] = useState(false);
  const [activeSwapEntry, setActiveSwapEntry] = useState<{
    entry: TimetableEntry;
    originalSubject: Subject;
    swapKey: string;
  } | null>(null);

  // SnackBar toast state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3000);
  };

  // Helper date functions
  const isSameDay = (d1: Date, d2: Date) => {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isToday = isSameDay(selectedDate, new Date());
  const dateKey = selectedDate.toISOString().slice(0, 10);
  const holidayInfo = getHolidayInfo(selectedDate, holidayOverrides);
  const isHoliday = holidayInfo.isHoliday;
  const holidayName = holidayInfo.name || "College Holiday";

  // 7-day strip centered on selected date
  const weekDays = useMemo(() => {
    const current = new Date(selectedDate);
    const dayOfWeek = current.getDay(); // 0 = Sun, 1 = Mon ...
    const distToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(current);
    monday.setDate(current.getDate() + distToMon);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  const monthYearFormatted = selectedDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const fullDateFormatted = selectedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Relative day label
  const getRelativeDayLabel = (date: Date) => {
    const now = new Date();
    const todayNorm = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const selNorm = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diff = Math.round((selNorm.getTime() - todayNorm.getTime()) / 86400000);

    if (diff === 0) return "Today";
    if (diff === -1) return "Yesterday";
    if (diff === 1) return "Tomorrow";
    if (diff < -1) return `${Math.abs(diff)} Days Ago`;
    return `In ${diff} Days`;
  };

  // Day of week index for timetable (1 = Mon ... 5 = Fri, 6 = Sat, 7 = Sun)
  const isSaturday = selectedDate.getDay() === 6;
  const saturdayFollowedWeekday = isSaturday ? saturdayTimetableOverrides[dateKey] : undefined;
  const effectiveSaturdayWeekday = saturdayFollowedWeekday;
  const hasCustomOverride = holidayOverrides[dateKey] !== undefined || saturdayFollowedWeekday !== undefined;

  // If Saturday is a working day, follow the user's selected weekday (1..5) timetable!
  // If no weekday has been selected yet, timetableDayIndex is undefined (0 classes scheduled).
  const timetableDayIndex = isSaturday && !isHoliday
    ? effectiveSaturdayWeekday
    : selectedDate.getDay() === 0
    ? 7
    : selectedDate.getDay();

  // Timetable scheduled entries for selected date
  const scheduledEntries = useMemo(() => {
    if (isHoliday || timetableDayIndex === undefined) return [];
    return timetable
      .filter((e) => e.dayOfWeek === timetableDayIndex && e.isEnabled !== false)
      .sort((a, b) => a.startTime - b.startTime);
  }, [timetable, timetableDayIndex, isHoliday]);

  // Attendance records on the selected date
  const recordsOnDate = useMemo(() => {
    return records.filter((r) => {
      const rDate = new Date(r.date);
      return isSameDay(rDate, selectedDate);
    });
  }, [records, selectedDate]);

  const formatMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const displayM = m < 10 ? `0${m}` : m;
    return `${displayH}:${displayM} ${period}`;
  };

  // Handlers
  const handleJumpToToday = () => {
    setSelectedDate(new Date());
  };

  const handlePrevWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 7);
    setSelectedDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 7);
    setSelectedDate(d);
  };

  const handleMark = (
    subjectId: string,
    status: "present" | "absent",
    periodNumber?: number,
    hours: number = 1
  ) => {
    markAttendance(subjectId, status, periodNumber, hours, selectedDate);
    const sub = subjects.find((s) => s.id === subjectId);
    showToast(`Marked as ${status.toUpperCase()} for ${sub?.name || "Subject"}`);
  };

  const handleUnmark = (
    subjectId: string,
    subjectName: string,
    periodNumber?: number,
    hours: number = 1
  ) => {
    unmarkAttendance(subjectId, selectedDate, periodNumber, hours);
    showToast(`Attendance cleared for ${subjectName}`);
  };

  const [noteModalData, setNoteModalData] = useState<{
    isOpen: boolean;
    subject: Subject;
    entry?: TimetableEntry;
    periodNumber?: number;
    timeRange?: string;
    date: Date;
    initialNote: string;
  } | null>(null);

  const handleOpenNote = (
    subject: Subject,
    entry?: TimetableEntry,
    periodNumber?: number
  ) => {
    const period = periodNumber ?? entry?.periodNumber;
    const currentNote = getClassNote(subject.id, selectedDate, period);
    const timeRange = entry
      ? `${formatMinutes(entry.startTime)} - ${formatMinutes(entry.endTime)}`
      : undefined;
    setNoteModalData({
      isOpen: true,
      subject,
      entry,
      periodNumber: period,
      timeRange,
      date: selectedDate,
      initialNote: currentNote,
    });
  };

  const handleSaveNote = async (text: string) => {
    if (!noteModalData) return;
    await saveClassNote(
      noteModalData.subject.id,
      noteModalData.date,
      noteModalData.periodNumber,
      text
    );
    showToast(text.trim() ? "Class note saved! 📝" : "Class note removed.");
  };

  const handleDeleteNote = async () => {
    if (!noteModalData) return;
    await deleteClassNote(
      noteModalData.subject.id,
      noteModalData.date,
      noteModalData.periodNumber
    );
    showToast("Class note deleted.");
  };

  const handleOpenSwap = (entry: TimetableEntry, originalSub: Subject, swapKey: string) => {
    setActiveSwapEntry({ entry, originalSubject: originalSub, swapKey });
    setIsSwapModalOpen(true);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 animate-in fade-in duration-300">
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-[#0E131F]/90 border border-[#5B5FEF]/40 shadow-2xl backdrop-blur-xl text-sm font-semibold text-white flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <Sparkles className="w-4 h-4 text-[#7BD0FF]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar matching TrackX mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#5B5FEF]/20 border border-[#5B5FEF]/40 flex items-center justify-center text-[#5B5FEF] shrink-0 shadow-lg shadow-[#5B5FEF]/10">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-[1.5px] text-[#908FA0]">
              {activeSemester?.name.toUpperCase() || "FALL SEMESTER 2026"}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-[#DEE2F4]">
              Attendance Log
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <SyncStatusBadge />

          <button
            onClick={() => setIsHeatmapModalOpen(true)}
            className="p-2.5 rounded-xl glass-container border border-white/10 hover:border-[#10B981]/50 text-[#10B981] transition-all cursor-pointer"
            title="Attendance Heatmap"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>

          <Link href="/attendance/upload">
            <button
              className="p-2.5 rounded-xl glass-container border border-white/10 hover:border-[#5B5FEF]/50 text-[#5B5FEF] transition-all cursor-pointer"
              title="Scan Attendance Screenshot"
            >
              <FileScan className="w-4 h-4" />
            </button>
          </Link>

          <button
            onClick={() => setIsAddSubjectModalOpen(true)}
            className="flex items-center gap-1.5 py-2.5 px-3.5 rounded-xl bg-[#5B5FEF] hover:bg-[#5B5FEF]/90 text-white font-bold text-xs shadow-lg shadow-[#5B5FEF]/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Subject</span>
          </button>
        </div>
      </div>

      {/* 1. Horizontal Date Navigation Strip with 7 Days */}
      <div className="glass-container p-5 rounded-3xl border border-white/10">
        {/* Month Header + Jump to Today */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-slate-900 dark:text-[#DEE2F4]">
              {monthYearFormatted}
            </span>
            {!isToday && (
              <button
                onClick={handleJumpToToday}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#5B5FEF]/20 text-[#C0C1FF] border border-[#5B5FEF]/50 hover:bg-[#5B5FEF]/30 transition-all cursor-pointer"
              >
                <History className="w-3 h-3 text-[#7BD0FF]" />
                <span>Jump to Today</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevWeek}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Previous Week"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleNextWeek}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Next Week"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 7-Day Horizontal Strip */}
        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {weekDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isActualToday = isSameDay(day, new Date());
            const dayHolidayInfo = getHolidayInfo(day, holidayOverrides);
            const isDayHoliday = dayHolidayInfo.isHoliday;
            const dayName = day.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
            const dayNumber = day.getDate();

            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`py-3 px-1 rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer relative active:translate-y-0.5 ${
                  isSelected
                    ? "skeuo-button-primary text-white shadow-[0_3px_0_#2E3294,0_6px_14px_rgba(79,70,229,0.4)]"
                    : isActualToday
                    ? "skeuo-deck border border-cyan-500/40 text-slate-900 dark:text-white shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
                    : "skeuo-card hover:border-white/20 text-slate-500 dark:text-slate-400"
                }`}
              >
                <span
                  className={`text-[10px] font-bold ${
                    isSelected
                      ? "text-white"
                      : isDayHoliday
                      ? "text-[#F59E0B]"
                      : "text-slate-400 dark:text-[rgba(222,226,244,0.60)]"
                  }`}
                >
                  {dayName}
                </span>
                <span className="text-base font-extrabold mt-1">{dayNumber}</span>
                {isDayHoliday && (
                  <span
                    className={`w-1.5 h-1.5 rounded-full mt-1 ${
                      isSelected ? "bg-white" : "skeuo-led-amber"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Selected Date Status Bar & Actions */}
      <div className="glass-container p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              isHoliday
                ? "bg-[#F59E0B]/20 text-[#F59E0B]"
                : "bg-[#7BD0FF]/20 text-[#7BD0FF]"
            }`}
          >
            {isHoliday ? (
              <PartyPopper className="w-4 h-4" />
            ) : (
              <CalendarIcon className="w-4 h-4" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-[#DEE2F4]">
              {fullDateFormatted}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p
                className={`text-xs ${
                  isHoliday ? "text-[#F59E0B] font-semibold" : "text-slate-400"
                }`}
              >
                {isHoliday
                  ? `${holidayName} • ${getRelativeDayLabel(selectedDate)}`
                  : `Logging for ${getRelativeDayLabel(selectedDate)}`}
              </p>
              {hasCustomOverride && !isHoliday && (
                <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-bold text-slate-300 border border-white/10">
                  Custom
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <input
            type="date"
            ref={datePickerRef}
            className="sr-only"
            onChange={(e) => {
              if (e.target.value) {
                setSelectedDate(new Date(e.target.value + "T00:00:00"));
              }
            }}
          />
          <button
            onClick={() => datePickerRef.current?.showPicker?.() || datePickerRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#5B5FEF] hover:bg-[#4C50DF] text-white shadow-md shadow-[#5B5FEF]/25 transition-all cursor-pointer"
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Change</span>
          </button>

          {!isSaturday && (
            <button
              onClick={() => toggleHolidayOverride(dateKey)}
              className={`py-2 px-3.5 rounded-xl font-bold text-xs border transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                isHoliday
                  ? "bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40 hover:bg-[#10B981]/30"
                  : "bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/30 hover:bg-[#F59E0B]/25"
              }`}
            >
              {isHoliday ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Set as Working Day</span>
                </>
              ) : (
                <>
                  <PartyPopper className="w-3.5 h-3.5" />
                  <span>Mark as College Holiday</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Saturday Holiday Info Card (Image 1) */}
      {isSaturday && isHoliday && (
        <div className="p-4 sm:p-5 rounded-3xl bg-[#F59E0B]/10 border border-[#F59E0B]/30 shadow-lg shadow-[#F59E0B]/5 space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#F59E0B]/20 text-[#F59E0B] flex items-center justify-center shrink-0">
              <PartyPopper className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded-md bg-[#F59E0B]/20 border border-[#F59E0B]/30 text-[10px] font-black uppercase tracking-wider text-[#F59E0B]">
                  College Holiday
                </span>
                <span className="text-[11px] text-slate-400 font-medium">Weekly College Schedule</span>
              </div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                Saturday Holiday (Weekend Off)
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                College is closed today. Regular classes are not scheduled.
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-300 font-medium">
              College is conducting classes today?
            </span>
            <button
              onClick={() => toggleHolidayOverride(dateKey)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-[#10B981] border border-[#10B981]/40 bg-[#10B981]/15 hover:bg-[#10B981]/25 transition-all cursor-pointer shadow-sm self-start sm:self-auto"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Set as Working Day</span>
            </button>
          </div>
        </div>
      )}

      {/* Saturday Working Day Quick Actions Row (Image 2) */}
      {isSaturday && !isHoliday && (
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <button
            onClick={() => resetHolidayOverride(dateKey)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset to Default</span>
          </button>

          <button
            onClick={() => setSaturdayTimetableOverride(dateKey, null)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 text-[#F59E0B] border border-[#F59E0B]/30 transition-all cursor-pointer"
          >
            <Umbrella className="w-3.5 h-3.5" />
            <span>Mark as College Holiday</span>
          </button>
        </div>
      )}

      {/* Saturday Working Day Timetable Routine Banner (when a weekday is chosen) */}
      {isSaturday && !isHoliday && saturdayFollowedWeekday && (
        <div className="p-4 rounded-3xl bg-indigo-500/10 border border-indigo-500/30 space-y-3 shadow-lg shadow-indigo-500/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">📚</span>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block">
                  Saturday Working Day Routine
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Following {WEEKDAY_OPTIONS.find((w) => w.day === saturdayFollowedWeekday)?.label}&apos;s Timetable
                </h4>
              </div>
            </div>
            <button
              onClick={() => setSaturdayTimetableOverride(dateKey, null)}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 transition-all cursor-pointer self-start sm:self-auto"
            >
              Revert to Weekend Holiday
            </button>
          </div>

          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Switch timetable:</span>
            {WEEKDAY_OPTIONS.map((wd) => (
              <button
                key={wd.day}
                onClick={() => setSaturdayTimetableOverride(dateKey, wd.day)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  saturdayFollowedWeekday === wd.day
                    ? "bg-[#5B5FEF] text-white shadow-md shadow-[#5B5FEF]/30 border border-white/20"
                    : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10"
                }`}
              >
                {wd.short}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3. Timetable Schedule for Selected Date */}
      {/* If Saturday working day without timetable selected, show Image 2 prompt card as primary view */}
      {isSaturday && !isHoliday && !saturdayFollowedWeekday ? (
        <div className="glass-container p-8 rounded-3xl border border-[#5B5FEF]/30 bg-gradient-to-b from-[#5B5FEF]/10 to-transparent text-center shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#5B5FEF]/20 text-[#7BD0FF] flex items-center justify-center mx-auto shadow-inner">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              No timetable scheduled today.
            </h3>
            <p className="text-xs text-slate-300 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Since this is a working day, which day&apos;s timetable is scheduled on this day?
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
            {WEEKDAY_OPTIONS.map((wd) => (
              <button
                key={wd.day}
                onClick={() => setSaturdayTimetableOverride(dateKey, wd.day)}
                className="px-6 py-2.5 rounded-2xl text-xs font-bold bg-white/5 hover:bg-[#5B5FEF] text-slate-200 hover:text-white border border-white/10 hover:border-[#5B5FEF]/50 shadow-md hover:shadow-[#5B5FEF]/30 active:scale-95 transition-all cursor-pointer"
              >
                {wd.short}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] uppercase font-bold tracking-[1.2px] text-[#C0C1FF]">
              {selectedDate.toLocaleDateString("en-US", { weekday: "long" }).toUpperCase()}&apos;S
              SCHEDULE ({scheduledEntries.length})
            </span>
            <Link
              href="/calendar"
              className="text-xs font-bold text-[#7BD0FF] hover:underline"
            >
              View Calendar
            </Link>
          </div>

          {scheduledEntries.length === 0 ? (
            <div className="glass-container p-8 rounded-3xl border border-white/10 text-center space-y-3">
              <div
                className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto shadow-inner ${
                  isHoliday ? "bg-[#F59E0B]/20 text-[#F59E0B]" : "bg-white/5 text-slate-400"
                }`}
              >
                {isHoliday ? <PartyPopper className="w-7 h-7" /> : <CalendarIcon className="w-6 h-6" />}
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-[#DEE2F4]">
                {isHoliday
                  ? isSaturday
                    ? "Saturday Holiday (Weekend Off)"
                    : holidayName
                  : subjects.length === 0
                  ? "No Courses Added Yet"
                  : "No Classes Scheduled Today"}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {isHoliday
                  ? isSaturday
                    ? "No classes scheduled today. Enjoy your day off!"
                    : holidayInfo.type === "sunday"
                    ? "Sunday is a weekly holiday for all colleges. Academic sessions are suspended."
                    : "Official public holiday. Academic sessions are suspended."
                  : subjects.length === 0
                  ? "Create your semester subjects to start tracking daily attendance and calculating safe skips."
                  : "There are no periods assigned to this day. You can review your calendar or take a rest day."}
              </p>

              {subjects.length === 0 ? (
                <div className="mt-4">
                  <button
                    onClick={() => setIsAddSubjectModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl skeuo-button-primary text-xs font-bold text-white shadow-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add First Course</span>
                  </button>
                </div>
              ) : !isHoliday && (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <button
                    onClick={async () => {
                      await generateTimetableFromSubjects();
                      showToast("Weekly timetable schedule generated from your courses! ✨");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#5B5FEF] to-[#7BD0FF] text-white text-xs font-bold shadow-lg shadow-[#5B5FEF]/25 hover:opacity-95 active:scale-95 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Auto-Schedule from Courses</span>
                  </button>

                  <Link
                    href="/timetable/upload"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl glass-container border border-white/15 hover:border-[#5B5FEF]/50 text-xs font-bold text-[#DEE2F4] hover:text-white transition-all"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-[#7BD0FF]" />
                    <span>Scan Timetable Photo</span>
                  </Link>

                  <Link
                    href="/calendar"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl skeuo-button-secondary text-xs font-bold text-[#7BD0FF]"
                  >
                    <span>View Academic Calendar</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          ) : (

          <div className="space-y-4">
            {scheduledEntries.map((entry) => {
              const swapKey = `${dateKey.replace(/-/g, "")}_${entry.id}`;
              const originalSubject = subjects.find((s) => s.id === entry.subjectId);
              const effectiveSubId = classSubstitutes[swapKey] || entry.subjectId;
              const effectiveSubject =
                subjects.find((s) => s.id === effectiveSubId) || originalSubject;

              if (!effectiveSubject || !originalSubject) return null;

              const isSubstituted = effectiveSubId !== originalSubject.id;

              // Attendance status on this date for this subject & period
              const periodRecords = recordsOnDate.filter(
                (r) => r.subjectId === effectiveSubject.id
              );
              const matchedRecord = periodRecords.find((r) =>
                r.periodNumber !== undefined ? r.periodNumber === entry.periodNumber : true
              );
              const isMarked = !!matchedRecord;
              const isPresent = matchedRecord?.status === "present";
              const currentNote = getClassNote(effectiveSubject.id, selectedDate, entry.periodNumber);

              // Calculations
              const met = subjectMetrics[effectiveSubject.id];
              const curPct = met?.percentage || 0;
              const target = effectiveSubject.targetAttendance || 75;

              // Multi-hour calculation
              const durationHours = entry.isContinuousLab ? 2 : 1;

              // What-If projected calculations
              const totalConducted =
                effectiveSubject.presentClasses + effectiveSubject.absentClasses;
              const ifAttendPct =
                ((effectiveSubject.presentClasses + durationHours) /
                  (totalConducted + durationHours)) *
                100;
              const ifAbsentPct =
                (effectiveSubject.presentClasses / (totalConducted + durationHours)) * 100;
              const isBunkRisky = ifAbsentPct < target;

              return (
                <div
                  key={entry.id}
                  className={`glass-container p-5 rounded-3xl border transition-all ${
                    isMarked
                      ? isPresent
                        ? "border-[#10B981]/40 shadow-lg shadow-[#10B981]/5"
                        : "border-[#EF4444]/40 shadow-lg shadow-[#EF4444]/5"
                      : isSubstituted
                      ? "border-[#F59E0B]/40"
                      : "border-white/10 hover:border-[#5B5FEF]/30"
                  }`}
                >
                  {/* Top Metadata Row: Period Number + Time + Swap Button + Room */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wide bg-[#5B5FEF]/20 text-[#C0C1FF] border border-[#5B5FEF]/40">
                        {durationHours > 1
                          ? `PERIOD ${entry.periodNumber}-${entry.periodNumber + 1} • 2 HOURS LAB`
                          : `PERIOD ${entry.periodNumber} • ${formatMinutes(entry.startTime)} - ${formatMinutes(entry.endTime)}`}
                      </span>

                      {entry.room && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 px-2 py-0.5 rounded-md bg-white/5">
                          <MapPin className="w-3 h-3" />
                          <span>{entry.room}</span>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleOpenSwap(entry, originalSubject, swapKey)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border transition-all cursor-pointer ${
                        isSubstituted
                          ? "bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/50"
                          : "bg-[#7BD0FF]/15 text-[#7BD0FF] border-[#7BD0FF]/40 hover:bg-[#7BD0FF]/25"
                      }`}
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>{isSubstituted ? "Proxy Active" : "Swap Subject"}</span>
                    </button>
                  </div>

                  {/* If Substituted banner */}
                  {isSubstituted && (
                    <div className="mb-3 px-3 py-1.5 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/35 flex items-center justify-between text-xs text-[#F59E0B]">
                      <div className="flex items-center gap-1.5 font-bold">
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        <span>Proxy / Substitute for {originalSubject.name}</span>
                      </div>
                      <button
                        onClick={() => removeSubstitute(swapKey)}
                        className="p-1 hover:text-white transition-colors cursor-pointer"
                        title="Reset to timetable default"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Main Subject Info Row */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-1.5 h-10 rounded-full shrink-0"
                        style={{ backgroundColor: effectiveSubject.colorValue || "#5B5FEF" }}
                      />
                      <div>
                        <h4 className="text-base font-bold text-slate-900 dark:text-[#DEE2F4]">
                          {effectiveSubject.name}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-[rgba(222,226,244,0.65)]">
                          {effectiveSubject.facultyName}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-lg font-extrabold ${
                          curPct >= target
                            ? "text-[#10B981]"
                            : curPct >= 65
                            ? "text-[#F59E0B]"
                            : "text-[#EF4444]"
                        }`}
                      >
                        {curPct.toFixed(1)}%
                      </div>
                      <div className="text-[10px] text-slate-400">Target: {target}%</div>
                    </div>
                  </div>

                  {/* Projected Attendance Banner */}
                  <div
                    className={`p-3.5 rounded-2xl mb-4 skeuo-well ${
                      isBunkRisky
                        ? "border border-rose-500/30"
                        : "border border-black/10 dark:border-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                        <Sparkles className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
                        <span>Projected Attendance</span>
                      </div>
                      {isBunkRisky && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-500 dark:text-rose-400">
                          <span className="w-1.5 h-1.5 rounded-full skeuo-led-coral" />
                          <span>Absence drops below {target}%</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] flex items-center justify-between">
                        <span className="text-[10px] font-bold text-rose-500 dark:text-rose-300">IF ABSENT</span>
                        <span className="text-xs font-extrabold text-rose-500 dark:text-rose-300">
                          {ifAbsentPct.toFixed(1)}%
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">IF ATTEND</span>
                        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                          {ifAttendPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Class Note Excerpt (if note exists) */}
                  {currentNote && (
                    <div
                      onClick={() => handleOpenNote(effectiveSubject, entry)}
                      className="mb-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 hover:border-amber-400/60 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-amber-300 mb-1">
                        <span className="flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-amber-400" />
                          <span>Class Note</span>
                        </span>
                        <span className="text-[10px] text-amber-400/80 group-hover:text-amber-200 transition-colors flex items-center gap-1">
                          <PencilLine className="w-3 h-3" />
                          <span>Edit Note</span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed whitespace-pre-line font-normal">
                        {currentNote}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons or Logged Pill */}
                  <div className="pt-3 border-t border-black/10 dark:border-white/5 flex flex-wrap items-center justify-between gap-3">
                    {isMarked ? (
                      <>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border shadow-[0_2px_4px_rgba(0,0,0,0.1)] ${
                              isPresent
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40"
                                : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/40"
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isPresent ? "skeuo-led-green" : "skeuo-led-coral"
                              }`}
                            />
                            <span>
                              {isPresent
                                ? durationHours > 1
                                  ? `Present (${durationHours} hrs)`
                                  : "Present"
                                : durationHours > 1
                                ? `Absent (${durationHours} hrs)`
                                : "Absent"}
                            </span>
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Marked on {selectedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenNote(effectiveSubject, entry)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              currentNote
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25"
                                : "bg-white/5 text-slate-300 hover:text-white border-white/10 hover:bg-white/10"
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5 text-[#7BD0FF]" />
                            <span>{currentNote ? "Edit Note" : "Write Note"}</span>
                          </button>

                          <button
                            onClick={() =>
                              handleUnmark(
                                effectiveSubject.id,
                                effectiveSubject.name,
                                entry.periodNumber,
                                durationHours
                              )
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 border border-rose-500/30 active:translate-y-0.5 transition-all cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-medium mr-1">
                            Unmarked
                          </span>
                          <button
                            onClick={() => handleOpenNote(effectiveSubject, entry)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                              currentNote
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25"
                                : "bg-white/5 text-slate-400 hover:text-slate-200 border-white/10 hover:bg-white/10"
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5 text-[#7BD0FF]" />
                            <span>{currentNote ? "View Note" : "Write Note"}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleMark(
                                effectiveSubject.id,
                                "absent",
                                entry.periodNumber,
                                durationHours
                              )
                            }
                            className="py-2 px-3.5 rounded-xl text-xs font-bold bg-gradient-to-b from-rose-500/20 to-rose-600/10 hover:from-rose-500/30 hover:to-rose-600/20 text-rose-500 dark:text-rose-300 border border-rose-500/40 shadow-[0_2px_0_rgba(225,29,72,0.4),0_2px_6px_rgba(0,0,0,0.15)] active:translate-y-0.5 active:shadow-none transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span className="w-1.5 h-1.5 rounded-full skeuo-led-coral" />
                            <span>{durationHours > 1 ? `ABSENT (${durationHours}h)` : "ABSENT"}</span>
                          </button>

                          <button
                            onClick={() =>
                              handleMark(
                                effectiveSubject.id,
                                "present",
                                entry.periodNumber,
                                durationHours
                              )
                            }
                            className="py-2 px-4 rounded-xl text-xs font-extrabold bg-gradient-to-b from-emerald-500 to-emerald-700 hover:from-emerald-400 hover:to-emerald-600 text-white shadow-[0_3px_0_#065f46,0_4px_12px_rgba(16,185,129,0.35)] border-t border-emerald-300/40 active:translate-y-0.5 active:shadow-[0_1px_0_#065f46] transition-all cursor-pointer inline-flex items-center gap-1.5"
                          >
                            <span className="w-1.5 h-1.5 rounded-full skeuo-led-green" />
                            <span>{durationHours > 1 ? `ATTEND (${durationHours}h)` : "ATTEND"}</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* MODAL 1: Swap Subject / Proxy Class Sheet */}
      {isSwapModalOpen && activeSwapEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="glass-modal max-w-md w-full p-6 rounded-3xl border border-white/20 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-slate-900 dark:text-[#DEE2F4]">
                Swap Subject / Proxy Class
              </h3>
              <button
                onClick={() => setIsSwapModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-[rgba(222,226,244,0.70)] mb-4">
              Teacher absent? Select which substitute subject was conducted during Period{" "}
              {activeSwapEntry.entry.periodNumber}:
            </p>

            <div className="space-y-2 max-h-64 overflow-y-auto mb-6 pr-1">
              {subjects.map((sub) => {
                const isOriginal = sub.id === activeSwapEntry.originalSubject.id;
                const isCurrent =
                  classSubstitutes[activeSwapEntry.swapKey] === sub.id ||
                  (!classSubstitutes[activeSwapEntry.swapKey] && isOriginal);

                return (
                  <button
                    key={sub.id}
                    onClick={() => {
                      if (isOriginal) {
                        removeSubstitute(activeSwapEntry.swapKey);
                      } else {
                        setSubstitute(activeSwapEntry.swapKey, sub.id);
                      }
                      setIsSwapModalOpen(false);
                      showToast(
                        isOriginal
                          ? `Restored timetable default for Period ${activeSwapEntry.entry.periodNumber}`
                          : `Proxy set to ${sub.name}`
                      );
                    }}
                    className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isCurrent
                        ? "bg-[#5B5FEF]/20 border-[#5B5FEF] text-slate-900 dark:text-white"
                        : "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border-black/10 dark:border-white/10 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-2.5 h-6 rounded-sm"
                        style={{ backgroundColor: sub.colorValue }}
                      />
                      <div>
                        <div className="text-sm font-bold text-slate-900 dark:text-[#DEE2F4]">
                          {sub.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{sub.facultyName}</div>
                      </div>
                    </div>

                    {isOriginal && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                        DEFAULT
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setIsSwapModalOpen(false)}
              className="w-full py-3 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-700 dark:text-white font-bold text-sm transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* MODAL 2: Add Subject & Timetable Schedule Modal */}
      <AddSubjectModal
        isOpen={isAddSubjectModalOpen}
        onClose={() => setIsAddSubjectModalOpen(false)}
        initialDay={selectedDate.getDay() >= 1 && selectedDate.getDay() <= 6 ? selectedDate.getDay() : 1}
        onSuccess={(sub, days) => {
          showToast(
            `Subject "${sub.name}" added${
              days.length > 0 ? ` and assigned to ${days.length} day(s) in your timetable` : ""
            }!`
          );
        }}
      />

      {/* MODAL 3: Attendance Activity Heatmap */}
      {isHeatmapModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="glass-modal max-w-lg w-full p-6 rounded-3xl border border-black/10 dark:border-white/20 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Grid3X3 className="w-5 h-5 text-[#10B981]" />
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#DEE2F4]">
                  Attendance Activity Matrix
                </h3>
              </div>
              <button
                onClick={() => setIsHeatmapModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-[rgba(222,226,244,0.70)] mb-4">
              Historical presence density across current academic semester:
            </p>

            {/* Heatmap Grid computed from REAL records */}
            <div className="p-4 rounded-2xl bg-black/5 dark:bg-black/30 border border-black/10 dark:border-white/10 mb-4">
              <div className="grid grid-cols-12 gap-1.5">
                {Array.from({ length: 60 }).map((_, i) => {
                  const targetDay = new Date();
                  targetDay.setDate(targetDay.getDate() - (59 - i));
                  const dateStr = targetDay.toISOString().slice(0, 10);
                  const dayRecords = records.filter((r) => r.date.slice(0, 10) === dateStr);
                  const presentCount = dayRecords.filter((r) => r.status === "present").length;
                  const totalCount = dayRecords.length;

                  let intensity = 0;
                  if (presentCount >= 4) intensity = 3;
                  else if (presentCount >= 2) intensity = 2;
                  else if (presentCount >= 1) intensity = 1;

                  return (
                    <div
                      key={i}
                      className={`h-4 rounded-sm transition-all ${
                        totalCount === 0
                          ? "bg-slate-200 dark:bg-white/5"
                          : intensity === 1
                          ? "bg-[#10B981]/40"
                          : intensity === 2
                          ? "bg-[#10B981]/70"
                          : "bg-[#10B981]"
                      }`}
                      title={`${targetDay.toLocaleDateString("en-US", { month: "short", day: "numeric" })}: ${presentCount} present of ${totalCount} classes`}
                    />
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-3 text-[10px] text-slate-500 dark:text-slate-400">
                <span>Less</span>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 dark:bg-white/5" />
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]/30" />
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]/60" />
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#10B981]" />
                </div>
                <span>More</span>
              </div>
            </div>

            <button
              onClick={() => setIsHeatmapModalOpen(false)}
              className="w-full py-3 rounded-xl bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 text-slate-700 dark:text-white font-bold text-sm transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: Class Note Modal */}
      {noteModalData && (
        <ClassNoteModal
          isOpen={noteModalData.isOpen}
          onClose={() => setNoteModalData(null)}
          subjectName={noteModalData.subject.name}
          subjectCode={noteModalData.subject.code}
          facultyName={noteModalData.subject.facultyName}
          periodNumber={noteModalData.periodNumber}
          timeRange={noteModalData.timeRange}
          date={noteModalData.date}
          initialNote={noteModalData.initialNote}
          onSave={handleSaveNote}
          onDelete={handleDeleteNote}
        />
      )}
    </div>
  );
}
