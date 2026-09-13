"use client";

import React, { useState, useEffect, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTrackX } from "@/context/TrackXContext";
import { apiClient } from "@/lib/apiClient";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { UserProfile, Subject, TimetableEntry, AttendanceRecord } from "@/types/trackx";
import {
  ShieldCheck,
  Users,
  Activity,
  CalendarDays,
  Layers,
  Search,
  RefreshCw,
  Clock,
  Trash2,
  Edit3,
  Eye,
  CheckCircle2,
  XCircle,
  Sparkles,
  AlertTriangle,
  ArrowUpRight,
  Filter,
  Check,
  X,
  Lock,
} from "lucide-react";

interface AdminOverviewData {
  adminEmail: string;
  metrics: {
    totalUsers: number;
    activeToday: number;
    totalAttendanceRecords: number;
    totalSubjects: number;
  };
  recentActivities: Array<{
    id: string;
    userId: string;
    userEmail: string;
    userName: string;
    action: string;
    details?: Record<string, unknown>;
    timestamp: number;
  }>;
}

interface AdminUserData extends UserProfile {
  subjectsCount: number;
  attendanceCount: number;
  lastActiveTimestamp: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isLoading: isContextLoading, authStatus } = useTrackX();
  const [, startTransition] = useTransition();

  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [usersList, setUsersList] = useState<AdminUserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<"activity" | "users">("activity");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Modal / Deep-dive states
  const [inspectUser, setInspectUser] = useState<{
    user: UserProfile;
    subjects: Subject[];
    timetable: TimetableEntry[];
    records: AttendanceRecord[];
    activities: AdminOverviewData["recentActivities"];
  } | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  const [editingUser, setEditingUser] = useState<AdminUserData | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    branch: "",
    semester: 1,
    globalTarget: 75,
    collegeName: "",
    onboardingCompleted: true,
  });

  const [deletingUser, setDeletingUser] = useState<AdminUserData | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const isAdmin = user?.email?.toLowerCase() === "pratapvarmauppalapati6@gmail.com";

  // Data fetching
  const loadAdminData = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const [ovData, usrData] = await Promise.all([
        apiClient.getAdminOverview(),
        apiClient.getAdminUsers(),
      ]);
      setOverview(ovData);
      setUsersList(usrData.users as AdminUserData[]);
      setError(null);
    } catch (err: unknown) {
      console.error("Admin data fetch failed:", err);
      setError(err instanceof Error ? err.message : "Failed to load admin telemetry.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isContextLoading || authStatus === "loading") return;
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }
    loadAdminData();
  }, [isAdmin, isContextLoading, authStatus, loadAdminData]);

  // Auto-refresh interval (12 seconds)
  useEffect(() => {
    if (!isAdmin || !autoRefresh) return;
    const interval = setInterval(() => {
      loadAdminData(true);
    }, 12000);
    return () => clearInterval(interval);
  }, [isAdmin, autoRefresh, loadAdminData]);

  // Inspect user
  const handleInspectUser = async (userId: string) => {
    setInspectLoading(true);
    try {
      const details = await apiClient.getAdminUserDetail(userId);
      setInspectUser(details);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load user details");
    } finally {
      setInspectLoading(false);
    }
  };

  // Open Edit User
  const handleOpenEdit = (targetUser: AdminUserData) => {
    setEditingUser(targetUser);
    setEditForm({
      name: targetUser.name || "",
      branch: targetUser.branch || "",
      semester: targetUser.semester || 1,
      globalTarget: targetUser.globalTarget || 75,
      collegeName: targetUser.collegeName || "",
      onboardingCompleted: targetUser.onboardingCompleted ?? true,
    });
  };

  // Save Edit User
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await apiClient.updateAdminUser(editingUser.id, editForm);
      setActionNotice(`User ${editingUser.name} updated successfully.`);
      setEditingUser(null);
      loadAdminData(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  // Delete User
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    try {
      await apiClient.deleteAdminUser(deletingUser.id);
      setActionNotice(`User ${deletingUser.name} deleted.`);
      setDeletingUser(null);
      if (inspectUser?.user.id === deletingUser.id) {
        setInspectUser(null);
      }
      loadAdminData(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  // Format relative time
  const formatTimeAgo = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 45) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  // Action badge renderer
  const renderActionBadge = (action: string, details?: Record<string, unknown>) => {
    switch (action) {
      case "attendance_mark": {
        const isPresent = details?.status === "present";
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
              isPresent
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
            }`}
          >
            {isPresent ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
            {isPresent ? "ATTENDED" : "ABSENT"}
          </span>
        );
      }
      case "attendance_delete":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Trash2 className="w-3 h-3" />
            ATTENDANCE UNDO
          </span>
        );
      case "ocr_scan":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <Sparkles className="w-3 h-3" />
            AI OCR SCAN
          </span>
        );
      case "timetable_update":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <CalendarDays className="w-3 h-3" />
            TIMETABLE EDIT
          </span>
        );
      case "subject_create":
      case "subject_update":
      case "subject_delete":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            <Layers className="w-3 h-3" />
            {action.replace("_", " ").toUpperCase()}
          </span>
        );
      case "signup":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <Users className="w-3 h-3" />
            NEW REGISTRATION
          </span>
        );
      case "login":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Activity className="w-3 h-3" />
            SIGN IN
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-500/15 text-slate-300 border border-slate-500/30">
            {action.replace("_", " ").toUpperCase()}
          </span>
        );
    }
  };

  // Helper description of activity
  const formatActivityDetail = (action: string, details?: Record<string, unknown>) => {
    if (!details) return "";
    if (action === "attendance_mark") {
      const p = details.periodNumber ? ` • Period ${details.periodNumber}` : "";
      const d = details.date ? ` on ${String(details.date).split("T")[0]}` : "";
      return `Marked ${details.status} (${details.durationHours || 1}h)${p}${d}`;
    }
    if (action === "ocr_scan") {
      return `Processed ${details.type || "image"} OCR • Detected ${details.slotsFound || details.subjectsFound || 0} items`;
    }
    if (action === "timetable_update") {
      if (details.replace) return `Imported full timetable schedule (${details.count} slots)`;
      if (details.action === "clear_day") return `Cleared schedule for Day ${details.dayOfWeek}`;
      return `Updated timetable slot`;
    }
    if (action === "subject_create") {
      return `Created subject: ${details.name || details.code || "Course"}`;
    }
    if (action === "profile_update") {
      return `Updated profile details (${details.branch || ""}, Sem ${details.semester || ""})`;
    }
    if (action === "login") {
      return `Authenticated via ${details.method || "session"}`;
    }
    return JSON.stringify(details);
  };

  // Access check guard
  if (!isContextLoading && authStatus !== "loading" && !isAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <GlassCard variant="elevated" className="max-w-md w-full p-8 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Restricted Administrator Area</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            The TrackX Command Center is strictly protected and only accessible to authorized administrator accounts.
          </p>
          <div className="pt-2">
            <GlassButton
              variant="primary"
              className="w-full"
              onClick={() => startTransition(() => router.replace("/dashboard"))}
            >
              Return to Dashboard
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    );
  }

  // Filtered lists
  const filteredActivities = (overview?.recentActivities || []).filter((act) => {
    const matchesSearch =
      !searchQuery ||
      act.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      act.userEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction =
      actionFilter === "all" ||
      (actionFilter === "attendance" && act.action.startsWith("attendance_")) ||
      (actionFilter === "auth" && (act.action === "login" || act.action === "signup")) ||
      (actionFilter === "ocr" && act.action === "ocr_scan") ||
      (actionFilter === "timetable" && act.action === "timetable_update") ||
      (actionFilter === "subject" && act.action.startsWith("subject_"));
    return matchesSearch && matchesAction;
  });

  const filteredUsers = usersList.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.branch?.toLowerCase().includes(q) ||
      u.collegeName?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 pt-2 px-2 sm:px-4">
      {/* ── Top Header Banner ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-indigo-600 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">TrackX Command Center</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
                  Live Admin
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Authorized for <span className="text-emerald-300 font-mono font-medium">{user?.email}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              autoRefresh
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
            {autoRefresh ? "Live Sync (12s)" : "Auto Sync Paused"}
          </button>

          <GlassButton
            variant="secondary"
            className="!py-1.5 !px-3 text-xs"
            onClick={() => loadAdminData(false)}
            isLoading={isRefreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </GlassButton>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between animate-fade-in">
          <span>{actionNotice}</span>
          <button onClick={() => setActionNotice(null)} className="text-emerald-400 hover:text-emerald-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── KPI Telemetry Strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <GlassCard variant="default" className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Students</span>
            <Users className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {isLoading ? "—" : overview?.metrics.totalUsers || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
            <span className="text-emerald-400 font-semibold">
              {usersList.filter((u) => u.onboardingCompleted).length}
            </span>{" "}
            onboarded active
          </div>
        </GlassCard>

        <GlassCard variant="default" className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Today</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {isLoading ? "—" : overview?.metrics.activeToday || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Within the last 24 hours
          </div>
        </GlassCard>

        <GlassCard variant="default" className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Classes Logged</span>
            <CalendarDays className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {isLoading ? "—" : overview?.metrics.totalAttendanceRecords || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Attendance marks recorded
          </div>
        </GlassCard>

        <GlassCard variant="default" className="p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Subjects</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">
            {isLoading ? "—" : overview?.metrics.totalSubjects || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Across all enrolled students
          </div>
        </GlassCard>
      </div>

      {/* ── Main Tab Navigation ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 p-1 rounded-xl bg-black/20 border border-white/5">
          <button
            onClick={() => setActiveTab("activity")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "activity"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Live Activity Feed ({overview?.recentActivities.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "users"
                ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Student Accounts ({usersList.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by student, email, branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl glass-input text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
          />
        </div>
      </div>

      {/* ── TAB 1: Live Activity Stream ── */}
      {activeTab === "activity" && (
        <div className="space-y-4">
          {/* Action Filter Strip */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase flex items-center gap-1 mr-1 shrink-0">
              <Filter className="w-3 h-3" /> Filter:
            </span>
            {[
              { key: "all", label: "All Actions" },
              { key: "attendance", label: "Attendance Marks" },
              { key: "ocr", label: "AI OCR Scans" },
              { key: "timetable", label: "Timetable Changes" },
              { key: "subject", label: "Subject Edits" },
              { key: "auth", label: "Sign-ins & Signups" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setActionFilter(f.key)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 transition-all cursor-pointer border ${
                  actionFilter === f.key
                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                    : "bg-white/5 border-white/5 text-slate-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Activity Log List */}
          <GlassCard variant="default" className="p-0 overflow-hidden divide-y divide-white/5">
            {isLoading ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-emerald-400" />
                <p className="text-xs">Loading live telemetry stream...</p>
              </div>
            ) : filteredActivities.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Activity className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-sm font-semibold text-white">No matching activities recorded yet</p>
                <p className="text-xs text-slate-500">
                  Student actions like marking attendance or running OCR will appear here in real-time.
                </p>
              </div>
            ) : (
              filteredActivities.map((act) => (
                <div
                  key={act.id}
                  className="p-3.5 sm:p-4 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    {/* User Avatar */}
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center text-xs font-bold text-cyan-300 shrink-0 mt-0.5 sm:mt-0">
                      {act.userName.charAt(0).toUpperCase()}
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">{act.userName}</span>
                        <span className="text-[11px] text-slate-400 font-mono">({act.userEmail})</span>
                        {renderActionBadge(act.action, act.details)}
                      </div>
                      <p className="text-xs text-slate-300">
                        {formatActivityDetail(act.action, act.details)}
                      </p>
                    </div>
                  </div>

                  {/* Timestamp & Action */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <div className="text-right">
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(act.timestamp)}
                      </span>
                    </div>

                    <button
                      onClick={() => handleInspectUser(act.userId)}
                      className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-semibold text-slate-300 hover:text-white transition-all cursor-pointer flex items-center gap-1 border border-white/10"
                    >
                      Inspect
                      <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </GlassCard>
        </div>
      )}

      {/* ── TAB 2: Student Directory & Management ── */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <GlassCard variant="default" className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-black/30 text-slate-400 uppercase font-semibold text-[10px] tracking-wider">
                    <th className="p-3.5 pl-5">Student</th>
                    <th className="p-3.5">Branch & Semester</th>
                    <th className="p-3.5 text-center">Target %</th>
                    <th className="p-3.5 text-center">Courses</th>
                    <th className="p-3.5 text-center">Attendance Logs</th>
                    <th className="p-3.5">Last Active</th>
                    <th className="p-3.5 text-right pr-5">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Loading student registry...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No registered users found matching your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 pl-5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-white/10 flex items-center justify-center font-bold text-cyan-300 text-xs shrink-0">
                              {u.name?.charAt(0).toUpperCase() || "S"}
                            </div>
                            <div>
                              <div className="font-bold text-white flex items-center gap-1.5">
                                {u.name || "Student"}
                                {u.email.toLowerCase() === "pratapvarmauppalapati6@gmail.com" && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                    ADMIN
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 font-mono">{u.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="text-slate-300">{u.branch || "General"}</div>
                          <div className="text-[11px] text-slate-400">
                            Semester {u.semester || 1} • {u.collegeName || "University"}
                          </div>
                        </td>

                        <td className="p-3.5 text-center">
                          <span className="px-2 py-0.5 rounded-full font-bold text-[11px] bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                            {u.globalTarget || 75}%
                          </span>
                        </td>

                        <td className="p-3.5 text-center text-slate-300 font-semibold">
                          {u.subjectsCount}
                        </td>

                        <td className="p-3.5 text-center text-slate-300 font-semibold">
                          {u.attendanceCount}
                        </td>

                        <td className="p-3.5 text-slate-400 text-[11px]">
                          {formatTimeAgo(u.lastActiveTimestamp || u.updatedTimestamp || Date.now())}
                        </td>

                        <td className="p-3.5 pr-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleInspectUser(u.id)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
                              title="Inspect Full Data"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleOpenEdit(u)}
                              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-cyan-400 hover:text-cyan-300 transition-all cursor-pointer"
                              title="Edit Parameters"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {u.email.toLowerCase() !== "pratapvarmauppalapati6@gmail.com" && (
                              <button
                                onClick={() => setDeletingUser(u)}
                                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all cursor-pointer"
                                title="Delete Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── User Deep Dive Modal ── */}
      {(inspectUser || inspectLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-3xl max-h-[88vh] overflow-y-auto rounded-3xl skeuo-deck border border-white/10 p-6 space-y-6 bg-[#161B26]">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 font-bold text-base">
                  {inspectUser?.user.name?.charAt(0).toUpperCase() || "S"}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">{inspectUser?.user.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{inspectUser?.user.email} • ID: {inspectUser?.user.id}</p>
                </div>
              </div>
              <button
                onClick={() => setInspectUser(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {inspectLoading ? (
              <div className="py-16 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-7 h-7 animate-spin mx-auto text-cyan-400" />
                <p className="text-xs">Fetching student timetable, courses & records...</p>
              </div>
            ) : inspectUser && (
              <div className="space-y-6 text-xs">
                {/* Profile Overview */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Branch</span>
                    <span className="font-bold text-white text-sm">{inspectUser.user.branch}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Semester</span>
                    <span className="font-bold text-white text-sm">Sem {inspectUser.user.semester}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Target Attendance</span>
                    <span className="font-bold text-emerald-400 text-sm">{inspectUser.user.globalTarget}%</span>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Onboarding</span>
                    <span className="font-bold text-cyan-300 text-sm">
                      {inspectUser.user.onboardingCompleted ? "Completed" : "In Progress"}
                    </span>
                  </div>
                </div>

                {/* Enrolled Courses */}
                <div className="space-y-2">
                  <h4 className="font-bold text-white text-sm flex items-center justify-between">
                    <span>Enrolled Courses ({inspectUser.subjects.length})</span>
                  </h4>
                  {inspectUser.subjects.length === 0 ? (
                    <p className="text-slate-500 italic">No courses added yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {inspectUser.subjects.map((sub) => {
                        const total = (sub.presentClasses || 0) + (sub.absentClasses || 0);
                        const pct = total > 0 ? Math.round(((sub.presentClasses || 0) / total) * 100) : 100;
                        return (
                          <div key={sub.id} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white">{sub.name}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  pct >= (sub.targetAttendance || 75)
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-rose-500/20 text-rose-400"
                                }`}
                              >
                                {pct}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400">
                              <span>Code: {sub.code || "—"}</span>
                              <span>
                                {sub.presentClasses || 0}/{total} attended
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Timetable Schedule Summary */}
                <div className="space-y-2">
                  <h4 className="font-bold text-white text-sm">
                    Timetable Entries ({inspectUser.timetable.length} slots configured)
                  </h4>
                  {inspectUser.timetable.length === 0 ? (
                    <p className="text-slate-500 italic">No timetable configured yet.</p>
                  ) : (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[11px] text-slate-300">
                      Configured across {Array.from(new Set(inspectUser.timetable.map((t) => t.dayOfWeek))).length} days of the week.
                    </div>
                  )}
                </div>

                {/* Recent Activities for This User */}
                <div className="space-y-2">
                  <h4 className="font-bold text-white text-sm">Recent Activity History</h4>
                  {inspectUser.activities.length === 0 ? (
                    <p className="text-slate-500 italic">No actions recorded for this user.</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                      {inspectUser.activities.map((a) => (
                        <div key={a.id} className="p-2.5 rounded-lg bg-white/[0.03] flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              {renderActionBadge(a.action, a.details)}
                              <span className="text-[11px] text-slate-300">{formatActivityDetail(a.action, a.details)}</span>
                            </div>
                          </div>
                          <span className="text-[10px] text-slate-400">{formatTimeAgo(a.timestamp)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Edit User Modal ── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-3xl skeuo-deck border border-white/10 p-6 space-y-4 bg-[#161B26]"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white">Edit Student Parameters</h3>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Student Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl glass-input text-white text-xs"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Branch / Degree</label>
                <input
                  type="text"
                  value={editForm.branch}
                  onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl glass-input text-white text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Semester</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={editForm.semester}
                    onChange={(e) => setEditForm({ ...editForm, semester: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-xl glass-input text-white text-xs"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Target %</label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={editForm.globalTarget}
                    onChange={(e) => setEditForm({ ...editForm, globalTarget: parseFloat(e.target.value) || 75 })}
                    className="w-full px-3 py-2 rounded-xl glass-input text-white text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="onb"
                  checked={editForm.onboardingCompleted}
                  onChange={(e) => setEditForm({ ...editForm, onboardingCompleted: e.target.checked })}
                  className="rounded border-slate-700 text-emerald-500"
                />
                <label htmlFor="onb" className="text-slate-300">
                  Mark Onboarding Completed
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
              <GlassButton type="button" variant="secondary" onClick={() => setEditingUser(null)}>
                Cancel
              </GlassButton>
              <GlassButton type="submit" variant="primary">
                Save Changes
              </GlassButton>
            </div>
          </form>
        </div>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl skeuo-deck border border-rose-500/30 p-6 space-y-4 bg-[#161B26]">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-white">Delete Student Account?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to delete <span className="text-white font-semibold">{deletingUser.name}</span> ({deletingUser.email})? This permanently deletes all their subjects, timetable, and attendance records.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <GlassButton
                variant="secondary"
                className="w-full"
                onClick={() => setDeletingUser(null)}
              >
                Cancel
              </GlassButton>
              <button
                onClick={handleConfirmDelete}
                className="w-full py-2 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
