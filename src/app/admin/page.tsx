"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTrackX } from "@/context/TrackXContext";
import { apiClient } from "@/lib/apiClient";
import { UserProfile, Subject, TimetableEntry, AttendanceRecord } from "@/types/trackx";
import {
  Users,
  Activity,
  BarChart2,
  Shield,
  Settings,
  X,
  Search,
  RefreshCw,
  Trash2,
  Edit3,
  Clock,
  ChevronDown,
  LogOut,
  CheckCircle2,
  XCircle,
  Sparkles,
  Calendar,
  Layers,
  Lock,
  Check,
  Filter,
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

export default function AdminOSPage() {
  const router = useRouter();
  const { user, isLoading: isContextLoading, authStatus, logout } = useTrackX();

  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [usersList, setUsersList] = useState<AdminUserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Active navigation tab in left sidebar
  const [sidebarTab, setSidebarTab] = useState<"users" | "audit" | "analytics" | "security" | "settings">("users");

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "superadmin" | "student">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Selected User for the Right Slide-Over Inspector Drawer
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<"overview" | "activity" | "courses">("overview");
  const [inspectUser, setInspectUser] = useState<{
    user: UserProfile;
    subjects: Subject[];
    timetable: TimetableEntry[];
    records: AttendanceRecord[];
    activities: AdminOverviewData["recentActivities"];
  } | null>(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Edit User State
  const [editingUser, setEditingUser] = useState<AdminUserData | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    branch: "",
    semester: 1,
    globalTarget: 75,
    collegeName: "",
    onboardingCompleted: true,
  });

  // Delete User State
  const [deletingUser, setDeletingUser] = useState<AdminUserData | null>(null);
  const [isClearingAdminData, setIsClearingAdminData] = useState(false);

  const userEmail = (user?.email || "").toLowerCase().trim();
  const isAdmin = userEmail === "pratapvarmauppalapati6@gmail.com";

  // Data fetching
  const loadAdminData = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const [ovData, usrData] = await Promise.all([
        apiClient.getAdminOverview(),
        apiClient.getAdminUsers(),
      ]);
      setOverview(ovData || null);
      const list = Array.isArray(usrData?.users) ? (usrData.users as AdminUserData[]) : [];
      setUsersList(list);
      setError(null);

      // Auto-select first user if none selected
      if (!selectedUserId && list.length > 0) {
        setSelectedUserId(list[0].id);
      }
    } catch (err: unknown) {
      console.error("Admin telemetry fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load telemetry data.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedUserId]);

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

  // Fetch deep-dive detail when a user is selected in the right drawer
  const fetchUserDetail = useCallback(async (userId: string) => {
    setInspectLoading(true);
    try {
      const details = await apiClient.getAdminUserDetail(userId);
      setInspectUser(details);
    } catch (err) {
      console.error("Failed to load user detail:", err);
    } finally {
      setInspectLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserDetail(selectedUserId);
    } else {
      setInspectUser(null);
    }
  }, [selectedUserId, fetchUserDetail]);

  // Handle Purge Admin Student Data
  const handleClearAdminStudentData = async () => {
    if (!confirm("Are you sure you want to permanently erase all student subjects, timetable, and attendance records from this admin account?")) {
      return;
    }
    setIsClearingAdminData(true);
    try {
      await apiClient.clearAdminStudentData();
      if (typeof window !== "undefined") {
        localStorage.removeItem("trackx_subjects");
        localStorage.removeItem("trackx_records");
        localStorage.removeItem("trackx_timetable");
        localStorage.removeItem("trackx_grades");
        localStorage.removeItem("trackx_academic_events");
        localStorage.removeItem("trackx_class_notes");
      }
      setActionNotice("All previous student data (courses, timetable, attendance) has been permanently cleared from your admin account.");
      loadAdminData(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to clear student data");
    } finally {
      setIsClearingAdminData(false);
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
      setActionNotice(`User "${editingUser.name}" updated successfully.`);
      setEditingUser(null);
      loadAdminData(true);
      if (selectedUserId === editingUser.id) {
        fetchUserDetail(editingUser.id);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  // Delete User
  const handleConfirmDelete = async () => {
    if (!deletingUser) return;
    try {
      await apiClient.deleteAdminUser(deletingUser.id);
      setActionNotice(`User "${deletingUser.name}" deleted.`);
      if (selectedUserId === deletingUser.id) {
        setSelectedUserId(null);
      }
      setDeletingUser(null);
      loadAdminData(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete user");
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return (usersList || []).filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        (u?.name || "").toLowerCase().includes(q) ||
        (u?.email || "").toLowerCase().includes(q) ||
        (u?.branch || "").toLowerCase().includes(q) ||
        (u?.collegeName || "").toLowerCase().includes(q);

      const isAdm = (u?.email || "").toLowerCase().trim() === "pratapvarmauppalapati6@gmail.com";
      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "superadmin" && isAdm) ||
        (roleFilter === "student" && !isAdm);

      const isAct = Boolean(u?.onboardingCompleted);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isAct) ||
        (statusFilter === "pending" && !isAct);

      return matchesQuery && matchesRole && matchesStatus;
    });
  }, [usersList, searchQuery, roleFilter, statusFilter]);

  // Selected User Object
  const selectedUserObject = useMemo(() => {
    return usersList.find((u) => u.id === selectedUserId) || null;
  }, [usersList, selectedUserId]);

  // Relative Time Formatter
  const formatTimeAgo = (ts?: number) => {
    if (!ts) return "recently";
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return "just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  // Action badge renderer
  const renderActionBadge = (action: string = "", details?: Record<string, unknown>) => {
    const act = action || "";
    switch (act) {
      case "attendance_mark": {
        const isPresent = details?.status === "present";
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
              isPresent
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
            }`}
          >
            {isPresent ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
            {isPresent ? "ATTENDED" : "ABSENT"}
          </span>
        );
      }
      case "ocr_scan":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <Sparkles className="w-2.5 h-2.5" />
            AI OCR SCAN
          </span>
        );
      case "timetable_update":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <Calendar className="w-2.5 h-2.5" />
            TIMETABLE EDIT
          </span>
        );
      case "subject_create":
      case "subject_update":
      case "subject_delete":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            <Layers className="w-2.5 h-2.5" />
            {act.replace(/_/g, " ").toUpperCase()}
          </span>
        );
      case "signup":
      case "login":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
            <Activity className="w-2.5 h-2.5" />
            {act.toUpperCase()}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/15 text-slate-300 border border-slate-500/30">
            {act ? act.replace(/_/g, " ").toUpperCase() : "ACTIVITY"}
          </span>
        );
    }
  };

  // Helper description of activity
  const formatActivityDetail = (action: string = "", details?: Record<string, unknown>) => {
    if (!details) return "";
    const act = action || "";
    if (act === "attendance_mark") {
      const p = details.periodNumber ? ` • Period ${details.periodNumber}` : "";
      const d = details.date ? ` on ${String(details.date).split("T")[0]}` : "";
      return `Marked ${details.status || "class"} (${details.durationHours || 1}h)${p}${d}`;
    }
    if (act === "ocr_scan") {
      return `Processed ${details.type || "image"} OCR • Detected ${details.slotsFound || details.subjectsFound || 0} items`;
    }
    if (act === "timetable_update") {
      if (details.replace) return `Imported timetable schedule (${details.count || 0} slots)`;
      if (details.action === "clear_day") return `Cleared schedule for Day ${details.dayOfWeek ?? ""}`;
      return `Updated timetable slot`;
    }
    if (act === "subject_create") {
      return `Created course: ${details.name || details.code || "Subject"}`;
    }
    if (act === "profile_update") {
      return `Updated profile (${details.branch || ""}, Sem ${details.semester || ""})`;
    }
    if (act === "login") {
      return `Signed in via ${details.method || "session"}`;
    }
    try {
      return JSON.stringify(details);
    } catch {
      return "";
    }
  };

  // Auth gate & Loader
  if (isContextLoading || authStatus === "loading") {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0C0E14] text-slate-400">
        <div className="text-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="text-xs font-medium tracking-wide">Loading AdminOS Workspace...</p>
        </div>
      </div>
    );
  }

  // Access denied guard
  if (!isAdmin) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#0C0E14] p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-[#11141E] border border-white/10 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Restricted Administrator Area</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            AdminOS is strictly protected and exclusively authorized for administrator accounts.
          </p>
          <button
            onClick={() => router.replace("/dashboard")}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Active metrics calculations
  const totalStudents = overview?.metrics?.totalUsers ?? usersList.length;
  const activeToday = overview?.metrics?.activeToday ?? 0;
  const classesLogged = overview?.metrics?.totalAttendanceRecords ?? 0;
  const activeCourses = overview?.metrics?.totalSubjects ?? 0;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0C0E14] text-slate-200 font-sans">
      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── LEFT SIDEBAR (Matching reference image "AdminOS") ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      <aside className="w-60 shrink-0 bg-[#0F121A] border-r border-white/5 flex flex-col justify-between select-none z-20">
        <div>
          {/* Brand Header */}
          <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-xs shadow-lg shadow-blue-500/30">
              A
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-white text-sm tracking-tight leading-none">AdminOS</span>
              <span className="text-[10px] text-slate-500 font-mono mt-0.5">v2.4 Live</span>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1">
            <button
              onClick={() => setSidebarTab("users")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                sidebarTab === "users"
                  ? "bg-[#182338] text-[#60A5FA] border border-blue-500/20 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Users</span>
            </button>

            <button
              onClick={() => setSidebarTab("analytics")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                sidebarTab === "analytics"
                  ? "bg-[#182338] text-[#60A5FA] border border-blue-500/20 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <BarChart2 className="w-4 h-4 shrink-0" />
              <span>Analytics</span>
            </button>

            <button
              onClick={() => setSidebarTab("audit")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                sidebarTab === "audit"
                  ? "bg-[#182338] text-[#60A5FA] border border-blue-500/20 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Activity className="w-4 h-4 shrink-0" />
              <span>Audit Logs</span>
            </button>

            <button
              onClick={() => setSidebarTab("security")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                sidebarTab === "security"
                  ? "bg-[#182338] text-[#60A5FA] border border-blue-500/20 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Shield className="w-4 h-4 shrink-0" />
              <span>Security</span>
            </button>

            <button
              onClick={() => setSidebarTab("settings")}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                sidebarTab === "settings"
                  ? "bg-[#182338] text-[#60A5FA] border border-blue-500/20 font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* Bottom Profile Card (Matching Screenshot: "Sarah Chen / Super Admin") */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#141824] border border-white/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/30 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                PV
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">Pratap Varma</p>
                <p className="text-[10px] text-slate-400 font-mono truncate">Super Admin</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── MAIN CONTENT WORKSPACE ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Status Bar (Matching: "Sun, Sep 13 • Systems normal") */}
        <header className="h-14 px-6 border-b border-white/5 flex items-center justify-between bg-[#0C0E14] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {sidebarTab === "users" && "User Directory"}
              {sidebarTab === "audit" && "Live Activity Stream"}
              {sidebarTab === "analytics" && "System Telemetry"}
              {sidebarTab === "security" && "Security Controls"}
              {sidebarTab === "settings" && "Workspace Settings"}
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            {/* Live Sync Status */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
            >
              <span className={`w-2 h-2 rounded-full ${autoRefresh ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
              <span className="text-[11px] font-mono">{autoRefresh ? "Sync: 12s" : "Sync: Paused"}</span>
            </button>

            {/* Systems Normal Pill */}
            <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Systems normal</span>
            </div>

            {/* Date */}
            <span className="text-slate-500 font-mono text-[11px] hidden sm:inline">
              Sun, Sep 13
            </span>

            {/* Action Buttons */}
            <button
              onClick={() => loadAdminData(false)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-400" : ""}`} />
            </button>

            <button
              onClick={handleClearAdminStudentData}
              disabled={isClearingAdminData}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all disabled:opacity-50"
              title="Wipe previous student subjects/records from admin account"
            >
              {isClearingAdminData ? "Purging..." : "Clear My Student Data"}
            </button>
          </div>
        </header>

        {/* Notices */}
        {actionNotice && (
          <div className="mx-6 mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
            <span>{actionNotice}</span>
            <button onClick={() => setActionNotice(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {error && (
          <div className="mx-6 mt-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── TAB 1: USERS SPLIT VIEW (Matching the user's screenshot) ── */}
        {sidebarTab === "users" && (
          <div className="flex-1 flex overflow-hidden">
            {/* Main Table Content Column */}
            <div className="flex-1 flex flex-col min-w-0 overflow-y-auto p-6 space-y-5">
              {/* ── KPI Metric Strip (Cards matching screenshot: ACTIVE 3, SUSPENDED 1, 2FA 60%, REVENUE $100K) ── */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Metric 1 */}
                <div className="p-4 rounded-xl bg-[#11141E] border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
                    ACTIVE STUDENTS
                  </span>
                  <div className="text-2xl font-extrabold text-[#4ADE80]">
                    {isLoading ? "—" : totalStudents}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {usersList.filter((u) => u.onboardingCompleted).length} onboarded
                  </div>
                </div>

                {/* Metric 2 */}
                <div className="p-4 rounded-xl bg-[#11141E] border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
                    ACTIVE TODAY
                  </span>
                  <div className="text-2xl font-extrabold text-[#FBBF24]">
                    {isLoading ? "—" : activeToday}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    within 24 hours
                  </div>
                </div>

                {/* Metric 3 */}
                <div className="p-4 rounded-xl bg-[#11141E] border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
                    CLASSES LOGGED
                  </span>
                  <div className="text-2xl font-extrabold text-[#60A5FA]">
                    {isLoading ? "—" : classesLogged}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    attendance marks
                  </div>
                </div>

                {/* Metric 4 */}
                <div className="p-4 rounded-xl bg-[#11141E] border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
                    ACTIVE COURSES
                  </span>
                  <div className="text-2xl font-extrabold text-[#C084FC]">
                    {isLoading ? "—" : activeCourses}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    across all students
                  </div>
                </div>
              </div>

              {/* ── Filter Bar (Matching screenshot search + All Status + All Roles + counter) ── */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="relative w-full">
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search name, email, company, branch..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#141824] border border-white/5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Status Dropdown */}
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "pending")}
                    className="px-3 py-1.5 rounded-lg bg-[#141824] border border-white/5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                  </select>

                  {/* Roles Dropdown */}
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as "all" | "superadmin" | "student")}
                    className="px-3 py-1.5 rounded-lg bg-[#141824] border border-white/5 text-xs text-slate-300 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Roles</option>
                    <option value="superadmin">Super Admin</option>
                    <option value="student">Student</option>
                  </select>

                  {/* Counter */}
                  <span className="text-xs text-slate-500 font-mono">
                    {filteredUsers.length}/{usersList.length} users
                  </span>
                </div>
              </div>

              {/* ── Users Data Table (Matching screenshot rows & columns) ── */}
              <div className="rounded-xl bg-[#11141E] border border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/5 bg-[#0D1017] text-slate-500 uppercase font-mono text-[10px] tracking-wider">
                        <th className="py-3 px-4">USER</th>
                        <th className="py-3 px-3">ROLE ↕</th>
                        <th className="py-3 px-3">STATUS ↕</th>
                        <th className="py-3 px-3">COLLEGE / COMPANY ↕</th>
                        <th className="py-3 px-3">PLAN / BRANCH</th>
                        <th className="py-3 px-3">LAST SEEN ↕</th>
                        <th className="py-3 px-3 text-center">SYNC</th>
                        <th className="py-3 px-4 text-right">CLASSES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.03]">
                      {isLoading ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-500">
                            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
                            Loading registered accounts...
                          </td>
                        </tr>
                      ) : filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-500">
                            No student or administrator accounts match your filters.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((u) => {
                          const isAdm = (u?.email || "").toLowerCase().trim() === "pratapvarmauppalapati6@gmail.com";
                          const isSelected = selectedUserId === u.id;
                          const isAct = Boolean(u?.onboardingCompleted);

                          return (
                            <tr
                              key={u.id}
                              onClick={() => setSelectedUserId(u.id)}
                              className={`cursor-pointer transition-colors ${
                                isSelected
                                  ? "bg-[#182338] border-l-2 border-l-blue-500 text-white"
                                  : "hover:bg-white/[0.02] text-slate-300"
                              }`}
                            >
                              {/* User Name & Email */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600/30 to-indigo-600/30 border border-blue-500/20 flex items-center justify-center font-bold text-xs text-blue-400 shrink-0">
                                    {(u?.name || u?.email || "S").charAt(0).toUpperCase()}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-white truncate">{u.name || "Student"}</div>
                                    <div className="text-[11px] text-slate-500 font-mono truncate">{u.email}</div>
                                  </div>
                                </div>
                              </td>

                              {/* Role */}
                              <td className="py-3 px-3">
                                {isAdm ? (
                                  <span className="font-mono text-[11px] font-bold text-purple-400">
                                    super admin
                                  </span>
                                ) : (
                                  <span className="font-mono text-[11px] text-cyan-400">
                                    student
                                  </span>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3 px-3">
                                {isAct ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    active
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-950/60 text-sky-400 border border-sky-800/50">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                                    pending
                                  </span>
                                )}
                              </td>

                              {/* Company / College */}
                              <td className="py-3 px-3 text-slate-400 truncate max-w-[140px]">
                                {u.collegeName || "Nexus University"}
                              </td>

                              {/* Plan / Branch */}
                              <td className="py-3 px-3 text-slate-400 truncate max-w-[120px]">
                                {u.branch || "General"}
                              </td>

                              {/* Last Seen */}
                              <td className="py-3 px-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                {formatTimeAgo(u.lastActiveTimestamp || u.updatedTimestamp)}
                              </td>

                              {/* Sync / 2FA check */}
                              <td className="py-3 px-3 text-center">
                                <span className="text-emerald-400 font-bold">✓</span>
                              </td>

                              {/* Classes Attended */}
                              <td className="py-3 px-4 text-right font-mono font-bold text-slate-200">
                                {u.attendanceCount ?? 0}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════ */}
            {/* ── RIGHT SLIDE-OVER INSPECTOR (Matching Screenshot!) ── */}
            {/* ══════════════════════════════════════════════════════════ */}
            {selectedUserObject && (
              <div className="w-[420px] shrink-0 bg-[#11141E] border-l border-white/[0.08] flex flex-col h-full overflow-y-auto animate-fade-in">
                {/* Drawer Top Header (Close button + Ban/Delete button) */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between">
                  <button
                    onClick={() => setSelectedUserId(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    title="Close Inspector"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(selectedUserObject)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-colors flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </button>

                    {(selectedUserObject.email || "").toLowerCase().trim() !== "pratapvarmauppalapati6@gmail.com" && (
                      <button
                        onClick={() => setDeletingUser(selectedUserObject)}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
                      >
                        Ban / Delete
                      </button>
                    )}
                  </div>
                </div>

                {/* User Identity Header Card */}
                <div className="p-5 border-b border-white/5 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600/30 to-purple-600/30 border border-blue-500/30 flex items-center justify-center font-bold text-lg text-blue-300 shrink-0 shadow-lg shadow-blue-500/10">
                      {(selectedUserObject.name || selectedUserObject.email || "S").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white text-base truncate">
                          {selectedUserObject.name || "Student"}
                        </h3>
                        {selectedUserObject.onboardingCompleted ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/50">
                            ● active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-950/60 text-sky-400 border border-sky-800/50">
                            ● pending
                          </span>
                        )}
                        {(selectedUserObject.email || "").toLowerCase().trim() === "pratapvarmauppalapati6@gmail.com" ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                            superadmin
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono text-cyan-300 bg-cyan-500/15 border border-cyan-500/30">
                            student
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 font-mono truncate mt-0.5">
                        {selectedUserObject.email}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {selectedUserObject.id}
                      </p>
                    </div>
                  </div>

                  {/* 4 Mini Stat Boxes (Matching screenshot: TOTAL SPEND $0, API CALLS 2K, SESSIONS 0, INVOICES 0) */}
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    <div className="p-2.5 rounded-lg bg-[#141824] border border-white/5 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                        TARGET %
                      </span>
                      <span className="text-sm font-extrabold text-white">
                        {selectedUserObject.globalTarget || 75}%
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#141824] border border-white/5 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                        COURSES
                      </span>
                      <span className="text-sm font-extrabold text-white">
                        {selectedUserObject.subjectsCount ?? 0}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#141824] border border-white/5 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                        ATTENDED
                      </span>
                      <span className="text-sm font-extrabold text-white">
                        {selectedUserObject.attendanceCount ?? 0}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#141824] border border-white/5 text-center">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 block">
                        SEMESTER
                      </span>
                      <span className="text-sm font-extrabold text-white">
                        Sem {selectedUserObject.semester || 1}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Drawer Tab Navigation (Overview | Activity | Courses) */}
                <div className="px-5 border-b border-white/5 flex items-center gap-5 text-xs font-semibold">
                  <button
                    onClick={() => setDrawerTab("overview")}
                    className={`py-3 border-b-2 transition-colors ${
                      drawerTab === "overview"
                        ? "border-blue-500 text-blue-400"
                        : "border-transparent text-slate-400 hover:text-white"
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setDrawerTab("activity")}
                    className={`py-3 border-b-2 transition-colors ${
                      drawerTab === "activity"
                        ? "border-blue-500 text-blue-400"
                        : "border-transparent text-slate-400 hover:text-white"
                    }`}
                  >
                    Activity ({inspectUser?.activities?.length ?? 0})
                  </button>
                  <button
                    onClick={() => setDrawerTab("courses")}
                    className={`py-3 border-b-2 transition-colors ${
                      drawerTab === "courses"
                        ? "border-blue-500 text-blue-400"
                        : "border-transparent text-slate-400 hover:text-white"
                    }`}
                  >
                    Courses & Routine ({inspectUser?.subjects?.length ?? 0})
                  </button>
                </div>

                {/* Drawer Content */}
                <div className="p-5 flex-1 overflow-y-auto text-xs space-y-6">
                  {inspectLoading ? (
                    <div className="py-12 text-center text-slate-500 space-y-2">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto text-blue-500" />
                      <p className="text-xs">Fetching student profile data...</p>
                    </div>
                  ) : drawerTab === "overview" ? (
                    /* ── PROFILE SECTION (Key-value metadata table matching reference) ── */
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
                        PROFILE METADATA
                      </span>
                      <div className="space-y-2.5 divide-y divide-white/[0.04]">
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-slate-400">Full name</span>
                          <span className="font-semibold text-white">{selectedUserObject.name || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-slate-400">Email</span>
                          <span className="font-mono text-slate-200">{selectedUserObject.email}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-slate-400">Branch / Degree</span>
                          <span className="text-slate-200">{selectedUserObject.branch || "General Engineering"}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-slate-400">Semester</span>
                          <span className="text-slate-200">Semester {selectedUserObject.semester || 1}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-slate-400">College / Institution</span>
                          <span className="text-slate-200">{selectedUserObject.collegeName || "University"}</span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-slate-400">Target Attendance</span>
                          <span className="font-bold text-emerald-400">{selectedUserObject.globalTarget || 75}%</span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-slate-400">Onboarding Status</span>
                          <span className="text-blue-400">
                            {selectedUserObject.onboardingCompleted ? "Completed" : "In Progress"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-slate-400">Last active</span>
                          <span className="text-slate-400 font-mono">
                            {formatTimeAgo(selectedUserObject.lastActiveTimestamp || selectedUserObject.updatedTimestamp)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2">
                          <span className="text-slate-400">Joined</span>
                          <span className="text-slate-400 font-mono">
                            {new Date(selectedUserObject.createdTimestamp || Date.now()).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : drawerTab === "activity" ? (
                    /* ── ACTIVITY SECTION FOR SELECTED USER ── */
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">
                        RECENT AUDIT HISTORY
                      </span>
                      {(inspectUser?.activities || []).length === 0 ? (
                        <p className="text-slate-500 italic py-6 text-center">No actions recorded for this user.</p>
                      ) : (
                        <div className="space-y-2">
                          {(inspectUser?.activities || []).map((a) => (
                            <div key={a.id} className="p-3 rounded-xl bg-[#141824] border border-white/5 space-y-1">
                              <div className="flex items-center justify-between">
                                {renderActionBadge(a.action || "", a.details)}
                                <span className="text-[10px] text-slate-500 font-mono">{formatTimeAgo(a.timestamp)}</span>
                              </div>
                              <p className="text-xs text-slate-300">{formatActivityDetail(a.action || "", a.details)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* ── COURSES & TIMETABLE SECTION ── */
                    <div className="space-y-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">
                          ENROLLED COURSES ({(inspectUser?.subjects || []).length})
                        </span>
                        {(inspectUser?.subjects || []).length === 0 ? (
                          <p className="text-slate-500 italic text-center py-4">No courses registered yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {(inspectUser?.subjects || []).map((sub) => {
                              const total = (sub.presentClasses || 0) + (sub.absentClasses || 0);
                              const pct = total > 0 ? Math.round(((sub.presentClasses || 0) / total) * 100) : 100;
                              return (
                                <div key={sub.id} className="p-3 rounded-xl bg-[#141824] border border-white/5 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-white">{sub.name || "Course"}</span>
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

                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-2">
                          TIMETABLE SLOTS ({(inspectUser?.timetable || []).length} slots)
                        </span>
                        {(inspectUser?.timetable || []).length === 0 ? (
                          <p className="text-slate-500 italic text-center py-4">No timetable configured yet.</p>
                        ) : (
                          <div className="p-3 rounded-xl bg-[#141824] border border-white/5 text-slate-300">
                            Configured across {Array.from(new Set((inspectUser?.timetable || []).map((t) => t.dayOfWeek))).length} days of the week.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: AUDIT LOGS (Full Workspace Live Feed) ── */}
        {sidebarTab === "audit" && (
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">Live Activity Stream</h2>
                <p className="text-xs text-slate-400">Real-time actions executed across all registered user accounts</p>
              </div>
              <span className="text-xs text-slate-500 font-mono">
                {overview?.recentActivities?.length ?? 0} events logged
              </span>
            </div>

            <div className="rounded-xl bg-[#11141E] border border-white/5 divide-y divide-white/[0.04]">
              {(overview?.recentActivities || []).length === 0 ? (
                <div className="py-16 text-center text-slate-500 space-y-2">
                  <Activity className="w-6 h-6 mx-auto text-slate-600" />
                  <p className="text-sm font-semibold text-white">No activities recorded yet</p>
                  <p className="text-xs">User operations like attendance marks and OCR scans will appear here live.</p>
                </div>
              ) : (
                (overview?.recentActivities || []).map((act) => (
                  <div key={act.id} className="p-4 hover:bg-white/[0.02] flex items-center justify-between gap-4 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/20 text-blue-400 font-bold text-xs flex items-center justify-center shrink-0">
                        {(act.userName || act.userEmail || "U").charAt(0).toUpperCase()}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white text-xs">{act.userName || "Student"}</span>
                          <span className="text-[11px] text-slate-500 font-mono">({act.userEmail})</span>
                          {renderActionBadge(act.action || "", act.details)}
                        </div>
                        <p className="text-xs text-slate-300">{formatActivityDetail(act.action || "", act.details)}</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap shrink-0">
                      {formatTimeAgo(act.timestamp)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: ANALYTICS ── */}
        {sidebarTab === "analytics" && (
          <div className="flex-1 p-6 overflow-y-auto space-y-5">
            <div>
              <h2 className="text-base font-bold text-white">System Telemetry & Analytics</h2>
              <p className="text-xs text-slate-400">High-level usage metrics across enrolled student populations</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-[#11141E] border border-white/5 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">USER RETENTION</span>
                <div className="text-3xl font-extrabold text-white">
                  {usersList.length > 0
                    ? Math.round((usersList.filter((u) => u.onboardingCompleted).length / usersList.length) * 100)
                    : 100}%
                </div>
                <p className="text-xs text-slate-400">Active onboarded accounts</p>
              </div>

              <div className="p-5 rounded-xl bg-[#11141E] border border-white/5 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">AVG ATTENDANCE TARGET</span>
                <div className="text-3xl font-extrabold text-[#4ADE80]">
                  {usersList.length > 0
                    ? Math.round(usersList.reduce((acc, u) => acc + (u.globalTarget || 75), 0) / usersList.length)
                    : 75}%
                </div>
                <p className="text-xs text-slate-400">Mean target attendance threshold</p>
              </div>

              <div className="p-5 rounded-xl bg-[#11141E] border border-white/5 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">AVG COURSES PER STUDENT</span>
                <div className="text-3xl font-extrabold text-[#60A5FA]">
                  {usersList.length > 0 ? (activeCourses / usersList.length).toFixed(1) : 0}
                </div>
                <p className="text-xs text-slate-400">Course enrollment density</p>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 4: SECURITY ── */}
        {sidebarTab === "security" && (
          <div className="flex-1 p-6 overflow-y-auto space-y-5 max-w-3xl">
            <div>
              <h2 className="text-base font-bold text-white">Security & Access Management</h2>
              <p className="text-xs text-slate-400">Authentication guards, role permissions, and access privileges</p>
            </div>

            <div className="p-5 rounded-xl bg-[#11141E] border border-white/5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Primary Superadministrator</h3>
                  <p className="text-xs text-slate-400">Has complete read/write access to all user profiles and telemetry</p>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  SUPERADMIN
                </span>
              </div>
              <div className="p-3 rounded-lg bg-[#141824] border border-white/5 font-mono text-xs text-emerald-400">
                pratapvarmauppalapati6@gmail.com
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: SETTINGS ── */}
        {sidebarTab === "settings" && (
          <div className="flex-1 p-6 overflow-y-auto space-y-5 max-w-2xl">
            <div>
              <h2 className="text-base font-bold text-white">AdminOS Workspace Settings</h2>
              <p className="text-xs text-slate-400">Data retention, sync preferences, and administrative actions</p>
            </div>

            <div className="p-5 rounded-xl bg-[#11141E] border border-white/5 space-y-4">
              <h3 className="text-sm font-bold text-white">Purge Admin Student Data</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                If your admin account previously had test student courses or timetable slots, this permanently wipes them from your profile while keeping all other student data untouched.
              </p>
              <button
                onClick={handleClearAdminStudentData}
                disabled={isClearingAdminData}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all disabled:opacity-50"
              >
                {isClearingAdminData ? "Purging..." : "Clear My Student Data"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── EDIT USER MODAL ── */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md rounded-2xl border border-white/10 p-6 space-y-4 bg-[#141824] shadow-2xl"
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
                  className="w-full px-3 py-2 rounded-xl bg-[#0F121A] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Branch / Degree</label>
                <input
                  type="text"
                  value={editForm.branch}
                  onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#0F121A] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500"
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
                    className="w-full px-3 py-2 rounded-xl bg-[#0F121A] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500"
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
                    className="w-full px-3 py-2 rounded-xl bg-[#0F121A] border border-white/10 text-white text-xs focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="onb"
                  checked={editForm.onboardingCompleted}
                  onChange={(e) => setEditForm({ ...editForm, onboardingCompleted: e.target.checked })}
                  className="rounded border-slate-700 text-blue-500"
                />
                <label htmlFor="onb" className="text-slate-300">
                  Mark Onboarding Completed
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-rose-500/30 p-6 space-y-4 bg-[#141824] shadow-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-white">Delete User Account?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to delete <span className="text-white font-semibold">{deletingUser.name}</span> ({deletingUser.email})? This permanently erases all their subjects, timetable, and attendance records.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setDeletingUser(null)}
                className="w-full py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="w-full py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors"
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
