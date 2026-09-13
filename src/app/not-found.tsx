"use client";

import React from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { Home, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <GlassCard variant="elevated" className="max-w-md w-full p-8 sm:p-10 text-center space-y-6">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-500 to-indigo-500 p-0.5 shadow-xl shadow-cyan-500/20 mx-auto">
          <div className="w-full h-full rounded-[22px] bg-slate-950 flex items-center justify-center font-black text-white text-xl">
            404
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Waypoint Not Found
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            The page or student resource you requested is unavailable or has moved coordinates.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <GlassButton
              variant="primary"
              icon={<Home className="w-4 h-4 text-cyan-400" />}
              className="w-full sm:w-auto"
            >
              Dashboard
            </GlassButton>
          </Link>
          <Link href="/subjects" className="w-full sm:w-auto">
            <GlassButton
              variant="secondary"
              icon={<Compass className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Browse Courses
            </GlassButton>
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
