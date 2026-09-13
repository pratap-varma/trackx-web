"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { auth, googleProvider } from "@/lib/firebase";
import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { apiClient } from "@/lib/apiClient";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ADMIN_EMAIL = "pratapvarmauppalapati6@gmail.com";
  const isAdminEmail = (em?: string | null) => em?.toLowerCase().trim() === ADMIN_EMAIL;

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      // Run Firebase auth and server login in parallel to halve latency.
      // Server login uses password hash verification (independent of Firebase token).
      const [serverRes] = await Promise.all([
        apiClient.login({ email, password }),
        signInWithEmailAndPassword(auth, email, password).catch((fbErr) => {
          console.warn("Firebase Auth login notice:", fbErr);
        }),
      ]);

      if (serverRes.user) {
        localStorage.setItem("trackx_user", JSON.stringify(serverRes.user));
      }

      const isUserAdmin = isAdminEmail(serverRes.user?.email || email);
      const targetRoute = isUserAdmin
        ? "/admin"
        : serverRes.user?.onboardingCompleted
        ? "/dashboard"
        : "/onboarding";
      router.push(targetRoute);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign in. Please verify credentials.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const googleEmail = cred.user?.email || auth.currentUser?.email;
      const targetRoute = isAdminEmail(googleEmail) ? "/admin" : "/dashboard";
      router.push(targetRoute);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in canceled or failed.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <GlassCard variant="elevated" className="w-full max-w-md p-8 sm:p-10 shadow-2xl space-y-6">
        {/* Brand */}
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 p-0.5 shadow-xl shadow-cyan-500/20 mx-auto mb-3">
            <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center font-black text-white text-xl">
              TX
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Welcome to TrackX
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Intelligent spatial attendance operating system
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
            {error}
          </div>
        )}

        {/* Google One-Tap */}
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-xl glass-card flex items-center justify-center gap-3 text-sm font-semibold text-slate-900 dark:text-white hover:bg-white/10 transition-all cursor-pointer border border-white/10"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-black/10 dark:bg-white/10" />
          <span className="text-[10px] uppercase font-bold text-slate-400">or email</span>
          <div className="flex-1 h-px bg-black/10 dark:bg-white/10" />
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              University Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="student@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? "text" : "password"}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl glass-input text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-cyan-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <GlassButton
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={isLoading}
          >
            Sign In to TrackX
          </GlassButton>
        </form>


        <div className="pt-2 border-t border-black/5 dark:border-white/10 text-center">
          <p className="text-xs text-slate-400">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-cyan-400 font-semibold hover:underline">
              Create student account
            </Link>
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
