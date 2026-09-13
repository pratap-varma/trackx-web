"use client";

import React, { useEffect } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("TrackX Uncaught Error Boundary:", error);
  }, [error]);

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <GlassCard variant="elevated" className="max-w-md w-full p-8 sm:p-10 text-center space-y-6">
        <div className="w-14 h-14 rounded-3xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-xl shadow-rose-500/10">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            System Telemetry Glitch
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            An unexpected error occurred while rendering this interface. Your data remains safe and synced.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <GlassButton
            variant="primary"
            icon={<RotateCcw className="w-4 h-4 text-cyan-400" />}
            onClick={() => reset()}
            className="w-full sm:w-auto"
          >
            Try Again
          </GlassButton>
          <Link href="/dashboard" className="w-full sm:w-auto">
            <GlassButton
              variant="secondary"
              icon={<Home className="w-4 h-4" />}
              className="w-full sm:w-auto"
            >
              Dashboard
            </GlassButton>
          </Link>
        </div>
      </GlassCard>
    </div>
  );
}
