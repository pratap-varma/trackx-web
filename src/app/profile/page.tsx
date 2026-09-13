"use client";

import React, { useState } from "react";
import { useTrackX } from "@/context/TrackXContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  School,
  IdCard,
  BookOpen,
  LogOut,
  Edit3,
  X,
  Check,
  Sparkles,
} from "lucide-react";

export default function ProfilePage() {
  const { user, overallMetrics, subjects, logout, updateUserProfile } = useTrackX();

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [nameInput, setNameInput] = useState(user?.name || "");
  const [collegeInput, setCollegeInput] = useState(user?.collegeName || "");
  const [regNumInput, setRegNumInput] = useState(user?.registrationNumber || "");
  const [branchInput, setBranchInput] = useState(user?.branch || "Computer Science & Engineering");
  const [semesterInput, setSemesterInput] = useState(String(user?.semester || 1));
  const [programmeInput, setProgrammeInput] = useState(user?.programmeName || "B.Tech");
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 3000);
  };

  const handleOpenEdit = () => {
    setNameInput(user?.name || "");
    setCollegeInput(user?.collegeName || "");
    setRegNumInput(user?.registrationNumber || "");
    setBranchInput(user?.branch || "Computer Science & Engineering");
    setSemesterInput(String(user?.semester || 1));
    setProgrammeInput(user?.programmeName || "B.Tech");
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateUserProfile({
        name: nameInput.trim() || user?.name || "Student",
        collegeName: collegeInput.trim(),
        registrationNumber: regNumInput.trim(),
        branch: branchInput.trim(),
        semester: parseInt(semesterInput) || 1,
        programmeName: programmeInput.trim(),
      });
      setIsEditModalOpen(false);
      showToast("Profile details updated successfully!");
    } catch (err) {
      console.error(err);
      showToast("Error updating profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
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
              Student Identity
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            <span className="text-xs text-slate-400">Academic Profile</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Profile & Credentials
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <GlassButton
            variant="primary"
            onClick={handleOpenEdit}
            icon={<Edit3 className="w-4 h-4 text-cyan-400" />}
          >
            Edit Profile
          </GlassButton>
          <GlassButton
            variant="secondary"
            onClick={() => logout()}
            icon={<LogOut className="w-4 h-4 text-rose-400" />}
            className="text-rose-400 hover:text-rose-300"
          >
            Sign Out
          </GlassButton>
        </div>
      </div>

      {/* User Hero Glass Panel */}
      <GlassCard variant="elevated" className="p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-cyan-500 to-indigo-500 p-1 shadow-xl shadow-cyan-500/20 shrink-0">
            <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center font-bold text-2xl text-white">
              {user?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase() || "ST"}
            </div>
          </div>

          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              {user?.name || "Student"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {user?.email || "No email registered"}
            </p>

            <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-600/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20">
                {user?.branch || "General Engineering"}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-600/10 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20">
                Semester {user?.semester || 1}
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-black/10 dark:border-white/10">
                Target: {user?.globalTarget || 75}%
              </span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Academic Information Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <GlassCard variant="default" className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Institutional Details
            </h3>
            <button
              onClick={handleOpenEdit}
              className="text-xs font-bold text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3 h-3" /> Edit
            </button>
          </div>

          <div className="flex items-center gap-3">
            <School className="w-5 h-5 text-indigo-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">College / University</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {user?.collegeName || "Click Edit to specify university"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <IdCard className="w-5 h-5 text-cyan-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">Student Roll / Reg ID</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {user?.registrationNumber || "Click Edit to add ID"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <BookOpen className="w-5 h-5 text-purple-400 shrink-0" />
            <div>
              <p className="text-xs text-slate-400">Degree Programme</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {user?.programmeName || "B.Tech"}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="default" className="p-6 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Attendance Performance Snapshot
          </h3>

          <div className="flex items-center justify-between text-sm py-2 border-b border-black/5 dark:border-white/10">
            <span className="text-slate-400">Overall Attendance</span>
            <span className="font-extrabold text-cyan-400" suppressHydrationWarning>{overallMetrics.percentage}%</span>
          </div>

          <div className="flex items-center justify-between text-sm py-2 border-b border-black/5 dark:border-white/10">
            <span className="text-slate-400">Active Courses</span>
            <span className="font-bold text-slate-900 dark:text-white" suppressHydrationWarning>{subjects.length} Subjects</span>
          </div>

          <div className="flex items-center justify-between text-sm py-2 border-b border-black/5 dark:border-white/10">
            <span className="text-slate-400">Attended / Total Held</span>
            <span className="font-bold text-slate-900 dark:text-white" suppressHydrationWarning>
              {overallMetrics.attended} / {overallMetrics.conducted}
            </span>
          </div>

          <div className="flex items-center justify-between text-sm py-2">
            <span className="text-slate-400">Total Safe Skips Available</span>
            <span className="font-bold text-amber-400" suppressHydrationWarning>{overallMetrics.safeBunks} Classes</span>
          </div>
        </GlassCard>
      </div>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
          <div className="glass-modal max-w-md w-full p-6 sm:p-8 rounded-3xl border border-black/10 dark:border-white/20 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Edit Student Profile
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Update your department, semester, and institution records.
            </p>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder="Your full name"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-slate-900 dark:text-white focus:outline-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  College / University
                </label>
                <input
                  type="text"
                  value={collegeInput}
                  onChange={(e) => setCollegeInput(e.target.value)}
                  placeholder="e.g. National Institute of Technology"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-slate-900 dark:text-white focus:outline-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Roll / Registration No.
                </label>
                <input
                  type="text"
                  value={regNumInput}
                  onChange={(e) => setRegNumInput(e.target.value)}
                  placeholder="e.g. 21BCE1024"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-slate-900 dark:text-white focus:outline-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Branch / Department
                  </label>
                  <input
                    type="text"
                    value={branchInput}
                    onChange={(e) => setBranchInput(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-slate-900 dark:text-white focus:outline-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    Current Semester
                  </label>
                  <select
                    value={semesterInput}
                    onChange={(e) => setSemesterInput(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-slate-900 dark:text-white focus:outline-cyan-400 bg-white dark:bg-slate-900"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                      <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                        Semester {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  Programme / Degree
                </label>
                <input
                  type="text"
                  value={programmeInput}
                  onChange={(e) => setProgrammeInput(e.target.value)}
                  placeholder="e.g. B.Tech / B.E. / BCA / M.Tech"
                  className="w-full px-4 py-2.5 rounded-xl glass-input text-sm text-slate-900 dark:text-white focus:outline-cyan-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <GlassButton
                  type="button"
                  variant="secondary"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </GlassButton>
                <GlassButton
                  type="submit"
                  variant="primary"
                  disabled={isSaving}
                  icon={<Check className="w-4 h-4 text-cyan-400" />}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
