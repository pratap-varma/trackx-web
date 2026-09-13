"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";

interface GlassCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "subtle" | "elevated" | "interactive" | "inset";
  glowColor?: "cyan" | "amber" | "coral" | "violet" | "none";
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = "",
  variant = "default",
  glowColor = "none",
  ...props
}) => {
  const variantStyles = {
    default: "skeuo-card p-5 rounded-2xl",
    subtle: "skeuo-card p-4 rounded-2xl",
    elevated: "skeuo-deck p-6 rounded-3xl",
    inset: "skeuo-inset p-5 rounded-2xl",
    interactive: "skeuo-card p-5 rounded-2xl cursor-pointer hover:-translate-y-0.5 active:translate-y-0.5 transition-all",
  }[variant];

  const glowStyles = {
    none: "",
    cyan: "border-[#7BD0FF]/40 shadow-[0_0_16px_rgba(123,208,255,0.15)]",
    amber: "border-[#F59E0B]/40 shadow-[0_0_16px_rgba(245,158,11,0.15)]",
    coral: "border-[#FF8B94]/40 shadow-[0_0_16px_rgba(255,139,148,0.15)]",
    violet: "border-[#5B5FEF]/40 shadow-[0_0_16px_rgba(91,95,239,0.15)]",
  }[glowColor];

  return (
    <motion.div
      className={`relative ${variantStyles} ${glowStyles} ${className}`}
      {...props}
    >
      {/* Top specular reflection bevel edge */}
      <div className="absolute top-0 inset-x-4 h-[1px] bg-gradient-to-r from-transparent via-white/50 dark:via-white/30 to-transparent pointer-events-none" />
      {/* Subtle frosted glass refraction sheen */}
      <div className="absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/[0.08] via-transparent to-transparent pointer-events-none" />
      {children}
    </motion.div>
  );
};
