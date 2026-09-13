"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  X,
  Trash2,
  Check,
  Tag,
  Calendar,
  Clock,
  User,
} from "lucide-react";

interface ClassNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  subjectName: string;
  subjectCode?: string;
  facultyName?: string;
  periodNumber?: number;
  timeRange?: string;
  date: Date;
  initialNote?: string;
  onSave: (note: string) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
}

const QUICK_TAGS = [
  { label: "Assignment Given", prefix: "📌 Assignment: " },
  { label: "Quiz / Test", prefix: "⚡ Quiz / Test: " },
  { label: "Topics Covered", prefix: "📖 Covered: " },
  { label: "Lab Work", prefix: "🧪 Lab: " },
  { label: "Exam Important", prefix: "⚠️ Important: " },
];

export const ClassNoteModal: React.FC<ClassNoteModalProps> = ({
  isOpen,
  onClose,
  subjectName,
  subjectCode,
  facultyName,
  periodNumber,
  timeRange,
  date,
  initialNote = "",
  onSave,
  onDelete,
}) => {
  const [noteText, setNoteText] = useState(initialNote);
  const [prevInitial, setPrevInitial] = useState(initialNote);
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const [isSaving, setIsSaving] = useState(false);

  if (initialNote !== prevInitial || isOpen !== prevOpen) {
    setPrevInitial(initialNote);
    setPrevOpen(isOpen);
    setNoteText(initialNote);
  }

  if (!isOpen) return null;

  const handleAddTag = (prefix: string) => {
    if (!noteText.trim()) {
      setNoteText(prefix);
    } else {
      setNoteText((prev) => `${prev.trim()}\n${prefix}`);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(noteText);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setIsSaving(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md transition-opacity"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 15 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 15 }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="relative w-full max-w-lg rounded-3xl glass-panel p-6 sm:p-7 z-10 border border-white/20 dark:border-white/10 shadow-2xl overflow-hidden bg-[#16171E]/95 text-slate-100"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-4 pb-4 border-b border-white/10">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-[#5B5FEF]/20 text-[#7BD0FF] border border-[#5B5FEF]/40">
                  <FileText className="w-3 h-3" />
                  <span>Class Note</span>
                </span>
                {periodNumber !== undefined && (
                  <span className="text-[11px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md">
                    Period {periodNumber}
                  </span>
                )}
                {timeRange && (
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeRange}
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 mt-1">
                {subjectName}
                {subjectCode && (
                  <span className="text-xs font-mono text-slate-400 font-normal">
                    ({subjectCode})
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#7BD0FF]" />
                  {formattedDate}
                </span>
                {facultyName && (
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    {facultyName}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Tags Bar */}
          <div className="mb-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 mb-2">
              <Tag className="w-3 h-3 text-[#7BD0FF]" />
              <span>Quick Note Templates:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag.label}
                  type="button"
                  onClick={() => handleAddTag(tag.prefix)}
                  className="px-2.5 py-1 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 hover:border-[#5B5FEF]/40 transition-all cursor-pointer active:scale-95"
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Area */}
          <div className="space-y-1.5 mb-5">
            <label className="text-[11px] uppercase tracking-wider font-bold text-[#C0C1FF] flex items-center justify-between">
              <span>Class Notes & Takeaways</span>
              <span className="font-mono text-[10px] text-slate-500">
                {noteText.length} characters
              </span>
            </label>
            <div className="relative rounded-2xl bg-black/40 border border-white/10 focus-within:border-[#5B5FEF] transition-all p-3 shadow-inner">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="What was covered in class today? E.g., Chapters covered, homework assigned, test announced, or lab instructions..."
                rows={5}
                autoFocus
                className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 resize-none focus:outline-none leading-relaxed"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <div>
              {initialNote && onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Note</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-extrabold text-white bg-gradient-to-r from-[#5B5FEF] to-[#7BD0FF] hover:from-[#4E52E6] hover:to-[#69C4F8] shadow-lg shadow-[#5B5FEF]/30 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Note</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
