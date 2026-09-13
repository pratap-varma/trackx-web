"use client";

import React from "react";
import Link from "next/link";
import { Bell, Settings, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTrackX } from "@/context/TrackXContext";

export const TopHeader: React.FC = () => {
  const { user, notifications } = useTrackX();
  const unread = notifications.filter((n) => !n.isRead).length;
  const isAdmin = user?.email?.toLowerCase() === "pratapvarmauppalapati6@gmail.com";

  return (
    <header
      className="lg:hidden sticky top-0 z-30 flex items-center justify-between px-4 h-14"
      style={{
        background: "#1F1F1F",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <Link href="/dashboard" className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-sm"
          style={{ background: "#FFFFFF", color: "#1A1A1A" }}
        >
          X
        </div>
        <span className="text-sm font-bold" style={{ color: "#FFFFFF" }}>TRACKX</span>
      </Link>

      <div className="flex items-center gap-1">
        {isAdmin && (
          <Link
            href="/admin"
            className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            title="Admin Command Center"
          >
            <ShieldCheck className="w-4.5 h-4.5" />
          </Link>
        )}
        <Link
          href="/notifications"
          className="relative p-2 rounded-lg"
          style={{ color: "#666666" }}
        >
          <Bell className="w-4.5 h-4.5" />
          {unread > 0 && (
            <span
              className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
              style={{ background: "#4ADE80" }}
            />
          )}
        </Link>
        <Link href="/settings" className="p-2 rounded-lg" style={{ color: "#666666" }}>
          <Settings className="w-4.5 h-4.5" />
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
};
