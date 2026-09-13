"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { auth } from "@/lib/firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { apiClient } from "@/lib/apiClient";
import { Mail, Lock, User, School } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [branch, setBranch] = useState("Computer Science & Engineering");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      let createdUid: string | undefined;

      // 1. Attempt Firebase Auth registration
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        createdUid = cred.user?.uid;
        if (cred.user && name) {
          const { updateProfile } = await import("firebase/auth");
          await updateProfile(cred.user, { displayName: name }).catch(() => {});
        }
      } catch (fbErr) {
        console.warn("Firebase Auth signup notice:", fbErr);
      }

      // 2. Authoritative Server Database Registration
      const serverRes = await apiClient.register({
        email,
        password,
        name,
        branch,
        userId: createdUid,
      });

      if (serverRes.user) {
        localStorage.setItem("trackx_user", JSON.stringify(serverRes.user));
      }

      const targetRoute = serverRes.user?.onboardingCompleted ? "/dashboard" : "/onboarding";
      router.push(targetRoute);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create account.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <GlassCard variant="elevated" className="w-full max-w-md p-8 sm:p-10 shadow-2xl space-y-6">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-500 p-0.5 shadow-xl shadow-cyan-500/20 mx-auto mb-3">
            <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center font-black text-white text-xl">
              TX
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Create Student Profile
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Set up intelligent attendance tracking for your semester
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="Alex Rivera"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-cyan-400"
              />
            </div>
          </div>

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
              Department / Branch
            </label>
            <div className="relative">
              <School className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                placeholder="e.g. Computer Science"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
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
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-sm text-slate-900 dark:text-white placeholder-slate-500 focus:outline-cyan-400"
              />
            </div>
          </div>

          <GlassButton
            type="submit"
            variant="primary"
            className="w-full"
            isLoading={isLoading}
          >
            Create Account & Get Started
          </GlassButton>
        </form>

        <div className="pt-2 border-t border-black/5 dark:border-white/10 text-center">
          <p className="text-xs text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="text-cyan-400 font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
