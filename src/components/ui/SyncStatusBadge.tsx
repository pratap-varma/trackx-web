"use client";

import React, { useState } from "react";
import { RefreshCw, X } from "lucide-react";

interface SyncStatusBadgeProps {
  isSyncing?: boolean;
  pendingCount?: number;
  lastSyncTime?: Date;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  isSyncing = false,
  pendingCount = 0,
  lastSyncTime = new Date(),
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const ledClass = isSyncing
    ? "skeuo-led-blue animate-pulse"
    : pendingCount > 0
    ? "skeuo-led-amber animate-pulse"
    : "skeuo-led-green";

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="skeuo-inset inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer hover:border-white/20 active:scale-[0.98]"
      >
        {/* Physical Domed LED Indicator Jewel */}
        <span className="relative flex items-center justify-center">
          <span className={`w-2.5 h-2.5 rounded-full ${ledClass}`} />
        </span>

        <span className="text-slate-700 dark:text-slate-300 font-semibold tracking-wide">
          {isSyncing ? "Syncing..." : pendingCount > 0 ? `${pendingCount} Queued` : "Cloud Synced"}
        </span>

        {isSyncing && <RefreshCw className="w-3 h-3 text-[#7BD0FF] animate-spin ml-0.5" />}
      </button>

      {/* Sync Details Modal Sheet */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
          />

          <div className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 skeuo-modal border border-white/20 z-10 space-y-6 animate-in zoom-in-95">
            <div className="w-10 h-1 rounded-full bg-white/20 mx-auto sm:hidden" />

            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl skeuo-card flex items-center justify-center border border-emerald-500/40">
                  <span className="w-4 h-4 rounded-full skeuo-led-green" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-[#DEE2F4]">
                    Cloud Telemetry Sync
                  </h3>
                  <p className="text-xs text-slate-400" suppressHydrationWarning>
                    Last synchronised: {lastSyncTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl skeuo-inset space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Pending Sync Queue</span>
                <strong className="text-slate-900 dark:text-[#DEE2F4] font-bold">{pendingCount} records</strong>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex justify-between">
                <span className="text-slate-400">Storage Architecture</span>
                <strong className="text-[#7BD0FF] font-bold">Offline-First (Local ↔ Cloud)</strong>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex justify-between">
                <span className="text-slate-400">Database Engine</span>
                <strong className="text-[#C0C1FF] font-bold">Firestore Multi-Region</strong>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-3 px-4 rounded-xl skeuo-button-primary font-bold text-sm shadow-lg cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
