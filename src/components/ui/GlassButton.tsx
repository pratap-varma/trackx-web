"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";

interface GlassButtonProps extends HTMLMotionProps<"button"> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "healthy";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  variant = "secondary",
  size = "md",
  icon,
  className = "",
  isLoading = false,
  disabled,
  ...props
}) => {
  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs rounded-xl gap-1.5",
    md: "px-4 py-2 text-sm rounded-xl gap-2",
    lg: "px-6 py-3 text-base rounded-2xl gap-2.5 font-bold",
  }[size];

  const variantStyles = {
    primary:
      "skeuo-button-primary font-bold",
    secondary:
      "skeuo-button-secondary font-semibold text-slate-900 dark:text-[#DEE2F4]",
    healthy:
      "bg-gradient-to-b from-emerald-500 to-emerald-700 text-white font-bold border border-emerald-400/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_3px_0_#065F46,0_6px_12px_rgba(0,0,0,0.35)] active:translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_0_0_transparent]",
    danger:
      "bg-gradient-to-b from-rose-500 to-rose-700 text-white font-bold border border-rose-400/40 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4),0_3px_0_#881337,0_6px_12px_rgba(0,0,0,0.35)] active:translate-y-0.5 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.5),0_0_0_transparent]",
    ghost:
      "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 border border-transparent active:translate-y-0.5",
  }[variant];

  return (
    <motion.button
      whileHover={disabled || isLoading ? undefined : { y: -1 }}
      whileTap={disabled || isLoading ? undefined : { y: 2 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center select-none cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : (
        <>
          {icon && <span className="flex items-center shrink-0">{icon}</span>}
          <span>{children}</span>
        </>
      )}
    </motion.button>
  );
};
