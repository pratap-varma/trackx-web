"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { DesktopNavigation } from "@/components/navigation/DesktopNavigation";
import { MobileBottomDock } from "@/components/navigation/MobileBottomDock";
import { TopHeader } from "@/components/navigation/TopHeader";
import { GlassButton } from "@/components/ui/GlassButton";
import { ArrowRight, Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTrackX } from "@/context/TrackXContext";
import { useIsMounted } from "@/hooks/useIsMounted";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    firebaseUser,
    user,
    isLoading,
    authStatus,
    firestoreStatus,
    profileStatus,
    firestoreErrorMessage,
    retryFirestoreConnection,
    logout,
  } = useTrackX();

  const [isRetrying, setIsRetrying] = useState(false);
  const mounted = useIsMounted();

  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup");

  const isOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding");

  // Route protection logic & onboarding guard
  useEffect(() => {
    // 1. AUTH_LOADING: WAIT
    if ((authStatus === "loading" || isLoading) && profileStatus !== "loaded") return;

    const isAuthenticated = authStatus === "authenticated" || !!firebaseUser || !!user;

    // 2. Unauthenticated users: allow public routes, protect everything else
    if (!isAuthenticated) {
      if (!isPublicRoute) {
        router.replace("/login");
      }
      return;
    }

    // 3. AUTHENTICATED + FIRESTORE_UNAVAILABLE:
    // If profile is NOT loaded yet, DO NOT redirect to Step 1! Show retry state (rendered below)
    if (firestoreStatus === "unavailable" && profileStatus !== "loaded") {
      return;
    }

    // 4. AUTHENTICATED + PERMISSION_DENIED:
    if (firestoreStatus === "permission-denied") {
      return;
    }

    // 5. AUTHENTICATED + PROFILE_LOADING: WAIT
    if (profileStatus === "loading") {
      return;
    }

    // 6. AUTHENTICATED + PROFILE_LOADED (or confirmed new user): Evaluate onboarding
    if (profileStatus === "loaded" || profileStatus === "missing") {
      const userEmail = (user?.email || firebaseUser?.email || "").toLowerCase().trim();
      const isAdminUser = userEmail === "pratapvarmauppalapati6@gmail.com";

      if (isAdminUser) {
        if (pathname.startsWith("/login") || pathname.startsWith("/signup") || isOnboarding) {
          router.replace("/admin");
          return;
        }
      }

      const isNewUser = profileStatus === "missing";
      const onboardingComplete =
        !isNewUser &&
        Boolean(
          user?.onboardingCompleted ||
          user?.onboardingState?.completed ||
          (user?.onboardingState?.profileCompleted && (user?.onboardingState?.attendanceBaselineCompleted || user?.onboardingState?.timetableCompleted))
        );

      const isDirectUploadRoute =
        pathname.startsWith("/timetable/upload") || pathname.startsWith("/attendance/upload");

      if (!onboardingComplete) {
        // Incomplete onboarding: direct to /onboarding if not already there, unless on a direct upload route
        if (!isOnboarding && !isDirectUploadRoute) {
          router.replace("/onboarding");
        }
      } else {
        // Completed onboarding: redirect away from auth pages and onboarding
        if (pathname.startsWith("/login") || pathname.startsWith("/signup") || isOnboarding) {
          router.replace(isAdminUser ? "/admin" : "/dashboard");
        }
      }
    }
  }, [
    authStatus,
    firestoreStatus,
    profileStatus,
    firebaseUser,
    user,
    isLoading,
    isPublicRoute,
    isOnboarding,
    pathname,
    router,
  ]);

  const isAuthenticated = authStatus === "authenticated" || !!firebaseUser || !!user;

  // 1. Show Connecting / Restoring state when loading on protected routes or during auth restore
  // When profile is already loaded (from cache or previous session), render instantly without blocking
  const isConnecting =
    !isPublicRoute &&
    !isOnboarding &&
    (!mounted ||
      (profileStatus !== "loaded" &&
        profileStatus !== "missing" &&
        (authStatus === "loading" ||
          isLoading ||
          (authStatus === "authenticated" &&
            firestoreStatus !== "unavailable" &&
            firestoreStatus !== "permission-denied" &&
            firestoreStatus !== "error"))));

  if (isConnecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "#1A1A1A" }}>
        <div className="flex flex-col items-center gap-4 text-center">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-[#1A1A1A] text-lg"
            style={{ background: "#4ADE80" }}
          >
            TX
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: "#888888" }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#4ADE80" }} />
            <span>Connecting to TrackX... Your setup is being restored.</span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Show Retry UI when Firestore is unavailable and profile is not loaded
  if (
    mounted &&
    !isPublicRoute &&
    !isOnboarding &&
    isAuthenticated &&
    firestoreStatus === "unavailable" &&
    profileStatus !== "loaded"
  ) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "#1A1A1A" }}>
        <div
          className="max-w-md w-full p-8 rounded-3xl border border-white/10 text-center space-y-6"
          style={{ background: "rgba(255, 255, 255, 0.03)" }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-[#1A1A1A] text-xl mx-auto shadow-lg"
            style={{ background: "#4ADE80" }}
          >
            TX
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Connecting to TrackX...</h2>
            <p className="text-sm text-slate-300">Your setup is being restored.</p>
            <p className="text-xs text-amber-400/90 pt-1">
              {firestoreErrorMessage || "Could not reach Cloud Firestore backend. Operating in offline mode."}
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-3">
            <GlassButton
              variant="primary"
              className="w-full justify-center py-3 font-bold"
              icon={isRetrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              onClick={async () => {
                setIsRetrying(true);
                await retryFirestoreConnection();
                setIsRetrying(false);
              }}
              disabled={isRetrying}
            >
              {isRetrying ? "Reconnecting..." : "Retry"}
            </GlassButton>
          </div>
        </div>
      </div>
    );
  }

  // 3. Show Permission Denied state
  if (mounted && !isPublicRoute && !isOnboarding && isAuthenticated && firestoreStatus === "permission-denied") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: "#1A1A1A" }}>
        <div
          className="max-w-md w-full p-8 rounded-3xl border border-rose-500/20 text-center space-y-4"
          style={{ background: "rgba(244, 63, 94, 0.05)" }}
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-white">Access Denied</h2>
          <p className="text-xs text-slate-300">
            Firestore security rules prevented accessing this user profile. Please verify you are signed into the correct account.
          </p>
          <GlassButton variant="secondary" className="w-full justify-center" onClick={logout}>
            Log Out
          </GlassButton>
        </div>
      </div>
    );
  }

  // If unauthenticated and on a protected route (before redirect finishes)
  if (mounted && !isAuthenticated && !isPublicRoute && !isOnboarding) {
    return null;
  }

  if (isPublicRoute || isOnboarding) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* Sleek Minimal Landing / Auth Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/60 dark:bg-[#0E131F]/70 border-b border-black/5 dark:border-white/10 transition-colors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#5B5FEF] to-[#7BD0FF] p-0.5 shadow-lg shadow-[#5B5FEF]/25 group-hover:scale-105 transition-transform duration-300">
                <div className="w-full h-full bg-[#0E131F] rounded-[14px] flex items-center justify-center">
                  <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#7BD0FF] to-[#C0C1FF] text-lg tracking-tight">
                    X
                  </span>
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">
                    Track<span className="text-[#7BD0FF]">X</span>
                  </span>
                  <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded-full bg-[#5B5FEF]/20 text-[#7BD0FF] border border-[#5B5FEF]/30">
                    Pro
                  </span>
                </div>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              {pathname === "/" ? (
                <>
                  <Link href="/login" className="hidden sm:block">
                    <GlassButton size="sm" variant="secondary">
                      Sign In
                    </GlassButton>
                  </Link>
                  <Link href="/login">
                    <GlassButton size="sm" variant="primary" icon={<ArrowRight className="w-4 h-4 text-[#7BD0FF]" />}>
                      Get Started
                    </GlassButton>
                  </Link>
                </>
              ) : pathname.startsWith("/login") ? (
                <Link href="/signup">
                  <GlassButton size="sm" variant="secondary">
                    Create Account
                  </GlassButton>
                </Link>
              ) : pathname.startsWith("/signup") ? (
                <Link href="/login">
                  <GlassButton size="sm" variant="secondary">
                    Sign In
                  </GlassButton>
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        {/* Public / Onboarding Content Container */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>

        {pathname === "/" && (
          <footer className="border-t border-black/5 dark:border-white/10 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            <p>© {new Date().getFullYear()} TrackX Intelligence. Built with Apple spatial depth &amp; precision math.</p>
          </footer>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Mobile / Tablet Top Header */}
      <TopHeader />

      {/* Desktop Side Navigation Rail */}
      <DesktopNavigation />

      {/* Main Application Canvas */}
      <div className="lg:pl-[168px] w-full min-h-screen">
        <main className="px-5 sm:px-6 lg:px-8 py-6 max-w-[1280px] w-full pb-28 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Floating Dock */}
      <MobileBottomDock />
    </>
  );
}
