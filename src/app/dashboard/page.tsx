"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTrackX } from "@/context/TrackXContext";
import { calculateIfBunk } from "@/lib/attendanceMath";
import {
  ChevronDown,
  ShieldCheck,
  AlertCircle,
  ChevronRight,
  X,
  Plus,
  Minus,
  BookOpen,
  CalendarDays,
  Brain,
  CheckCircle2,
  PartyPopper,
  FileText,
  User,
  Settings,
  LogOut,
  Calendar,
} from "lucide-react";
import { getHolidayInfo } from "@/lib/holidays";
import { Subject, TimetableEntry } from "@/types/trackx";
import { ClassNoteModal } from "@/components/attendance/ClassNoteModal";

// ─────────────────────────────────────────────────────────
// ATTENDANCE RING  (SVG-based, reference-exact)
// ─────────────────────────────────────────────────────────
function AttendanceRing({
  pct,
  target,
  attended,
  conducted,
}: {
  pct: number;
  target: number;
  attended: number;
  conducted: number;
}) {
  const R = 70;
  const circ = 2 * Math.PI * R;
  const dash = Math.min(pct / 100, 1) * circ;
  const isOk = pct >= target;

  return (
    <div className="flex flex-col items-center justify-center">
      {/* Ring */}
      <div className="relative w-[172px] h-[172px]">
        <svg
          width="172" height="172"
          viewBox="0 0 172 172"
          className="-rotate-90"
          style={{ display: "block" }}
        >
          {/* Track */}
          <circle cx="86" cy="86" r={R} fill="none" stroke="#333333" strokeWidth="8" />
          {/* Arc */}
          <circle
            cx="86" cy="86" r={R}
            fill="none"
            stroke={isOk ? "#4ADE80" : "#F87171"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>

        {/* Centre text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span
            className="text-[38px] font-black tracking-tight leading-none"
            style={{ color: "#FFFFFF" }}
            suppressHydrationWarning
          >
            {Math.round(pct)}
            <span className="text-[22px] font-bold">%</span>
          </span>
          <span
            className="text-[10px] font-semibold uppercase tracking-[1.5px] mt-0.5"
            style={{ color: "#666666" }}
          >
            OVERALL
          </span>
        </div>
      </div>

      {/* Detail */}
      <p className="text-[11px] text-center mt-3 max-w-[160px]" style={{ color: "#666666" }}>
        {conducted > 0
          ? `${attended} of ${conducted} classes attended`
          : pct > 0
          ? "Baseline percentage (counts unavailable)"
          : "0 of 0 classes attended"}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// STAT CARD  (Safe to Skip / Must Attend)
// ─────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
}: {
  label: string;
  value: number;
  subtitle: string;
  icon: React.ElementType;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col justify-between"
      style={{
        background: "#252525",
        border: "1px solid rgba(255,255,255,0.07)",
        minHeight: 160,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold uppercase tracking-[1.5px]"
          style={{ color: "#888888" }}
        >
          {label}
        </span>
        <Icon className="w-4 h-4" style={{ color: "#555555" }} />
      </div>

      <div>
        <div
          className="text-[52px] font-black leading-none tracking-tight"
          style={{ color: "#F0F0F0" }}
          suppressHydrationWarning
        >
          {String(value).padStart(2, "0")}
        </div>
        <p
          className="text-[11px] mt-3 leading-relaxed"
          style={{ color: "#555555" }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SUBJECT MINI CARD  (reference-exact horizontal tile)
// ─────────────────────────────────────────────────────────
function SubjectMiniCard({
  name,
  pct,
  target,
  attended,
  conducted,
  onClick,
}: {
  name: string;
  code?: string;
  pct: number;
  target: number;
  attended: number;
  conducted: number;
  onClick?: () => void;
}) {
  const isOk   = pct >= target;
  const isEdge = !isOk && pct >= target - 5;
  const color  = isOk ? "#4ADE80" : isEdge ? "#FBBF24" : "#FBBF24";

  return (
    <div
      onClick={onClick}
      className="rounded-2xl p-4 cursor-pointer flex flex-col gap-3"
      style={{
        background: "#2A2A2A",
        border: "1px solid rgba(255,255,255,0.06)",
        minHeight: 100,
        transition: "background 0.15s ease",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#303030")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "#2A2A2A")}
    >
      {/* Top row: name + pct */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium leading-tight" style={{ color: "#AAAAAA" }}>
            {name}
          </p>
        </div>
        <span
          className="text-base font-black shrink-0"
          style={{ color }}
        >
          {Math.round(pct)}%
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-1 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: color,
            transition: "width 0.7s cubic-bezier(0.16,1,0.3,1)",
          }}
        />
      </div>

      {/* Count */}
      <p className="text-[10px]" style={{ color: "#555555" }}>
        {conducted > 0 ? `${attended} / ${conducted} classes` : "Counts unavailable"}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// SCHEDULE ROW
// ─────────────────────────────────────────────────────────
function ScheduleRow({
  startMin,
  endMin,
  name,
  room,
  faculty,
  status,
  note,
  onNoteClick,
}: {
  startMin: number;
  endMin: number;
  name: string;
  room?: string;
  faculty?: string;
  status: "now" | "soon" | "upcoming" | "past";
  note?: string;
  onNoteClick?: () => void;
}) {
  const fmt = (m: number) => {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}:${mm < 10 ? "0" + mm : mm}`;
  };

  const isNow  = status === "now";
  const isPast = status === "past";
  const minutesAway = status === "soon" ? startMin - (new Date().getHours() * 60 + new Date().getMinutes()) : 0;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all"
      style={{
        background: isNow ? "rgba(74,222,128,0.04)" : "transparent",
        opacity: isPast ? 0.5 : 1,
      }}
    >
      {/* Time */}
      <div className="w-12 shrink-0 text-right">
        <div className="text-sm font-semibold" style={{ color: isPast ? "#555555" : "#CCCCCC" }}>
          {fmt(startMin)}
        </div>
        <div className="text-[10px]" style={{ color: "#444444" }}>{fmt(endMin)}</div>
      </div>

      {/* Dot */}
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{
          background: isNow ? "#4ADE80" : "#333333",
          boxShadow: isNow ? "0 0 6px #4ADE80" : "none",
        }}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: isPast ? "#666666" : "#F0F0F0" }}>
          {name}
        </p>
        {(room || faculty) && (
          <p className="text-[11px] truncate mt-0.5" style={{ color: "#555555" }}>
            {[room, faculty].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      {/* Note indicator / button */}
      <div className="shrink-0 flex items-center">
        {note ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNoteClick?.();
            }}
            title={`Class Note: ${note}`}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer max-w-[130px] truncate"
          >
            <FileText className="w-3 h-3 text-amber-400 shrink-0" />
            <span className="truncate">{note}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onNoteClick?.();
            }}
            title="Write class note"
            className="p-1.5 rounded-lg text-slate-500 hover:text-[#7BD0FF] hover:bg-white/5 transition-all cursor-pointer opacity-70 hover:opacity-100"
          >
            <FileText className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Status badge */}
      <div className="shrink-0">
        {isNow && (
          <span className="text-[11px] font-black tracking-wider" style={{ color: "#4ADE80" }}>NOW</span>
        )}
        {status === "soon" && minutesAway > 0 && (
          <span className="text-[11px]" style={{ color: "#888888" }}>IN {minutesAway} MIN</span>
        )}
        {status === "upcoming" && (
          <span className="text-[11px]" style={{ color: "#555555" }}>UPCOMING</span>
        )}
        {isPast && (
          <span className="text-[11px]" style={{ color: "#333333" }}>DONE</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// WEEKLY BAR CHART
// ─────────────────────────────────────────────────────────
const PAST_BAR_HEIGHTS = [65, 75, 70, 80, 60, 50, 40];

function WeeklyChart({ todayIdx }: { todayIdx: number }) {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  const bars = days.map((_, i) => {
    if (i > todayIdx) return { height: 15, isToday: false, hasPassed: false };
    if (i === todayIdx) return { height: 82, isToday: true, hasPassed: false };
    return { height: PAST_BAR_HEIGHTS[i] ?? 60, isToday: false, hasPassed: true };
  });

  return (
    <div className="flex items-end gap-2 h-[80px]">
      {bars.map((bar, i) => (
        <div key={`${days[i]}-${i}`} className="flex-1 flex flex-col items-center gap-1.5">
          <div
            className="w-full rounded-lg"
            style={{
              height: `${bar.height}%`,
              background: bar.isToday
                ? "#4ADE80"
                : bar.hasPassed
                ? "#333333"
                : "#222222",
              transition: "height 0.6s cubic-bezier(0.16,1,0.3,1)",
            }}
          />
          <span
            className="text-[10px] font-medium"
            style={{ color: bar.isToday ? "#4ADE80" : "#444444" }}
          >
            {days[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// MODAL OVERLAY
// ─────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-md rounded-2xl p-6"
        style={{
          background: "#252525",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
        }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════
//  MAIN PAGE
// ═════════════════════════════════════════════════════════
const WEEKDAY_NAMES_MAP: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

export default function DashboardPage() {
  const router = useRouter();
  const {
    user, overallMetrics, subjects, timetable, subjectMetrics,
    records, markAttendance, unmarkAttendance, academicEvents, holidayOverrides,
    saturdayTimetableOverrides, getClassNote, saveClassNote, deleteClassNote,
    logout,
  } = useTrackX();

  const isAdmin = user?.email?.toLowerCase().trim() === "pratapvarmauppalapati6@gmail.com";

  useEffect(() => {
    // If admin arrives at /dashboard without ?view=student, immediately take them to /admin
    if (isAdmin && typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("view") !== "student") {
        router.replace("/admin");
      }
    }
  }, [isAdmin, router]);

  const [now] = useState(() => new Date());
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const [bunkModal, setBunkModal]     = useState(false);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [simSkips, setSimSkips]       = useState(1);
  const [toast, setToast]             = useState<string | null>(null);

  const [noteModalData, setNoteModalData] = useState<{
    isOpen: boolean;
    subject: Subject;
    entry?: TimetableEntry;
    periodNumber?: number;
    timeRange?: string;
    date: Date;
    initialNote: string;
  } | null>(null);

  const fmtMinutes = (m: number) => {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}:${mm < 10 ? "0" + mm : mm}`;
  };

  const handleOpenNoteForEntry = (entry: TimetableEntry) => {
    const sub = subjects.find((s) => s.id === entry.subjectId);
    if (!sub) return;
    const note = getClassNote(sub.id, now, entry.periodNumber);
    setNoteModalData({
      isOpen: true,
      subject: sub,
      entry,
      periodNumber: entry.periodNumber,
      timeRange: `${fmtMinutes(entry.startTime)} - ${fmtMinutes(entry.endTime)}`,
      date: now,
      initialNote: note,
    });
  };

  const handleOpenNoteForActive = () => {
    if (!activeSubObj) return;
    const period = activeEntry?.periodNumber;
    const note = getClassNote(activeSubObj.id, now, period);
    const timeRange = activeEntry
      ? `${fmtMinutes(activeEntry.startTime)} - ${fmtMinutes(activeEntry.endTime)}`
      : undefined;
    setNoteModalData({
      isOpen: true,
      subject: activeSubObj,
      entry: activeEntry,
      periodNumber: period,
      timeRange,
      date: now,
      initialNote: note,
    });
  };

  const handleSaveDashboardNote = async (text: string) => {
    if (!noteModalData) return;
    await saveClassNote(
      noteModalData.subject.id,
      noteModalData.date,
      noteModalData.periodNumber,
      text
    );
    showToast(text.trim() ? "Class note saved! 📝" : "Class note removed.");
  };

  const handleDeleteDashboardNote = async () => {
    if (!noteModalData) return;
    await deleteClassNote(
      noteModalData.subject.id,
      noteModalData.date,
      noteModalData.periodNumber
    );
    showToast("Class note deleted.");
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((c) => (c === msg ? null : c)), 3000);
  };

  const hour      = now.getHours();
  const greeting  = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = user?.name?.split(" ")[0] ?? "Student";
  const targetPct = user?.globalTarget ?? 75;
  const pct       = overallMetrics.percentage;

  const todayIso = now.toISOString().slice(0, 10);
  const isTodaySaturday = now.getDay() === 6;
  const holidayInfo = useMemo(() => getHolidayInfo(now, holidayOverrides), [now, holidayOverrides]);
  const isTodayHoliday = holidayInfo.isHoliday;

  const saturdayFollowedWeekday = isTodaySaturday ? saturdayTimetableOverrides[todayIso] : undefined;
  const effectiveTodayDay = (isTodaySaturday && !isTodayHoliday && saturdayFollowedWeekday)
    ? saturdayFollowedWeekday
    : now.getDay() === 0
    ? 7
    : now.getDay();

  const curMin = now.getHours() * 60 + now.getMinutes();

  const todayClasses = useMemo(
    () =>
      isTodayHoliday || (isTodaySaturday && !saturdayFollowedWeekday)
        ? []
        : timetable
            .filter((t) => t.dayOfWeek === effectiveTodayDay && t.isEnabled !== false)
            .slice()
            .sort((a, b) => a.startTime - b.startTime),
    [timetable, effectiveTodayDay, isTodayHoliday, isTodaySaturday, saturdayFollowedWeekday]
  );


  const sortedByRisk = useMemo(
    () => [...subjects].sort((a, b) =>
      (subjectMetrics[a.id]?.percentage ?? 100) - (subjectMetrics[b.id]?.percentage ?? 100)
    ), [subjects, subjectMetrics]
  );

  const totalSafe     = overallMetrics.safeBunks;
  const totalRecovery = overallMetrics.requiredRecovery;
  const focusSub      = sortedByRisk[0];

  const todayDow = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon…6=Sun

  const formattedDate = useMemo(
    () => now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" }),
    [now]
  );

  // Bunk simulator state
  const activeSub  = subjects.find((s) => s.id === selectedSub) ?? focusSub;
  const activeMet  = activeSub ? subjectMetrics[activeSub.id] : null;
  const activeAtt  = activeSub?.presentClasses ?? 0;
  const activeCon  = (activeSub?.presentClasses ?? 0) + (activeSub?.absentClasses ?? 0);
  const activeTgt  = activeSub?.targetAttendance ?? targetPct;
  const curBunkPct = activeMet?.percentage ?? 0;
  const projPct    = activeSub ? calculateIfBunk(activeAtt, activeCon, simSkips) : 0;

  // Active class for mark button
  const ongoingEntry  = todayClasses.find((c) => curMin >= c.startTime && curMin < c.endTime);
  const upcomingEntry = todayClasses.find((c) => c.startTime > curMin);
  const activeEntry   = ongoingEntry ?? upcomingEntry;
  const activeSubObj  = activeEntry ? subjects.find((s) => s.id === activeEntry.subjectId) : null;
  const activeRecord  = records.find(
    (r) =>
      r.subjectId === activeSubObj?.id &&
      r.date.slice(0, 10) === todayIso &&
      (activeEntry?.periodNumber !== undefined ? r.periodNumber === activeEntry.periodNumber : true)
  );
  const isMarked    = !!activeRecord;
  const isPresent   = activeRecord?.status === "present";

  const handleMark = () => {
    if (!activeSubObj) return;
    if (isMarked) {
      unmarkAttendance(activeSubObj.id, now, activeEntry?.periodNumber, 1);
      showToast("Attendance cleared.");
    } else {
      markAttendance(activeSubObj.id, "present", activeEntry?.periodNumber, 1, now);
      showToast(`Marked present — ${activeSubObj.name}`);
    }
  };

  // Schedule status helper
  const getStatus = (entry: typeof todayClasses[0]): "now" | "soon" | "upcoming" | "past" => {
    if (curMin >= entry.startTime && curMin < entry.endTime) return "now";
    if (entry.endTime <= curMin) return "past";
    const mins = entry.startTime - curMin;
    if (mins <= 60) return "soon";
    return "upcoming";
  };

  const upcomingEvents = useMemo(() => {
    const todayStr = now.toISOString().slice(0, 10);
    return (academicEvents ?? [])
      .filter((ev) => ev.dateKey >= todayStr)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
      .slice(0, 2);
  }, [academicEvents, now]);

  return (
    <div className="w-full max-w-[1200px] mx-auto pb-24 pt-0">

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-semibold"
            style={{
              background: "#252525",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#F0F0F0",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ ADMIN NOTIFICATION BANNER ════════════════════════════ */}
      {isAdmin && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-indigo-500/15 to-cyan-500/15 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg shadow-emerald-500/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Administrator Command Center
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                  Active
                </span>
              </h3>
              <p className="text-xs text-slate-300">
                You are authenticated as superadmin (<span className="text-emerald-300 font-mono">{user?.email}</span>).
              </p>
            </div>
          </div>
          <Link
            href="/admin"
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md shadow-emerald-500/20 shrink-0"
          >
            Open Admin Panel
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* ══ TOP HEADER ══════════════════════════════════════════ */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "#F0F0F0" }}
            suppressHydrationWarning
          >
            {greeting}, {firstName}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#888888" }} suppressHydrationWarning>
            {formattedDate} · Your day is looking focused
          </p>
        </div>

        {/* User chip with interactive dropdown */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-3 px-3 py-2 rounded-xl transition-all cursor-pointer hover:bg-[#2e2e2e] active:scale-[0.98]"
            style={{
              background: isUserMenuOpen ? "#2E2E2E" : "#252525",
              border: `1px solid ${isUserMenuOpen ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.07)"}`,
            }}
            aria-expanded={isUserMenuOpen}
            aria-haspopup="true"
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs text-white shrink-0 bg-gradient-to-tr from-indigo-500 to-cyan-400 shadow-sm"
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : "S"}
            </div>
            <span className="text-sm font-medium text-slate-200 truncate max-w-[130px] sm:max-w-[180px]">
              {user?.name ?? "Student"}
            </span>
            {user?.branch && (
              <>
                <div className="w-px h-4 bg-white/10" />
                <p className="text-xs text-slate-400 uppercase font-mono">
                  {user.branch}
                </p>
              </>
            )}
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                isUserMenuOpen ? "rotate-180 text-white" : ""
              }`}
            />
          </button>

          {/* Floating Dropdown Menu */}
          <AnimatePresence>
            {isUserMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.96 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute right-0 mt-2 w-64 rounded-2xl p-2 z-50 shadow-2xl backdrop-blur-xl border border-white/10"
                style={{
                  background: "#1E1E1E",
                  boxShadow: "0 16px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)",
                }}
              >
                {/* User Identity Header */}
                <div className="px-3 py-2.5 mb-1 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-sm font-bold text-white truncate">
                    {user?.name ?? "Student"}
                  </p>
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {user?.email || (user?.registrationNumber ? `ID: ${user.registrationNumber}` : "Student Account")}
                  </p>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-400 font-medium">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-[#7BD0FF] font-mono font-bold">
                      {user?.branch || "B.Tech"}
                    </span>
                    <span>• Sem {user?.semester || "5"}</span>
                    {user?.globalTarget && <span>• Target {user.globalTarget}%</span>}
                  </div>
                </div>

                {/* Menu Items */}
                <div className="space-y-0.5">
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                    >
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>Admin Command Center</span>
                    </Link>
                  )}
                  <Link
                    href="/profile"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <User className="w-4 h-4 text-[#7BD0FF]" />
                    <span>View Profile</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Account & Target Settings</span>
                  </Link>

                  <Link
                    href="/calendar"
                    onClick={() => setIsUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <span>Academic Calendar & Routine</span>
                  </Link>
                </div>

                <div className="my-1.5 h-px bg-white/10" />

                {/* Logout action */}
                <button
                  type="button"
                  onClick={async () => {
                    setIsUserMenuOpen(false);
                    await logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ══ ROW 1: Attendance card + Stat tiles ══════════════ */}
      <div className="grid grid-cols-12 gap-4 mb-4">

        {/* Big Attendance card — col 6 */}
        <div
          className="col-span-12 lg:col-span-6 rounded-2xl p-6 flex items-center gap-6"
          style={{
            background: "#252525",
            border: "1px solid rgba(255,255,255,0.07)",
            minHeight: 200,
          }}
        >
          <div className="shrink-0">
            <AttendanceRing
              pct={pct}
              target={targetPct}
              attended={overallMetrics.attended}
              conducted={overallMetrics.conducted}
            />
          </div>

          <div className="flex-1 min-w-0">
            {overallMetrics.conducted > 0 ? (
              <>
                <p
                  className="text-[11px] font-bold uppercase tracking-[1.5px] mb-2"
                  style={{ color: pct >= targetPct ? "#4ADE80" : "#F87171" }}
                >
                  {pct >= targetPct ? "ON TRACK" : "AT RISK"}
                </p>
                <h2 className="text-xl font-bold leading-snug mb-2" style={{ color: "#F0F0F0" }}>
                  {pct >= targetPct
                    ? "Your attendance is comfortably above target."
                    : "Your attendance needs attention."}
                </h2>
                <p className="text-sm" style={{ color: "#888888" }}>
                  {overallMetrics.attended} of {overallMetrics.conducted} classes attended ·{" "}
                  <span style={{ color: pct >= targetPct ? "#4ADE80" : "#F87171" }}>
                    {Math.abs(pct - targetPct).toFixed(1)}% {pct >= targetPct ? "above" : "below"}
                  </span>{" "}
                  the {targetPct}% requirement.
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[1.5px] mb-2" style={{ color: "#888888" }}>
                  NO DATA YET
                </p>
                <h2 className="text-xl font-bold mb-2" style={{ color: "#F0F0F0" }}>
                  Start tracking your attendance.
                </h2>
                <Link href="/subjects">
                  <button
                    className="mt-2 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all"
                    style={{ background: "#4ADE80", color: "#0A0A0A" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = "0.9")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = "1")}
                  >
                    <Plus className="w-4 h-4" />
                    Add Your First Course
                  </button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Safe to Skip — col 3 */}
        <div className="col-span-6 lg:col-span-3">
          <StatCard
            label="Safe to Skip"
            value={totalSafe}
            subtitle={
              totalSafe > 0
                ? `total ${totalSafe === 1 ? "class" : "classes"} can be missed overall while staying at or above ${targetPct}%`
                : `0 classes can be missed without dropping below ${targetPct}%`
            }
            icon={ShieldCheck}
          />
        </div>

        {/* Must Attend — col 3 */}
        <div className="col-span-6 lg:col-span-3">
          <StatCard
            label="Must Attend"
            value={totalRecovery}
            subtitle={
              totalRecovery > 0
                ? `consecutive ${totalRecovery === 1 ? "class" : "classes"} needed across all subjects to reach ${targetPct}% target`
                : `Target achieved! 0 recovery classes needed across all subjects`
            }
            icon={AlertCircle}
          />
        </div>
      </div>

      {/* ══ ROW 2: Subjects + Attendance Trend ═══════════════ */}
      <div className="grid grid-cols-12 gap-4 mb-4">

        {/* Subjects wide card — col 7 */}
        <div
          className="col-span-12 lg:col-span-7 rounded-2xl p-5"
          style={{
            background: "#252525",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <div>
              <h2 className="text-base font-bold" style={{ color: "#F0F0F0" }}>Subjects</h2>
              <p className="text-[11px]" style={{ color: "#666666" }}>Attendance health by course</p>
            </div>
            <Link
              href="/subjects"
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: "#4ADE80" }}
            >
              Manage subjects <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {subjects.length === 0 ? (
            <div className="py-10 text-center">
              <BookOpen className="w-8 h-8 mx-auto mb-3" style={{ color: "#333333" }} />
              <p className="text-sm font-semibold mb-1" style={{ color: "#888888" }}>No courses yet</p>
              <Link href="/subjects">
                <button
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                  style={{ background: "#4ADE80", color: "#0A0A0A" }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Course
                </button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              {subjects.map((sub) => {
                const met = subjectMetrics[sub.id];
                const attended  = sub.presentClasses;
                const conducted = sub.presentClasses + sub.absentClasses;
                return (
                  <SubjectMiniCard
                    key={sub.id}
                    name={sub.name}
                    code={sub.code}
                    pct={met?.percentage ?? 0}
                    target={sub.targetAttendance ?? targetPct}
                    attended={attended}
                    conducted={conducted}
                    onClick={() => { setSelectedSub(sub.id); setBunkModal(true); }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Attendance Trend — col 5 */}
        <div
          className="col-span-12 lg:col-span-5 rounded-2xl p-5"
          style={{
            background: "#252525",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold" style={{ color: "#F0F0F0" }}>Attendance trend</h2>
              <p className="text-[11px]" style={{ color: "#666666" }}>Weekly consistency</p>
            </div>
            <span
              className="text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
              style={{
                background: pct >= targetPct ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)",
                color: pct >= targetPct ? "#4ADE80" : "#F87171",
              }}
            >
              ↑ {pct >= targetPct ? "+" : ""}{(pct - targetPct).toFixed(1)}%
            </span>
          </div>
          <WeeklyChart todayIdx={todayDow} />
        </div>
      </div>

      {/* ══ ROW 3: Schedule + Intelligence ═══════════════════ */}
      <div className="grid grid-cols-12 gap-4">

        {/* Today's Schedule — col 7 */}
        <div
          className="col-span-12 lg:col-span-7 rounded-2xl"
          style={{
            background: "#252525",
            border: "1px solid rgba(255,255,255,0.07)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3">
            <div>
              <h2 className="text-base font-bold" style={{ color: "#F0F0F0" }}>
                {isTodaySaturday && !isTodayHoliday
                  ? `Saturday Schedule (${WEEKDAY_NAMES_MAP[effectiveTodayDay] ?? "Weekday"} Routine)`
                  : "Today's schedule"}
              </h2>
              <p className="text-[11px] mt-0.5" style={{ color: "#666666" }}>
                {todayClasses.length} classes ·{" "}
                {todayClasses.filter((c) => c.startTime > curMin).length} remaining
              </p>
            </div>
            <div className="flex items-center gap-2">
              {activeSubObj && (
                <>
                  <button
                    onClick={handleMark}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5"
                    style={{
                      background: isMarked
                        ? (isPresent ? "rgba(74,222,128,0.1)" : "rgba(248,113,113,0.1)")
                        : "rgba(74,222,128,0.1)",
                      color: isMarked
                        ? (isPresent ? "#4ADE80" : "#F87171")
                        : "#4ADE80",
                      border: `1px solid ${isMarked ? (isPresent ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)") : "rgba(74,222,128,0.2)"}`,
                    }}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {isMarked ? (isPresent ? "Present ✓" : "Absent") : "Mark Present"}
                  </button>

                  <button
                    onClick={handleOpenNoteForActive}
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10"
                    title="Write note for current class"
                  >
                    <FileText className="w-3 h-3 text-[#7BD0FF]" />
                    <span>{getClassNote(activeSubObj.id, now, activeEntry?.periodNumber) ? "Edit Note" : "Note"}</span>
                  </button>
                </>
              )}
              <div className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: "#555555" }}>
                <CalendarDays className="w-3.5 h-3.5" />
                {now.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()}
              </div>
            </div>
          </div>

          {/* Rows */}
          <div className="pb-4">
            {todayClasses.length > 0 ? (
              todayClasses.map((entry) => {
                const sub = subjects.find((s) => s.id === entry.subjectId);
                const classNote = sub ? getClassNote(sub.id, now, entry.periodNumber) : "";
                return (
                  <ScheduleRow
                    key={entry.id}
                    startMin={entry.startTime}
                    endMin={entry.endTime}
                    name={sub?.name ?? "Class"}
                    room={entry.room}
                    faculty={sub?.facultyName}
                    status={getStatus(entry)}
                    note={classNote}
                    onNoteClick={() => handleOpenNoteForEntry(entry)}
                  />
                );
              })
            ) : (
              <div className="px-5 py-8 text-center space-y-2">
                {isTodayHoliday ? (
                  <>
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mx-auto mb-2">
                      <PartyPopper className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-bold text-amber-400">
                      {holidayInfo.name || "Holiday Today"}
                    </p>
                    <p className="text-xs text-slate-400 max-w-xs mx-auto">
                      {holidayInfo.type === "sunday"
                        ? "Sunday is a weekly off for all colleges. Enjoy your rest day!"
                        : holidayInfo.type === "saturday"
                        ? "Saturday is generally a weekend holiday. If college is open today, activate a weekday routine."
                        : "Official public holiday. No classes scheduled today."}
                    </p>
                    {isTodaySaturday && (
                      <div className="pt-2">
                        <Link
                          href="/attendance"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#5B5FEF]/20 text-[#7BD0FF] hover:bg-[#5B5FEF]/30 border border-[#5B5FEF]/30 transition-all"
                        >
                          <span>Apply Mon–Fri Routine →</span>
                        </Link>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold mb-1" style={{ color: "#888888" }}>No classes today</p>
                    <Link href="/calendar" className="text-xs" style={{ color: "#4ADE80" }}>
                      View your timetable →
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* TrackX Intelligence — col 5 */}
        <div
          className="col-span-12 lg:col-span-5 rounded-2xl p-5"
          style={{
            background: "#252525",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: "#2F2F2F", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <Brain className="w-4 h-4" style={{ color: "#AAAAAA" }} />
              </div>
              <div>
                <p className="text-sm font-bold" style={{ color: "#F0F0F0" }}>TrackX Intelligence</p>
                <p
                  className="text-[9px] font-black uppercase tracking-widest"
                  style={{ color: "#4ADE80" }}
                >
                  Live Analysis
                </p>
              </div>
            </div>
            <div
              className="w-2 h-2 rounded-full mt-1"
              style={{ background: "#4ADE80", boxShadow: "0 0 6px #4ADE80" }}
            />
          </div>

          {/* Body */}
          {subjects.length > 0 && focusSub ? (
            <div className="space-y-4">
              <p className="text-sm font-bold leading-snug" style={{ color: "#F0F0F0" }}>
                {totalRecovery > 0
                  ? `Attend the next ${totalRecovery} ${focusSub.name} classes to return above the ${targetPct}% threshold.`
                  : totalSafe > 0
                  ? `You have a healthy buffer. You can safely skip ${totalSafe} more class${totalSafe === 1 ? "" : "es"}.`
                  : `You're at the threshold. Attend all upcoming classes.`}
              </p>

              {upcomingEvents.map((ev) => (
                <div key={ev.id} className="flex items-center gap-2 text-xs" style={{ color: "#666666" }}>
                  <div className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0"
                    style={{ borderColor: "rgba(255,255,255,0.1)" }}
                  >
                    <CalendarDays className="w-2.5 h-2.5" />
                  </div>
                  <span>Projected recovery: {ev.dateKey}</span>
                </div>
              ))}

              {/* Per-subject insight */}
              {sortedByRisk.slice(0, 2).map((sub) => {
                const met = subjectMetrics[sub.id];
                if (!met) return null;
                const isOk = met.percentage >= (sub.targetAttendance ?? targetPct);
                return (
                  <div key={sub.id} className="flex items-start gap-2 text-xs" style={{ color: "#666666" }}>
                    <div className="w-4 h-4 rounded-full border shrink-0 mt-0.5 flex items-center justify-center"
                      style={{ borderColor: "rgba(255,255,255,0.08)" }}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: isOk ? "#4ADE80" : "#FBBF24" }} />
                    </div>
                    <span>
                      {isOk
                        ? `You have a healthy buffer in ${sub.name}. Skipping would keep you at ${calculateIfBunk(sub.presentClasses, sub.presentClasses + sub.absentClasses, 1)}%.`
                        : `${sub.name} needs ${met.requiredRecovery} more sessions to reach ${sub.targetAttendance ?? targetPct}%.`}
                    </span>
                  </div>
                );
              })}

              {/* Bunk Sim quick access */}
              <button
                onClick={() => { setSelectedSub(focusSub.id); setBunkModal(true); }}
                className="w-full text-xs font-semibold py-2.5 rounded-xl cursor-pointer transition-all text-left px-3 flex items-center justify-between"
                style={{
                  background: "#2A2A2A",
                  border: "1px solid rgba(255,255,255,0.06)",
                  color: "#888888",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(74,222,128,0.25)";
                  (e.currentTarget as HTMLElement).style.color = "#4ADE80";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)";
                  (e.currentTarget as HTMLElement).style.color = "#888888";
                }}
              >
                Open absence simulator
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <p className="text-sm" style={{ color: "#888888" }}>
              Add courses to activate live intelligence.
            </p>
          )}
        </div>
      </div>

      {/* ══ BUNK SIMULATOR MODAL ════════════════════════════ */}
      <AnimatePresence>
        {bunkModal && activeSub && (
          <Modal onClose={() => setBunkModal(false)}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold" style={{ color: "#F0F0F0" }}>Absence Simulator</h3>
                <p className="text-xs mt-0.5" style={{ color: "#666666" }}>Deterministic · no guesswork</p>
              </div>
              <button
                onClick={() => setBunkModal(false)}
                className="p-1.5 rounded-lg cursor-pointer transition-all"
                style={{ color: "#555555" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#F0F0F0")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#555555")}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subject tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: "none" }}>
              {subjects.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSub(s.id)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-xl shrink-0 cursor-pointer transition-all"
                  style={{
                    background: s.id === activeSub.id ? "#4ADE80" : "#2A2A2A",
                    color: s.id === activeSub.id ? "#0A0A0A" : "#888888",
                    border: `1px solid ${s.id === activeSub.id ? "#4ADE80" : "rgba(255,255,255,0.07)"}`,
                  }}
                >
                  {s.code || s.name.slice(0, 10)}
                </button>
              ))}
            </div>

            {/* Current state */}
            <div className="p-4 rounded-xl mb-4" style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex justify-between">
                <div>
                  <p className="text-sm font-bold" style={{ color: "#F0F0F0" }}>{activeSub.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#666666" }}>
                    {activeAtt}/{activeCon} sessions · Target: {Math.round(activeTgt)}%
                  </p>
                </div>
                <span className="text-xl font-black" style={{ color: curBunkPct >= activeTgt ? "#4ADE80" : "#F87171" }}>
                  {Math.round(curBunkPct)}%
                </span>
              </div>
            </div>

            {/* Simulator */}
            <div className="p-4 rounded-xl mb-5" style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold" style={{ color: "#AAAAAA" }}>If I skip</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSimSkips((p) => Math.max(1, p - 1))}
                    className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                    style={{ background: "#333", color: "#CCCCCC" }}
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-black w-4 text-center" style={{ color: "#F0F0F0" }}>{simSkips}</span>
                  <button
                    onClick={() => setSimSkips((p) => p + 1)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                    style={{ background: "#333", color: "#CCCCCC" }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs mb-3">
                <span style={{ color: "#666666" }}>classes, attendance drops to:</span>
                <span
                  className="text-base font-black"
                  style={{ color: projPct >= activeTgt ? "#4ADE80" : "#F87171" }}
                >
                  {projPct}%
                </span>
              </div>
              <div
                className="p-3 rounded-lg text-xs font-medium"
                style={{
                  background: projPct >= activeTgt ? "rgba(74,222,128,0.06)" : "rgba(248,113,113,0.06)",
                  color: projPct >= activeTgt ? "#4ADE80" : "#F87171",
                  border: `1px solid ${projPct >= activeTgt ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)"}`,
                }}
              >
                {projPct >= activeTgt
                  ? `Safe — stays ${(projPct - activeTgt).toFixed(1)}% above the ${Math.round(activeTgt)}% requirement.`
                  : `Risk — drops ${(activeTgt - projPct).toFixed(1)}% below the ${Math.round(activeTgt)}% requirement.`}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setBunkModal(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ background: "#2A2A2A", color: "#888888", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                Close
              </button>
              <Link href="/attendance" onClick={() => setBunkModal(false)} className="flex-1">
                <button
                  className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer"
                  style={{ background: "#4ADE80", color: "#0A0A0A" }}
                >
                  Mark Attendance
                </button>
              </Link>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* Class Note Modal */}
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
          onSave={handleSaveDashboardNote}
          onDelete={handleDeleteDashboardNote}
        />
      )}
    </div>
  );
}
