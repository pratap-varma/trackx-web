"use client";

import React from "react";

export const AppBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="relative min-h-screen w-full">
      {/* Solid page background — matches reference exactly */}
      <div className="fixed inset-0 -z-10" style={{ background: "var(--bg-page, #1A1A1A)" }} />
      <div className="relative z-0">{children}</div>
    </div>
  );
};
