"use client";

import React, { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTrackX } from "@/context/TrackXContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  PartyPopper,
  CheckCircle2,
  Sparkles,
  X,
  UploadCloud,
  Clock,
} from "lucide-react";
import { getHolidayInfo, getPublicHolidaysList } from "@/lib/holidays";
import { AddSubjectModal } from "@/components/subjects/AddSubjectModal";

interface AcademicEvent {
  id: string;
  dateKey: string; // YYYY-MM-DD
  title: string;
  type: "working" | "holiday" | "exam" | "attendance_due";
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIMETABLE_DAYS = [
  { dayOfWeek: 1, name: "Monday", short: "Mon" },
  { dayOfWeek: 2, name: "Tuesday", short: "Tue" },
  { dayOfWeek: 3, name: "Wednesday", short: "Wed" },
  { dayOfWeek: 4, name: "Thursday", short: "Thu" },
  { dayOfWeek: 5, name: "Friday", short: "Fri" },
  { dayOfWeek: 6, name: "Saturday", short: "Sat", isSaturdayHoliday: true },
  { dayOfWeek: 7, name: "Sunday", short: "Sun", isUniversalHoliday: true },
];

const WEEKDAY_OPTIONS = [
  { day: 1, label: "Monday" },
  { day: 2, label: "Tuesday" },
  { day: 3, label: "Wednesday" },
  { day: 4, label: "Thursday" },
  { day: 5, label: "Friday" },
];

function CalendarInner() {
  const searchParams = useSearchParams();
  const urlView = searchParams.get("view");

  const {
    timetable,
    subjects,
    records,
    holidayOverrides,
    toggleHolidayOverride,
    saturdayTimetableOverrides,
    setSaturdayTimetableOverride,
    academicEvents,
    addAcademicEvent,
    deleteAcademicEvent,
  } = useTrackX();

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [activeTab, setActiveTab] = useState<"calendar" | "timetable" | "holidays" | null>(null);
  const viewMode = activeTab ?? (urlView === "timetable" ? "timetable" : urlView === "holidays" ? "holidays" : "calendar");
  const setViewMode = (mode: "calendar" | "timetable" | "holidays") => setActiveTab(mode);
  const [holidayListYear, setHolidayListYear] = useState(today.getFullYear());

  const customEvents = academicEvents;

  const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventType, setNewEventType] = useState<AcademicEvent["type"]>("exam");
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [addClassDay, setAddClassDay] = useState<number | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 2500);
  };

  // Month navigation
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Days in current month
  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun .. 6 = Sat

  // Safe selected day bound
  const clampedSelectedDay = Math.min(selectedDay, daysInCurrentMonth);

  // Selected full date key
  const selectedDateObj = new Date(currentYear, currentMonth, clampedSelectedDay);
  const selectedDateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(clampedSelectedDay).padStart(2, "0")}`;
  const selectedHolidayInfo = getHolidayInfo(selectedDateObj, holidayOverrides);
  const isSelectedDateHoliday = selectedHolidayInfo.isHoliday;

  // Timetable scheduled sessions for selected date
  const isSelectedDateSaturday = selectedDateObj.getDay() === 6;
  const selectedSaturdayFollowedWeekday = isSelectedDateSaturday
    ? saturdayTimetableOverrides[selectedDateKey]
    : undefined;
  const effectiveSelectedWeekday = (isSelectedDateSaturday && !isSelectedDateHoliday)
    ? selectedSaturdayFollowedWeekday
    : selectedDateObj.getDay() === 0
    ? 7
    : selectedDateObj.getDay();

  const scheduledClasses = isSelectedDateHoliday || (isSelectedDateSaturday && !selectedSaturdayFollowedWeekday)
    ? []
    : timetable
        .filter((t) => t.dayOfWeek === effectiveSelectedWeekday && t.isEnabled !== false)
        .slice()
        .sort((a, b) => a.startTime - b.startTime);


  // Attendance records on selected date
  const recordsOnSelectedDate = records.filter(
    (r) => r.date.slice(0, 10) === selectedDateKey
  );

  // Events on selected date
  const eventsOnSelectedDate = customEvents.filter(
    (ev) => ev.dateKey === selectedDateKey
  );

  const monthYearDisplay = new Date(currentYear, currentMonth, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" }
  );

  const formatMinutes = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const period = h >= 12 ? "PM" : "AM";
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const displayM = m < 10 ? `0${m}` : m;
    return `${displayH}:${displayM} ${period}`;
  };

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;

    await addAcademicEvent({
      dateKey: selectedDateKey,
      title: newEventTitle.trim(),
      type: newEventType,
    });

    setNewEventTitle("");
    setIsAddEventModalOpen(false);
    showToast(`Added event for ${selectedDateKey}`);
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteAcademicEvent(id);
    showToast("Event removed");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-[#0E131F]/90 border border-[#5B5FEF]/40 shadow-2xl backdrop-blur-xl text-sm font-semibold text-white flex items-center gap-3 animate-in slide-in-from-bottom-5">
          <Sparkles className="w-4 h-4 text-[#7BD0FF]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase font-bold tracking-widest text-cyan-400">
              Academic Milestones & Routine
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            <span className="text-xs text-slate-400">
              {viewMode === "calendar"
                ? "Live Monthly Matrix"
                : viewMode === "timetable"
                ? "Weekly Timetable Routine"
                : "Official Public Holidays"}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {viewMode === "calendar"
              ? "Academic Calendar"
              : viewMode === "timetable"
              ? "Weekly Timetable"
              : "Academic & Public Holidays"}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Switcher Pills */}
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/10">
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === "calendar"
                  ? "bg-[#5B5FEF] text-white shadow-md shadow-[#5B5FEF]/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              📅 Month
            </button>
            <button
              onClick={() => setViewMode("timetable")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === "timetable"
                  ? "bg-[#5B5FEF] text-white shadow-md shadow-[#5B5FEF]/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              📋 Weekly Timetable
            </button>
            <button
              onClick={() => setViewMode("holidays")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === "holidays"
                  ? "bg-[#5B5FEF] text-white shadow-md shadow-[#5B5FEF]/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              🎉 Holidays
            </button>
          </div>

          <Link href="/timetable/upload">
            <GlassButton
              size="sm"
              variant="secondary"
              icon={<UploadCloud className="w-4 h-4 text-purple-400" />}
            >
              Import Timetable
            </GlassButton>
          </Link>

          {viewMode === "calendar" && (
            <>
              <GlassButton
                size="sm"
                variant="secondary"
                icon={<ChevronLeft className="w-4 h-4" />}
                onClick={handlePrevMonth}
              >
                Prev
              </GlassButton>
              <span className="text-sm font-bold px-3 text-slate-900 dark:text-white min-w-[140px] text-center">
                {monthYearDisplay}
              </span>
              <GlassButton
                size="sm"
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={handleNextMonth}
              >
                Next
              </GlassButton>
            </>
          )}
        </div>
      </div>

      {viewMode === "calendar" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Matrix (8 cols) */}
        <div className="lg:col-span-8 glass-panel rounded-3xl p-6 border border-white/10 shadow-2xl">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-2 mb-4 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
            {WEEKDAY_NAMES.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Blank leading slots */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`blank-${idx}`} className="p-2 min-h-[68px]" />
            ))}

            {/* Days of Month */}
            {Array.from({ length: daysInCurrentMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const isSelected = clampedSelectedDay === dayNum;
              const isToday =
                today.getFullYear() === currentYear &&
                today.getMonth() === currentMonth &&
                today.getDate() === dayNum;

              // Check if any events or holiday (Sunday, Public Holiday, or Custom Override)
              const dayDate = new Date(currentYear, currentMonth, dayNum);
              const dayHolidayInfo = getHolidayInfo(dayDate, holidayOverrides);
              const isDayHoliday = dayHolidayInfo.isHoliday;
              const dayEvents = customEvents.filter((ev) => ev.dateKey === dateKey);

              // Check if attendance records exist on this day
              const dayRecords = records.filter((r) => r.date.slice(0, 10) === dateKey);
              const hasPresent = dayRecords.some((r) => r.status === "present");
              const hasAbsent = dayRecords.some((r) => r.status === "absent");

              return (
                <div
                  key={dayNum}
                  onClick={() => setSelectedDay(dayNum)}
                  className={`p-2.5 rounded-2xl flex flex-col items-center justify-between min-h-[72px] cursor-pointer transition-all border active:translate-y-0.5 ${
                    isSelected
                      ? "skeuo-button-primary text-white shadow-[0_3px_0_#2E3294,0_6px_12px_rgba(79,70,229,0.35)]"
                      : isToday
                      ? "skeuo-deck border border-cyan-400/50 shadow-[0_2px_4px_rgba(0,0,0,0.15)]"
                      : isDayHoliday
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                      : "skeuo-card border-black/5 dark:border-white/5 hover:border-white/20"
                  }`}
                >
                  <span
                    className={`text-sm font-bold ${
                      isSelected
                        ? "text-white"
                        : isToday
                        ? "text-cyan-400"
                        : isDayHoliday
                        ? "text-amber-400"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {dayNum}
                  </span>

                  {/* Indicators strip */}
                  <div className="flex items-center gap-1 mt-1 flex-wrap justify-center">
                    {/* Attendance status indicators */}
                    {hasPresent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_#10B981]" title="Attended Sessions" />
                    )}
                    {hasAbsent && (
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_4px_#F43F5E]" title="Missed Sessions" />
                    )}
                    {/* Holiday indicator */}
                    {isDayHoliday && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Holiday" />
                    )}
                    {/* Custom events */}
                    {dayEvents.map((ev) => (
                      <span
                        key={ev.id}
                        className={`w-1.5 h-1.5 rounded-full ${
                          ev.type === "exam"
                            ? "bg-rose-500"
                            : ev.type === "holiday"
                            ? "bg-amber-400"
                            : "bg-cyan-400"
                        }`}
                        title={ev.title}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Day Milestones & Scheduled Classes Side Panel (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          <GlassCard variant="elevated" className="p-6">
            <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10 mb-4">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  {selectedDateObj.toLocaleDateString("en-US", { weekday: "long" })}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {selectedDateObj.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsAddEventModalOpen(true)}
                  className="p-2 rounded-xl glass-card hover:bg-white/10 text-cyan-400 cursor-pointer"
                  title="Add Event"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Holiday toggle for selected day */}
            <div className="mb-4">
              <button
                onClick={() => toggleHolidayOverride(selectedDateKey)}
                className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isSelectedDateHoliday
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20"
                }`}
              >
                {isSelectedDateHoliday ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Set as Regular Working Day</span>
                  </>
                ) : (
                  <>
                    <PartyPopper className="w-3.5 h-3.5" />
                    <span>Mark as College Holiday</span>
                  </>
                )}
              </button>
            </div>

            {/* Saturday Working Timetable Selector */}
            {isSelectedDateSaturday && !isSelectedDateHoliday && (
              <div className="mb-4 p-3.5 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">📚</span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400">
                      Saturday Working Routine
                    </span>
                  </div>
                  <button
                    onClick={() => setSaturdayTimetableOverride(selectedDateKey, null)}
                    className="text-[10px] font-bold text-amber-300 hover:underline cursor-pointer"
                  >
                    Reset to Holiday
                  </button>
                </div>
                <p className="text-xs text-slate-200">
                  Following: <strong className="text-white">{WEEKDAY_OPTIONS.find((w) => w.day === effectiveSelectedWeekday)?.label}&apos;s Timetable</strong>
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/10">
                  <span className="text-[10px] text-slate-400 font-medium mr-1">Switch:</span>
                  {WEEKDAY_OPTIONS.map((wd) => (
                    <button
                      key={wd.day}
                      onClick={() => setSaturdayTimetableOverride(selectedDateKey, wd.day)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer ${
                        effectiveSelectedWeekday === wd.day
                          ? "bg-[#5B5FEF] text-white shadow-md shadow-[#5B5FEF]/30 border border-white/20"
                          : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white border border-white/10"
                      }`}
                    >
                      {wd.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Saturday Holiday Quick Action */}
            {isSelectedDateSaturday && isSelectedDateHoliday && (
              <div className="mb-4 p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2 text-center">
                <p className="text-xs text-slate-300 font-semibold">
                  College open this Saturday? Apply a weekday routine:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {WEEKDAY_OPTIONS.map((wd) => (
                    <button
                      key={wd.day}
                      onClick={() => setSaturdayTimetableOverride(selectedDateKey, wd.day)}
                      className="px-2.5 py-1 rounded-xl text-[10px] font-bold bg-[#5B5FEF]/20 text-[#7BD0FF] hover:bg-[#5B5FEF]/35 border border-[#5B5FEF]/30 transition-all cursor-pointer"
                    >
                      Follow {wd.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Academic Events List */}
            <div className="space-y-2 mb-5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                Events & Overrides ({eventsOnSelectedDate.length})
              </span>

              {eventsOnSelectedDate.length === 0 ? (
                <p className="text-xs text-slate-400 py-1">
                  No special academic events logged for this date.
                </p>
              ) : (
                eventsOnSelectedDate.map((ev) => (
                  <div
                    key={ev.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                      ev.type === "exam"
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        : ev.type === "holiday"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                        : "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                    }`}
                  >
                    <div>
                      <span className="text-[9px] font-extrabold uppercase tracking-wider block opacity-75">
                        {ev.type}
                      </span>
                      <h4 className="text-xs font-bold mt-0.5">{ev.title}</h4>
                    </div>
                    <button
                      onClick={() => handleDeleteEvent(ev.id)}
                      className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                      title="Remove event"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Timetable Scheduled Classes on this day */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                  Timetable Routine ({scheduledClasses.length})
                </span>
                <Link
                  href="/attendance"
                  className="text-[10px] font-bold text-cyan-400 hover:underline"
                >
                  Log Attendance
                </Link>
              </div>

              {isSelectedDateHoliday ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">
                  🎉 {selectedHolidayInfo.name || "College is closed on this holiday."}
                </div>
              ) : scheduledClasses.length === 0 ? (
                <p className="text-xs text-slate-400 py-1">
                  No classes scheduled in timetable for this weekday.
                </p>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {scheduledClasses.map((entry) => {
                    const sub = subjects.find((s) => s.id === entry.subjectId);
                    if (!sub) return null;

                    const hasAttended = recordsOnSelectedDate.some(
                      (r) =>
                        r.subjectId === sub.id &&
                        r.status === "present" &&
                        (r.periodNumber !== undefined ? r.periodNumber === entry.periodNumber : true)
                    );
                    const hasAbsent = recordsOnSelectedDate.some(
                      (r) =>
                        r.subjectId === sub.id &&
                        r.status === "absent" &&
                        (r.periodNumber !== undefined ? r.periodNumber === entry.periodNumber : true)
                    );

                    return (
                      <div
                        key={entry.id}
                        className="p-2.5 rounded-xl glass-card border border-white/5 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-white/10 font-bold text-[10px] text-slate-300">
                            P{entry.periodNumber}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white line-clamp-1">
                              {sub.name}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {formatMinutes(entry.startTime)} • {entry.room || "LH"}
                            </p>
                          </div>
                        </div>

                        <div>
                          {hasAttended ? (
                            <span className="text-[10px] font-bold text-emerald-400">
                              Attended ✓
                            </span>
                          ) : hasAbsent ? (
                            <span className="text-[10px] font-bold text-rose-400">
                              Missed ✗
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400">Scheduled</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </GlassCard>

          {/* Academic Legend */}
          <GlassCard variant="default" className="p-4 space-y-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>Attended Class Session</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
              <span>Missed Class / Examination</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>Sunday / Public Holiday</span>
            </div>
          </GlassCard>
        </div>
      </div>
      )}

      {/* VIEW 2: WEEKLY TIMETABLE ROUTINE (MON-SUN) */}
      {viewMode === "timetable" && (
        <div className="space-y-6">
          {/* Holiday notice banner */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎉</span>
              <div>
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                  College Holiday Engine Active
                </h4>
                <p className="text-xs text-amber-200/90 mt-0.5">
                  <strong>Sunday is a universal holiday for all colleges.</strong> All official public and gazetted holidays automatically suspend classes on those dates.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <GlassButton
                size="sm"
                variant="primary"
                icon={<Plus className="w-3.5 h-3.5 text-cyan-400" />}
                onClick={() => {
                  setAddClassDay(undefined);
                  setIsAddClassOpen(true);
                }}
              >
                Add Class
              </GlassButton>
              <Link href="/timetable/upload">
                <GlassButton size="sm" variant="secondary" icon={<UploadCloud className="w-3.5 h-3.5" />}>
                  Upload Timetable
                </GlassButton>
              </Link>
            </div>
          </div>

          {/* 7-column Weekly Schedule Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
            {TIMETABLE_DAYS.map((day) => {
              const isSunday = day.dayOfWeek === 7;
              const isSaturday = day.dayOfWeek === 6;
              const dayClasses = timetable
                .filter((t) => t.dayOfWeek === day.dayOfWeek && t.isEnabled !== false)
                .slice()
                .sort((a, b) => a.startTime - b.startTime);

              return (
                <div
                  key={day.dayOfWeek}
                  className={`rounded-3xl p-4 flex flex-col justify-between border transition-all ${
                    isSunday
                      ? "bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/35 shadow-[0_4px_20px_rgba(245,158,11,0.08)]"
                      : isSaturday && dayClasses.length === 0
                      ? "bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/25"
                      : "glass-panel border-black/5 dark:border-white/10"
                  }`}
                >
                  <div>
                    {/* Day Column Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-black/5 dark:border-white/10 mb-3">
                      <div>
                        <span
                          className={`text-[10px] font-black uppercase tracking-wider ${
                            isSunday || isSaturday ? "text-amber-400" : "text-cyan-400"
                          }`}
                        >
                          {day.short}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                          {day.name}
                        </h3>
                      </div>
                      {isSunday ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Holiday
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setAddClassDay(day.dayOfWeek);
                              setIsAddClassOpen(true);
                            }}
                            className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-all cursor-pointer"
                            title={`Add class to ${day.name}`}
                          >
                            <Plus className="w-3 h-3 text-cyan-400" />
                          </button>
                          {isSaturday ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                              Weekend Off
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-white/10 text-slate-400">
                              {dayClasses.length} {dayClasses.length === 1 ? "Class" : "Classes"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Day Column Content */}
                    {isSunday ? (
                      <div className="py-6 px-2 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                          <PartyPopper className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-amber-300">
                            Universal College Holiday
                          </h4>
                          <p className="text-[11px] text-amber-200/70 mt-1 leading-relaxed">
                            Sunday is universally observed as an off-day across all colleges. No classes scheduled.
                          </p>
                        </div>
                        <span className="inline-block px-2.5 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Enjoy Rest Day 🏖️
                        </span>
                      </div>
                    ) : isSaturday && dayClasses.length === 0 ? (
                      <div className="py-6 px-2 text-center space-y-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto">
                          <PartyPopper className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-amber-300">
                            Weekend Holiday
                          </h4>
                          <p className="text-[11px] text-amber-200/70 mt-1 leading-relaxed">
                            Generally off. When college is open, choose any Mon–Fri routine to follow.
                          </p>
                        </div>
                        <span className="inline-block px-2 py-0.5 rounded-lg text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Follows Mon–Fri Routine
                        </span>
                      </div>
                    ) : dayClasses.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 space-y-1">
                        <Clock className="w-5 h-5 mx-auto text-slate-600 mb-1" />
                        <p className="font-semibold">No Classes</p>
                        <p className="text-[10px] text-slate-500">Free schedule</p>
                        <button
                          onClick={() => {
                            setAddClassDay(day.dayOfWeek);
                            setIsAddClassOpen(true);
                          }}
                          className="mt-2 px-3 py-1.5 rounded-xl bg-[#5B5FEF]/15 hover:bg-[#5B5FEF]/25 text-[#7BD0FF] text-[11px] font-bold border border-[#5B5FEF]/30 transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Class</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {dayClasses.map((entry) => {
                          const sub = subjects.find((s) => s.id === entry.subjectId);
                          if (!sub) return null;
                          return (
                            <div
                              key={entry.id}
                              className="p-3 rounded-2xl glass-card border border-white/5 space-y-1 hover:border-cyan-500/30 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                                  P{entry.periodNumber}
                                </span>
                                {entry.isContinuousLab && (
                                  <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                                    Lab
                                  </span>
                                )}
                              </div>
                              <h4
                                className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1"
                                title={sub.name}
                              >
                                {sub.name}
                              </h4>
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                                <Clock className="w-3 h-3" />
                                <span>
                                  {formatMinutes(entry.startTime)} – {formatMinutes(entry.endTime)}
                                </span>
                              </div>
                              {(entry.room || sub.facultyName) && (
                                <p className="text-[10px] text-slate-500 truncate">
                                  {entry.room && `Room: ${entry.room}`} {entry.room && sub.facultyName && "•"} {sub.facultyName}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: OFFICIAL PUBLIC HOLIDAYS DIRECTORY */}
      {viewMode === "holidays" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl glass-panel border border-white/10">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                Government & University Gazetted Days
              </span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
                Official Public Holidays Directory
              </h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                TrackX automatically marks these dates as holidays in your timetable and attendance schedule. Sunday is always observed as a universal holiday.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {[2025, 2026, 2027].map((yr) => (
                <button
                  key={yr}
                  onClick={() => setHolidayListYear(yr)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    holidayListYear === yr
                      ? "skeuo-button-primary text-white"
                      : "glass-card text-slate-400 hover:text-white"
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getPublicHolidaysList(holidayListYear).map((item) => (
              <div
                key={item.dateKey}
                className="p-5 rounded-2xl glass-card border border-white/5 space-y-2 relative overflow-hidden"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-mono font-bold text-cyan-400 block">
                      {new Date(`${item.dateKey}T00:00:00`).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {item.name}
                    </h4>
                  </div>
                  <span className="text-xl">🎉</span>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {item.dayOfWeek}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {item.isSunday ? "Falls on Sunday (Weekend Holiday)" : "Official College Holiday"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {isAddEventModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsAddEventModalOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
          />
          <div className="relative w-full max-w-md glass-panel p-6 rounded-3xl border border-white/20 shadow-2xl z-10 animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Add Academic Milestone
              </h3>
              <button
                onClick={() => setIsAddEventModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Midterm Examination / Project Submission"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-slate-900 dark:text-white focus:outline-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Category
                </label>
                <select
                  value={newEventType}
                  onChange={(e) =>
                    setNewEventType(e.target.value as AcademicEvent["type"])
                  }
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-slate-900 dark:text-white focus:outline-cyan-400 bg-slate-900"
                >
                  <option value="exam">Examination / Test</option>
                  <option value="attendance_due">Project / Assignment Due</option>
                  <option value="holiday">Special Holiday / Festival</option>
                  <option value="working">Special Working Session</option>
                </select>
              </div>

              <div className="text-xs text-slate-400">
                Date: <strong>{selectedDateKey}</strong>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <GlassButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsAddEventModalOpen(false)}
                >
                  Cancel
                </GlassButton>
                <GlassButton type="submit" variant="primary" size="sm">
                  Add to Calendar
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Subject & Schedule to Timetable Modal */}
      <AddSubjectModal
        isOpen={isAddClassOpen}
        initialDay={addClassDay}
        onClose={() => setIsAddClassOpen(false)}
        onSuccess={(sub, days) => {
          showToast(
            `Subject "${sub.name}" scheduled on ${
              days.length > 0 ? `${days.length} day(s)` : "your curriculum"
            }!`
          );
        }}
      />
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading schedule...</div>}>
      <CalendarInner />
    </Suspense>
  );
}
