"use client";

import React from "react";
import { RiskStatus } from "@/types/trackx";

interface AttendanceBadgeProps {
  status: RiskStatus;
  percentage?: number;
  className?: string;
  showText?: boolean;
}

export const AttendanceBadge: React.FC<AttendanceBadgeProps> = ({
  status,
  percentage,
  className = "",
  showText = true,
}) => {
  const config = {
    healthy: {
      bg: "bg-cyan-500/10 dark:bg-cyan-500/15",
      border: "border-cyan-500/30",
      text: "text-cyan-700 dark:text-cyan-300",
      dot: "bg-cyan-400 shadow-[0_0_8px_#00F2FE]",
      label: "Healthy",
    },
    attention: {
      bg: "bg-amber-500/10 dark:bg-amber-500/15",
      border: "border-amber-500/30",
      text: "text-amber-700 dark:text-amber-300",
      dot: "bg-amber-400 shadow-[0_0_8px_#F59E0B]",
      label: "Attention",
    },
    critical: {
      bg: "bg-rose-500/10 dark:bg-rose-500/15",
      border: "border-rose-500/30",
      text: "text-rose-700 dark:text-rose-300",
      dot: "bg-rose-400 shadow-[0_0_8px_#F43F5E]",
      label: "Critical",
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border backdrop-blur-md transition-colors ${config.bg} ${config.border} ${config.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {showText && <span>{config.label}</span>}
      {percentage !== undefined && (
        <span className="font-semibold ml-0.5">{percentage.toFixed(1)}%</span>
      )}
    </span>
  );
};
