"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useTrackX } from "@/context/TrackXContext";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import {
  AlertTriangle,
  Clock,
  Award,
  Info,
  Check,
  CheckCheck,
  Trash2,
  Bell,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function NotificationsPage() {
  const {
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearAllNotifications,
  } = useTrackX();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((c) => (c === msg ? null : c));
    }, 2500);
  };

  const handleMarkAllRead = () => {
    markAllNotificationsAsRead();
    showToast("All notifications marked as read");
  };

  const handleClearAll = () => {
    clearAllNotifications();
    showToast("All notifications cleared");
  };

  const unreadCount = notifications.filter((n) => !n.isRead).length;

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
              System Alerts
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            <span className="text-xs text-slate-400">
              {unreadCount > 0 ? `${unreadCount} Unread Alerts` : "All Caught Up"}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Notifications & Insights
          </h1>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <GlassButton
                size="sm"
                variant="secondary"
                onClick={handleMarkAllRead}
                icon={<CheckCheck className="w-4 h-4 text-cyan-400" />}
              >
                Mark All Read
              </GlassButton>
            )}
            <GlassButton
              size="sm"
              variant="secondary"
              onClick={handleClearAll}
              icon={<Trash2 className="w-4 h-4 text-rose-400" />}
              className="text-rose-400 hover:text-rose-300"
            >
              Clear All
            </GlassButton>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <GlassCard className="p-16 text-center space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-2">
              <Bell className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              All Caught Up!
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              No active warnings, safe skip notices, or timetable reminders. Any low attendance alerts or daily schedules will appear here in real time.
            </p>
          </GlassCard>
        ) : (
          notifications.map((notif) => {
            const Icon =
              notif.type === "warning"
                ? AlertTriangle
                : notif.type === "reminder"
                ? Clock
                : notif.type === "achievement"
                ? Award
                : Info;

            const iconColors = {
              warning: "text-rose-400 bg-rose-500/10 border-rose-500/30",
              reminder: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
              achievement: "text-amber-400 bg-amber-500/10 border-amber-500/30",
              info: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
            }[notif.type];

            return (
              <GlassCard
                key={notif.id}
                variant={notif.isRead ? "subtle" : "default"}
                className={`p-5 flex items-start justify-between gap-4 transition-all ${
                  !notif.isRead ? "border-l-4 border-l-cyan-400" : "opacity-80"
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-2xl border shrink-0 ${iconColors}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {notif.title}
                      </h4>
                      {!notif.isRead && (
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 leading-relaxed">
                      {notif.message}
                    </p>
                    <span
                      className="text-[10px] text-slate-400 mt-2 block"
                      suppressHydrationWarning
                    >
                      {new Date(notif.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!notif.isRead && (
                    <button
                      onClick={() => markNotificationAsRead(notif.id)}
                      title="Mark as Read"
                      className="p-2 rounded-xl glass-card hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                    >
                      <Check className="w-4 h-4 text-cyan-400" />
                    </button>
                  )}
                  {notif.actionUrl && (
                    <Link href={notif.actionUrl}>
                      <GlassButton size="sm" variant="secondary">
                        <span className="text-xs">View</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </GlassButton>
                    </Link>
                  )}
                </div>
              </GlassCard>
            );
          })
        )}
      </div>
    </div>
  );
}
