import type { Metadata } from "next";
import "./globals.css";
import { TrackXProvider } from "@/context/TrackXContext";
import { AppBackground } from "@/components/layout/AppBackground";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "TrackX — Intelligent Student Attendance Platform",
  description:
    "Student attendance intelligence platform. Track attendance, forecast class skips, manage timetables, and achieve academic goals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen selection:bg-[#5B5FEF]/30 selection:text-[#C0C1FF]">
        <TrackXProvider>
          <AppBackground>
            <AppShell>{children}</AppShell>
          </AppBackground>
        </TrackXProvider>
      </body>
    </html>
  );
}

