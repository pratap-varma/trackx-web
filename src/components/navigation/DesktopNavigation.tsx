"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  History,
  Lightbulb,
  Settings,
  Layers,
  LogOut,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTrackX } from "@/context/TrackXContext";

// Unique nav from reference
const SIDEBAR_NAV = [
  { label: "Dashboard",  href: "/dashboard",    icon: LayoutDashboard },
  { label: "Subjects",   href: "/subjects",      icon: Layers },
  { label: "Timetable",  href: "/calendar?view=timetable", icon: CalendarDays },
  { label: "History",    href: "/attendance",    icon: History },
  { label: "Insights",   href: "/analytics",     icon: Lightbulb },
  { label: "Settings",   href: "/settings",      icon: Settings },
];

export const DesktopNavigation: React.FC = () => {
  const pathname = usePathname();
  const { user, overallMetrics, logout } = useTrackX();
  const targetPct = user?.globalTarget ?? 75;
  const pct = Math.round(overallMetrics.percentage);

  const isActive = (href: string) => {
    const basePath = href.split("?")[0];
    return pathname === basePath || (basePath !== "/dashboard" && pathname.startsWith(basePath));
  };

  return (
    <aside
      className="hidden lg:flex flex-col !fixed left-0 top-0 bottom-0 w-[168px] z-40"
      style={{
        background: "#1F1F1F",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Brand ── */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-6">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-black text-sm shrink-0"
          style={{ background: "#FFFFFF", color: "#1A1A1A" }}
        >
          X
        </div>
        <span className="text-sm font-bold tracking-tight" style={{ color: "#FFFFFF" }}>
          TRACKX
        </span>
        <ThemeToggle />
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-2 space-y-0.5">
        {SIDEBAR_NAV.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={`${item.label}-${item.href}`}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all"
              style={{
                background: active ? "rgba(255,255,255,0.12)" : "transparent",
                color: active ? "#FFFFFF" : "#888888",
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)";
                  (e.currentTarget as HTMLElement).style.color = "#CCCCCC";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "#888888";
                }
              }}
            >
              <Icon className="w-4 h-4 shrink-0" strokeWidth={active ? 2 : 1.5} />
              <span>{item.label}</span>
              {active && (
                <span
                  className="ml-auto w-1.5 h-1.5 rounded-full"
                  style={{ background: "#4ADE80" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Sign Out ── */}
      <div className="px-2 pb-4">
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium cursor-pointer transition-all text-left"
          style={{ color: "#555555" }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#F87171";
            (e.currentTarget as HTMLElement).style.background = "rgba(248,113,113,0.06)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "#555555";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <LogOut className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* ── Semester Progress — matches reference bottom block ── */}
      <div
        className="mx-3 mb-4 p-3.5 rounded-xl"
        style={{ background: "#2A2A2A", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <p
          className="text-[9px] font-bold uppercase tracking-[1.5px] mb-2"
          style={{ color: "#555555" }}
        >
          Semester Progress
        </p>
        <p className="text-sm font-bold mb-1" style={{ color: "#F0F0F0" }}>
          Overall: {pct}%
        </p>
        <div
          className="w-full h-1 rounded-full mb-2 overflow-hidden"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(pct, 100)}%`,
              background: pct >= targetPct ? "#4ADE80" : "#F87171",
            }}
          />
        </div>
        <p className="text-[10px]" style={{ color: "#555555" }}>
          Target: {targetPct}%
        </p>
      </div>
    </aside>
  );
};
