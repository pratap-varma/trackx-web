"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Layers, History, Lightbulb, Settings } from "lucide-react";

const ITEMS = [
  { label: "Dashboard", href: "/dashboard",  icon: LayoutDashboard },
  { label: "Subjects",  href: "/subjects",    icon: Layers },
  { label: "History",   href: "/attendance",  icon: History },
  { label: "Insights",  href: "/analytics",   icon: Lightbulb },
  { label: "Settings",  href: "/settings",    icon: Settings },
];

export const MobileBottomDock: React.FC = () => {
  const pathname = usePathname();

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-50">
      <nav
        className="flex items-center justify-around px-2 py-2"
        style={{
          background: "#1F1F1F",
          borderTop: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {ITEMS.map((item) => {
          const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-all"
              style={{ color: active ? "#4ADE80" : "#555555" }}
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2 : 1.5} />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
};
