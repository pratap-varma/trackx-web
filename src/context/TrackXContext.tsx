"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import {
  UserProfile,
  Subject,
  AttendanceRecord,
  TimetableEntry,
  Semester,
  NotificationItem,
  CourseGradeItem,
  AcademicEventItem,
  AuthStatus,
  FirestoreConnectionStatus,
  ProfileStatus,
  OnboardingStatus,
} from "@/types/trackx";
import { computeMetrics, AttendanceMetrics } from "@/lib/attendanceMath";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { doc, getDoc, getDocs, collection, setDoc, deleteDoc, onSnapshot, writeBatch, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { apiClient } from "@/lib/apiClient";
import { getHolidayInfo } from "@/lib/holidays";
import { findMatchingSubject, deduplicateSubjectList } from "@/lib/subjectMatcher";

interface TrackXContextType {
  user: UserProfile | null;
  firebaseUser: FirebaseUser | null;
  activeSemester: Semester | null;
  subjects: Subject[];
  records: AttendanceRecord[];
  timetable: TimetableEntry[];
  notifications: NotificationItem[];
  grades: CourseGradeItem[];
  academicEvents: AcademicEventItem[];
  theme: "dark" | "light";
  overallMetrics: AttendanceMetrics;
  subjectMetrics: Record<string, AttendanceMetrics>;
  isLoading: boolean;
  authStatus: AuthStatus;
  firestoreStatus: FirestoreConnectionStatus;
  profileStatus: ProfileStatus;
  onboardingStatus: OnboardingStatus;
  firestoreErrorMessage: string | null;
  retryFirestoreConnection: () => Promise<void>;
  classSubstitutes: Record<string, string>; // key: yyyyMMdd_entryId, value: substitute subjectId
  holidayOverrides: Record<string, boolean>; // key: yyyy-MM-dd, value: true if holiday
  classNotes: Record<string, string>; // key: YYYY-MM-DD_subjectId_periodNumber
  setTheme: (theme: "dark" | "light") => void;
  updateGlobalTarget: (target: number) => void;
  markAttendance: (
    subjectId: string,
    status: "present" | "absent",
    periodNumber?: number,
    durationHours?: number,
    targetDate?: Date,
    notes?: string
  ) => Promise<void>;
  saveClassNote: (
    subjectId: string,
    date: string | Date,
    periodNumber: number | undefined,
    notes: string
  ) => Promise<void>;
  deleteClassNote: (
    subjectId: string,
    date: string | Date,
    periodNumber: number | undefined
  ) => Promise<void>;
  getClassNote: (
    subjectId: string,
    date: string | Date,
    periodNumber?: number
  ) => string;
  unmarkAttendance: (
    subjectId: string,
    targetDate?: Date,
    periodNumber?: number,
    durationHours?: number
  ) => Promise<void>;
  deleteAttendanceRecord: (recordId: string) => Promise<void>;
  setSubstitute: (swapKey: string, subjectId: string) => Promise<void>;
  removeSubstitute: (swapKey: string) => Promise<void>;
  toggleHolidayOverride: (dateKey: string) => Promise<void>;
  resetHolidayOverride: (dateKey: string) => Promise<void>;
  saturdayTimetableOverrides: Record<string, number>;
  setSaturdayTimetableOverride: (dateKey: string, followedDayOfWeek: number | null) => Promise<void>;
  addSubject: (subject: Omit<Subject, "id" | "userId" | "createdAt" | "updatedAt">) => Promise<Subject>;
  updateSubject: (id: string, updates: Partial<Subject>) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  addTimetableEntry: (
    entry: Omit<TimetableEntry, "id" | "userId" | "createdAt" | "updatedAt">
  ) => Promise<TimetableEntry>;
  batchSaveTimetable: (entries: TimetableEntry[], replace?: boolean) => Promise<void>;
  generateTimetableFromSubjects: (subjectsToSchedule?: Subject[]) => Promise<void>;
  updateTimetableEntry: (id: string, updates: Partial<TimetableEntry>) => Promise<void>;
  deleteTimetableEntry: (id: string) => Promise<void>;
  swapPeriods: (dayOfWeek: number, periodA: number, periodB: number) => Promise<void>;
  copyDaySchedule: (fromDay: number, toDay: number) => Promise<void>;
  clearDaySchedule: (dayOfWeek: number) => Promise<void>;
  addGrade: (grade: Omit<CourseGradeItem, "id" | "userId">) => Promise<CourseGradeItem>;
  deleteGrade: (gradeId: string) => Promise<void>;
  addAcademicEvent: (event: Omit<AcademicEventItem, "id" | "userId">) => Promise<AcademicEventItem>;
  deleteAcademicEvent: (eventId: string) => Promise<void>;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearAllNotifications: () => void;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  resetToDemoData: () => void;
  logout: () => Promise<void>;
  refreshBackendData: () => Promise<void>;
}

export function createDefaultTimetableForSubjects(
  subjects: Subject[],
  userId: string,
  semesterId: string
): TimetableEntry[] {
  if (!subjects || subjects.length === 0) return [];

  const standardPeriods = [
    { periodNumber: 1, startTime: 555, endTime: 615 }, // 09:15 - 10:15
    { periodNumber: 2, startTime: 615, endTime: 675 }, // 10:15 - 11:15
    { periodNumber: 3, startTime: 675, endTime: 735 }, // 11:15 - 12:15
    { periodNumber: 4, startTime: 780, endTime: 840 }, // 13:00 - 14:00
    { periodNumber: 5, startTime: 840, endTime: 900 }, // 14:00 - 15:00
  ];

  const days = [1, 2, 3, 4, 5, 6];
  const entries: TimetableEntry[] = [];
  let subIdx = 0;

  days.forEach((dayOfWeek) => {
    const periodCount = dayOfWeek === 6 ? 4 : 5;
    const dayPeriods = standardPeriods.slice(0, periodCount);

    dayPeriods.forEach((p, pIdx) => {
      const sub = subjects[(subIdx + pIdx + dayOfWeek) % subjects.length];
      const isLab = sub.type === "Laboratory" || sub.name.toLowerCase().includes("lab");

      entries.push({
        id: `tt-${dayOfWeek}-${p.periodNumber}-${sub.id}`,
        userId,
        semesterId,
        subjectId: sub.id,
        dayOfWeek,
        periodNumber: p.periodNumber,
        startTime: p.startTime,
        endTime: p.endTime,
        room: isLab ? "Lab 201" : `LH-${(dayOfWeek + p.periodNumber) % 4 + 1}`,
        notes: `${sub.name}${sub.facultyName ? ` (${sub.facultyName})` : ""}`,
        isContinuousLab: false,
        isEnabled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
    subIdx += 2;
  });

  return entries;
}

const TrackXContext = createContext<TrackXContextType | null>(null);

export function TrackXProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);

  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);

  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [firestoreStatus, setFirestoreStatus] = useState<FirestoreConnectionStatus>("loading");
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>("loading");
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>("loading");
  const [firestoreErrorMessage, setFirestoreErrorMessage] = useState<string | null>(null);


  useEffect(() => {
    if (typeof window !== "undefined") {
      console.log(
        `[TrackX Diagnostics] AUTH: ${authStatus} | FIRESTORE: ${firestoreStatus} | PROFILE: ${profileStatus} | ONBOARDING: ${onboardingStatus}`
      );
    }
  }, [authStatus, firestoreStatus, profileStatus, onboardingStatus]);

  const [subjects, setSubjects] = useState<Subject[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("trackx_subjects");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const { canonicalSubjects } = deduplicateSubjectList(parsed);
            return canonicalSubjects;
          }
        } catch {}
      }
    }
    return [];
  });

  const [records, setRecords] = useState<AttendanceRecord[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("trackx_records");
      if (cached) {
        try { return JSON.parse(cached); } catch {}
      }
    }
    return [];
  });

  const [timetable, setTimetable] = useState<TimetableEntry[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("trackx_timetable");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {}
      }
      // If subjects exist in local storage, initialize with default timetable
      const cachedSubs = localStorage.getItem("trackx_subjects");
      if (cachedSubs) {
        try {
          const subs = JSON.parse(cachedSubs);
          if (Array.isArray(subs) && subs.length > 0) {
            const fallbackTt = createDefaultTimetableForSubjects(subs, "usr-guest", "sem-default");
            localStorage.setItem("trackx_timetable", JSON.stringify(fallbackTt));
            return fallbackTt;
          }
        } catch {}
      }
    }
    return [];
  });

  const [grades, setGrades] = useState<CourseGradeItem[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("trackx_grades");
      if (cached) {
        try { return JSON.parse(cached); } catch {}
      }
    }
    return [];
  });

  const [academicEvents, setAcademicEvents] = useState<AcademicEventItem[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("trackx_academic_events");
      if (cached) {
        try { return JSON.parse(cached); } catch {}
      }
    }
    return [];
  });

  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("trackx_read_notifs");
      if (cached) {
        try { return JSON.parse(cached); } catch {}
      }
    }
    return [];
  });

  const [dismissedNotifIds, setDismissedNotifIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("trackx_dismissed_notifs");
      if (cached) {
        try { return JSON.parse(cached); } catch {}
      }
    }
    return [];
  });

  const [theme, setThemeState] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("trackx_theme") as "dark" | "light" | null;
      if (saved) return saved;
    }
    return "dark";
  });

  const [classSubstitutes, setClassSubstitutes] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("trackx_substitutes");
      if (cached) {
        try { return JSON.parse(cached); } catch {}
      }
    }
    return {};
  });

  const [holidayOverrides, setHolidayOverrides] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("trackx_holidays");
      if (cached) {
        try { return JSON.parse(cached); } catch {}
      }
    }
    return {};
  });

  const [saturdayTimetableOverrides, setSaturdayTimetableOverrides] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("trackx_saturday_overrides");
      if (cached) {
        try { return JSON.parse(cached); } catch {}
      }
    }
    return {};
  });

  const [classNotes, setClassNotes] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("trackx_class_notes");
      if (cached) {
        try { return JSON.parse(cached); } catch {}
      }
    }
    return {};
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync document dark class
  useEffect(() => {
    if (typeof window === "undefined") return;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Load and synchronize data from Server Database
  const syncServerData = useCallback(async (targetUserId: string) => {
    try {
      const syncResult = await apiClient.fullSync(targetUserId);
      if (syncResult) {
        if (syncResult.user) {
          setUser(syncResult.user);
          localStorage.setItem("trackx_user", JSON.stringify(syncResult.user));
        }
        if (Array.isArray(syncResult.subjects)) {
          if (syncResult.subjects.length > 0) {
            const { canonicalSubjects } = deduplicateSubjectList(syncResult.subjects);
            setSubjects(canonicalSubjects);
            localStorage.setItem("trackx_subjects", JSON.stringify(canonicalSubjects));
          } else {
            const cachedSubs = localStorage.getItem("trackx_subjects");
            if (cachedSubs) {
              try {
                const parsed = JSON.parse(cachedSubs);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const { canonicalSubjects } = deduplicateSubjectList(parsed);
                  setSubjects(canonicalSubjects);
                  for (const sub of canonicalSubjects) {
                    apiClient.saveSubject(targetUserId, sub).catch(() => {});
                  }
                }
              } catch {}
            }
          }
        }
        if (Array.isArray(syncResult.timetable)) {
          if (syncResult.timetable.length > 0) {
            setTimetable(syncResult.timetable);
            localStorage.setItem("trackx_timetable", JSON.stringify(syncResult.timetable));
          } else {
            const cachedTt = localStorage.getItem("trackx_timetable");
            if (cachedTt) {
              try {
                const parsed = JSON.parse(cachedTt);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  setTimetable(parsed);
                  apiClient.batchSaveTimetable(targetUserId, parsed).catch(() => {});
                }
              } catch {}
            }
          }
        }
        if (Array.isArray(syncResult.records) && syncResult.records.length > 0) {
          setRecords(syncResult.records);
          localStorage.setItem("trackx_records", JSON.stringify(syncResult.records));
        }
        if (Array.isArray(syncResult.grades) && syncResult.grades.length > 0) {
          setGrades(syncResult.grades);
          localStorage.setItem("trackx_grades", JSON.stringify(syncResult.grades));
        }
        if (Array.isArray(syncResult.events) && syncResult.events.length > 0) {
          setAcademicEvents(syncResult.events);
          localStorage.setItem("trackx_academic_events", JSON.stringify(syncResult.events));
        }
        if (syncResult.substitutes && Object.keys(syncResult.substitutes).length > 0) {
          setClassSubstitutes(syncResult.substitutes);
          localStorage.setItem("trackx_substitutes", JSON.stringify(syncResult.substitutes));
        }
        if (syncResult.holidays && Object.keys(syncResult.holidays).length > 0) {
          setHolidayOverrides(syncResult.holidays);
          localStorage.setItem("trackx_holidays", JSON.stringify(syncResult.holidays));
        }
      }
    } catch (e) {
      console.warn("Backend server sync notice:", e);
    }
  }, []);

  const refreshBackendData = useCallback(async () => {
    const activeUid = auth.currentUser?.uid || user?.id;
    if (activeUid) {
      await syncServerData(activeUid);
    }
  }, [user?.id, syncServerData]);

  const retryFirestoreConnection = useCallback(async () => {
    const activeUid = auth.currentUser?.uid || firebaseUser?.uid || user?.id;
    if (!activeUid) return;
    setFirestoreStatus("loading");
    setFirestoreErrorMessage(null);
    try {
      const userDocRef = doc(db, "users", activeUid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        setUser(data);
        localStorage.setItem("trackx_user", JSON.stringify(data));
        setFirestoreStatus("connected");
        setProfileStatus("loaded");
        const isComp =
          Boolean(data.onboardingCompleted) &&
          (data.onboardingState ? Boolean(data.onboardingState.completed) : true);
        setOnboardingStatus(isComp ? "complete" : "incomplete");
      } else {
        setFirestoreStatus("connected");
        setProfileStatus("missing");
        setOnboardingStatus("incomplete");
      }
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      const code = error?.code || "";
      const msg = error?.message || "";
      if (
        code === "unavailable" ||
        msg.includes("unavailable") ||
        msg.includes("offline") ||
        msg.includes("Could not reach")
      ) {
        setFirestoreStatus("unavailable");
        setFirestoreErrorMessage(
          "Could not reach Cloud Firestore backend. Connection failed. Operating in offline mode."
        );
      } else if (code === "permission-denied" || msg.includes("permission-denied")) {
        setFirestoreStatus("permission-denied");
        setFirestoreErrorMessage(
          "Permission denied: Firestore security rules prevented accessing your profile."
        );
      } else {
        setFirestoreStatus("error");
        setFirestoreErrorMessage(msg || "Failed to reach Cloud Firestore.");
      }
    }
  }, [firebaseUser?.uid, user?.id]);

  // Initial Auth & Session Listener
  useEffect(() => {
    if (typeof window === "undefined") return;

    let unsubUserDoc: (() => void) | null = null;
    let unsubSubjects: (() => void) | null = null;
    let unsubTimetable: (() => void) | null = null;
    let unsubRecords: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        setAuthStatus("authenticated");
        setFirestoreErrorMessage(null);
        const activeUid = fbUser.uid;

        // Check local cached profile first to avoid blank flash or state loss
        let cachedUserProfile: UserProfile | null = null;
        const cachedStr = localStorage.getItem("trackx_user");
        if (cachedStr) {
          try {
            const parsed = JSON.parse(cachedStr);
            if (parsed?.id === activeUid) {
              cachedUserProfile = parsed;
              setUser(parsed);
              setProfileStatus("loaded");
              const isComp =
                Boolean(parsed.onboardingCompleted) &&
                (parsed.onboardingState ? Boolean(parsed.onboardingState.completed) : true);
              setOnboardingStatus(isComp ? "complete" : "incomplete");
              setIsLoading(false); // Instant unlock: dashboard renders immediately without delay
            }
          } catch {}
        }

        if (!cachedUserProfile) {
          setIsLoading(true);
          setProfileStatus("loading");
          setOnboardingStatus("loading");

          // Safety timeout: if Firestore hasn't resolved within 5s, fall through gracefully
          // instead of spinning forever (e.g. when Firestore is unavailable / misconfigured)
          const loadingTimeout = setTimeout(() => {
            setProfileStatus((current) => {
              if (current === "loading") {
                setIsLoading(false);
                setOnboardingStatus("incomplete");
                setFirestoreStatus("unavailable");
                setFirestoreErrorMessage("Could not load your profile. Please check your connection or try again.");
                return "missing";
              }
              return current;
            });
          }, 5000);

          // Store timeout so Firestore success can clear it
          (window as Window & { _trackxLoadTimeout?: ReturnType<typeof setTimeout> })._trackxLoadTimeout = loadingTimeout;
        }


        // 1. Authoritative Firestore Realtime Listener
        try {
          const userDocRef = doc(db, "users", activeUid);
          unsubUserDoc = onSnapshot(
            userDocRef,
            (snap) => {
              // Clear the loading timeout since Firestore responded
              const w = window as Window & { _trackxLoadTimeout?: ReturnType<typeof setTimeout> };
              if (w._trackxLoadTimeout) { clearTimeout(w._trackxLoadTimeout); w._trackxLoadTimeout = undefined; }

              if (snap.exists()) {
                const remoteUser = snap.data() as UserProfile;
                setUser(remoteUser);
                localStorage.setItem("trackx_user", JSON.stringify(remoteUser));
                setFirestoreStatus("connected");
                setFirestoreErrorMessage(null);
                setProfileStatus("loaded");
                const isComp =
                  Boolean(remoteUser.onboardingCompleted) &&
                  (remoteUser.onboardingState ? Boolean(remoteUser.onboardingState.completed) : true);
                setOnboardingStatus(isComp ? "complete" : "incomplete");
                setIsLoading(false);

                // Safe background sync to server API for session cookies without overwriting
                apiClient
                  .syncFirebaseUser({
                    userId: activeUid,
                    email: fbUser.email || remoteUser.email || "",
                    name: remoteUser.name || fbUser.displayName || undefined,
                    onboardingCompleted: remoteUser.onboardingCompleted,
                    onboardingState: remoteUser.onboardingState,
                  })
                  .catch(() => {});
              } else {
                if (snap.metadata.fromCache) {
                  // Still waiting for server response in offline/cache mode
                  return;
                }
                // Document confirmed nonexistent: genuine new user
                setFirestoreStatus("connected");
                setFirestoreErrorMessage(null);
                setProfileStatus("missing");
                setOnboardingStatus("incomplete");
                setIsLoading(false);
              }
            },
            (err: unknown) => {
              const error = err as { code?: string; message?: string };
              const code = error?.code || "";
              const msg = error?.message || "";
              if (
                code === "unavailable" ||
                msg.includes("unavailable") ||
                msg.includes("offline") ||
                msg.includes("Could not reach")
              ) {
                setFirestoreStatus("unavailable");
                setFirestoreErrorMessage(
                  "Could not reach Cloud Firestore backend. Connection failed. Operating in offline mode."
                );
                // CRITICAL: DO NOT default undefined to profileCompleted = false!
                // If local storage has user profile, preserve loaded state
                const currentCached = localStorage.getItem("trackx_user");
                if (currentCached) {
                  try {
                    const parsed = JSON.parse(currentCached);
                    if (parsed?.id === activeUid) {
                      setUser(parsed);
                      setProfileStatus("loaded");
                      const isComp =
                        Boolean(parsed.onboardingCompleted) &&
                        (parsed.onboardingState ? Boolean(parsed.onboardingState.completed) : true);
                      setOnboardingStatus(isComp ? "complete" : "incomplete");
                      setIsLoading(false);
                      return;
                    }
                  } catch {}
                }
                // If no cached user, keep profileStatus as 'loading' so onboarding guard displays retry screen
                setProfileStatus("loading");
                setOnboardingStatus("loading");
                setIsLoading(false);
              } else if (
                code === "permission-denied" ||
                msg.includes("permission-denied") ||
                msg.includes("Missing or insufficient permissions")
              ) {
                setFirestoreStatus("permission-denied");
                setFirestoreErrorMessage(
                  "Permission denied: Firestore security rules prevented accessing your profile."
                );
                setProfileStatus("loading");
                setIsLoading(false);
              } else {
                setFirestoreStatus("error");
                setFirestoreErrorMessage(msg);
                setIsLoading(false);
              }
            }
          );

          // Subcollection listeners
          const subjectsRef = collection(db, "users", activeUid, "subjects");
          unsubSubjects = onSnapshot(
            subjectsRef,
            (snap) => {
              if (!snap.empty) {
                const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subject));
                const { canonicalSubjects, idRemap } = deduplicateSubjectList(fetched);
                setSubjects(canonicalSubjects);
                localStorage.setItem("trackx_subjects", JSON.stringify(canonicalSubjects));

                // Clean up any duplicate documents in Firestore
                for (const [oldId, canonicalId] of idRemap.entries()) {
                  if (oldId !== canonicalId) {
                    deleteDoc(doc(db, "users", activeUid, "subjects", oldId)).catch(() => {});
                  }
                }
              }
            },
            (err) => console.warn("Firestore subjects listener notice:", err.message)
          );

          const timetableRef = collection(db, "users", activeUid, "timetable");
          unsubTimetable = onSnapshot(
            timetableRef,
            (snap) => {
              if (!snap.empty) {
                const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TimetableEntry));
                setTimetable(fetched);
                localStorage.setItem("trackx_timetable", JSON.stringify(fetched));
              }
            },
            (err) => console.warn("Firestore timetable listener notice:", err.message)
          );

          const recordsRef = collection(db, "users", activeUid, "records");
          unsubRecords = onSnapshot(
            recordsRef,
            (snap) => {
              if (!snap.empty) {
                const fetched = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AttendanceRecord));
                setRecords(fetched);
                localStorage.setItem("trackx_records", JSON.stringify(fetched));
              }
            },
            (err) => console.warn("Firestore records listener notice:", err.message)
          );
        } catch (fireErr) {
          console.warn("Firestore initialization error:", fireErr);
        }

        // 2. Active semester setup
        const sem: Semester = {
          id: `sem-${activeUid}`,
          userId: activeUid,
          name: "Current Semester",
          semesterNumber: cachedUserProfile?.semester || 1,
          academicYear: "2026 - 2027",
          startDate: new Date().toISOString().slice(0, 10),
          endDate: new Date(Date.now() + 120 * 86400000).toISOString().slice(0, 10),
          status: "Active",
          attendanceTarget: cachedUserProfile?.globalTarget || 75.0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setActiveSemester(sem);

        // 3. Background server data sync
        syncServerData(activeUid).catch(() => {});
      } else {
        // Unauthenticated or checking server session cookie
        setAuthStatus("unauthenticated");
        try {
          const sessionUser = await apiClient.getSession();
          if (sessionUser) {
            setUser(sessionUser);
            localStorage.setItem("trackx_user", JSON.stringify(sessionUser));
            setProfileStatus("loaded");
            const isComp =
              Boolean(sessionUser.onboardingCompleted) &&
              (sessionUser.onboardingState ? Boolean(sessionUser.onboardingState.completed) : true);
            setOnboardingStatus(isComp ? "complete" : "incomplete");
            await syncServerData(sessionUser.id);
          } else {
            const cachedUser = localStorage.getItem("trackx_user");
            if (cachedUser) {
              try {
                const parsed = JSON.parse(cachedUser);
                if (parsed?.id) {
                  setUser(parsed);
                  setProfileStatus("loaded");
                  const isComp =
                    Boolean(parsed.onboardingCompleted) &&
                    (parsed.onboardingState ? Boolean(parsed.onboardingState.completed) : true);
                  setOnboardingStatus(isComp ? "complete" : "incomplete");
                  await syncServerData(parsed.id);
                } else {
                  setProfileStatus("missing");
                  setOnboardingStatus("incomplete");
                }
              } catch {
                setProfileStatus("missing");
                setOnboardingStatus("incomplete");
              }
            } else {
              setProfileStatus("missing");
              setOnboardingStatus("incomplete");
            }
          }
        } catch {
          setProfileStatus("missing");
          setOnboardingStatus("incomplete");
        } finally {
          setIsLoading(false);
        }

        if (unsubUserDoc) unsubUserDoc();
        if (unsubSubjects) unsubSubjects();
        if (unsubTimetable) unsubTimetable();
        if (unsubRecords) unsubRecords();
      }
    });

    return () => {
      unsubscribe();
      if (unsubUserDoc) unsubUserDoc();
      if (unsubSubjects) unsubSubjects();
      if (unsubTimetable) unsubTimetable();
      if (unsubRecords) unsubRecords();
    };
  }, [syncServerData]);

  const logout = async () => {
    try {
      await signOut(auth);
      await apiClient.logout();
      setUser(null);
      setAuthStatus("unauthenticated");
      setFirestoreStatus("connected");
      setProfileStatus("missing");
      setOnboardingStatus("incomplete");
      setFirestoreErrorMessage(null);
      setSubjects([]);
      setTimetable([]);
      setRecords([]);
      setGrades([]);
      setAcademicEvents([]);
      setClassSubstitutes({});
      setHolidayOverrides({});
      setReadNotifIds([]);
      setDismissedNotifIds([]);
      localStorage.removeItem("trackx_user");
      localStorage.removeItem("trackx_subjects");
      localStorage.removeItem("trackx_timetable");
      localStorage.removeItem("trackx_records");
      localStorage.removeItem("trackx_grades");
      localStorage.removeItem("trackx_academic_events");
      localStorage.removeItem("trackx_substitutes");
      localStorage.removeItem("trackx_holidays");
      localStorage.removeItem("trackx_read_notifs");
      localStorage.removeItem("trackx_dismissed_notifs");
    } catch (e) {
      console.error("Sign-out error:", e);
    }
  };

  const setTheme = (newTheme: "dark" | "light") => {
    setThemeState(newTheme);
    localStorage.setItem("trackx_theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const updateGlobalTarget = async (target: number) => {
    const activeUid = auth.currentUser?.uid || user?.id;
    setUser((prev) => {
      if (!prev) return null;
      const updated = { ...prev, globalTarget: target };
      localStorage.setItem("trackx_user", JSON.stringify(updated));
      return updated;
    });

    setSubjects((prev) => {
      const updated = prev.map((s) => ({ ...s, targetAttendance: target }));
      localStorage.setItem("trackx_subjects", JSON.stringify(updated));
      return updated;
    });

    if (activeUid) {
      apiClient.updateProfile(activeUid, { globalTarget: target }).catch(() => {});
      try {
        setDoc(doc(db, "users", activeUid), { globalTarget: target, updatedTimestamp: Date.now() }, { merge: true }).catch(() => {});
      } catch {}
    }
  };

  const setSubstitute = async (swapKey: string, subjectId: string) => {
    const activeUid = auth.currentUser?.uid || user?.id;
    setClassSubstitutes((prev) => {
      const updated = { ...prev, [swapKey]: subjectId };
      localStorage.setItem("trackx_substitutes", JSON.stringify(updated));
      return updated;
    });
    if (activeUid) {
      await apiClient.setSubstitute(activeUid, swapKey, subjectId);
    }
  };

  const removeSubstitute = async (swapKey: string) => {
    const activeUid = auth.currentUser?.uid || user?.id;
    setClassSubstitutes((prev) => {
      const updated = { ...prev };
      delete updated[swapKey];
      localStorage.setItem("trackx_substitutes", JSON.stringify(updated));
      return updated;
    });
    if (activeUid) {
      await apiClient.removeSubstitute(activeUid, swapKey);
    }
  };

  const toggleHolidayOverride = async (dateKey: string) => {
    const activeUid = auth.currentUser?.uid || user?.id;
    const info = getHolidayInfo(dateKey, holidayOverrides);
    const nextValue = !info.isHoliday;

    setHolidayOverrides((prev) => {
      const updated = { ...prev, [dateKey]: nextValue };
      localStorage.setItem("trackx_holidays", JSON.stringify(updated));
      return updated;
    });


    // If Saturday was toggled back to holiday, clear any Saturday timetable override for that date
    const dateObj = new Date(dateKey + "T00:00:00");
    if (dateObj.getDay() === 6 && nextValue === true) {
      setSaturdayTimetableOverrides((prev) => {
        const updated = { ...prev };
        delete updated[dateKey];
        localStorage.setItem("trackx_saturday_overrides", JSON.stringify(updated));
        return updated;
      });
    }

    if (activeUid) {
      const updated = await apiClient.toggleHoliday(activeUid, dateKey, nextValue);
      setHolidayOverrides(updated);
    }
  };

  const resetHolidayOverride = async (dateKey: string) => {
    const activeUid = auth.currentUser?.uid || user?.id;
    setHolidayOverrides((prev) => {
      const updated = { ...prev };
      delete updated[dateKey];
      localStorage.setItem("trackx_holidays", JSON.stringify(updated));
      return updated;
    });
    setSaturdayTimetableOverrides((prev) => {
      const updated = { ...prev };
      delete updated[dateKey];
      localStorage.setItem("trackx_saturday_overrides", JSON.stringify(updated));
      return updated;
    });
    if (activeUid) {
      const updated = await apiClient.resetHoliday(activeUid, dateKey);
      setHolidayOverrides(updated);
    }
  };

  const setSaturdayTimetableOverride = async (dateKey: string, followedDayOfWeek: number | null) => {
    const activeUid = auth.currentUser?.uid || user?.id;
    if (followedDayOfWeek === null) {
      // Clear Saturday timetable override and restore weekend holiday
      setSaturdayTimetableOverrides((prev) => {
        const updated = { ...prev };
        delete updated[dateKey];
        localStorage.setItem("trackx_saturday_overrides", JSON.stringify(updated));
        return updated;
      });
      setHolidayOverrides((prev) => {
        const updated = { ...prev };
        delete updated[dateKey]; // Return to default Saturday weekend holiday
        localStorage.setItem("trackx_holidays", JSON.stringify(updated));
        return updated;
      });
      if (activeUid) {
        const updated = await apiClient.resetHoliday(activeUid, dateKey);
        setHolidayOverrides(updated);
      }
    } else {
      // Set to follow the selected weekday's timetable (1=Mon ... 5=Fri)
      setSaturdayTimetableOverrides((prev) => {
        const updated = { ...prev, [dateKey]: followedDayOfWeek };
        localStorage.setItem("trackx_saturday_overrides", JSON.stringify(updated));
        return updated;
      });
      // Mark as NOT a holiday (working day)
      setHolidayOverrides((prev) => {
        const updated = { ...prev, [dateKey]: false };
        localStorage.setItem("trackx_holidays", JSON.stringify(updated));
        return updated;
      });
      if (activeUid) {
        const updated = await apiClient.toggleHoliday(activeUid, dateKey, false);
        setHolidayOverrides(updated);
      }
    }
  };


  const markAttendance = async (
    subjectId: string,
    status: "present" | "absent",
    periodNumber?: number,
    durationHours: number = 1,
    targetDate?: Date,
    notes?: string
  ) => {
    const recordDate = targetDate ? targetDate.toISOString() : new Date().toISOString();
    const dateKey = recordDate.slice(0, 10);
    const noteKey = `${dateKey}_${subjectId}_${periodNumber ?? 0}`;
    const effectiveNotes = notes !== undefined ? notes : (classNotes[noteKey] || undefined);
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";

    const currentSub = subjects.find((s) => s.id === subjectId);
    const updatedSub: Subject | undefined = currentSub
      ? {
          ...currentSub,
          presentClasses: status === "present" ? currentSub.presentClasses + durationHours : currentSub.presentClasses,
          absentClasses: status === "absent" ? currentSub.absentClasses + durationHours : currentSub.absentClasses,
          updatedAt: Date.now(),
        }
      : undefined;

    setSubjects((prev) => {
      const next = prev.map((s) => {
        if (s.id === subjectId) {
          const p = status === "present" ? s.presentClasses + durationHours : s.presentClasses;
          const a = status === "absent" ? s.absentClasses + durationHours : s.absentClasses;
          return { ...s, presentClasses: p, absentClasses: a, updatedAt: Date.now() };
        }
        return s;
      });
      localStorage.setItem("trackx_subjects", JSON.stringify(next));
      return next;
    });

    const newRecord: AttendanceRecord = {
      id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: activeUid,
      subjectId,
      date: recordDate,
      periodNumber,
      status,
      durationHours,
      notes: effectiveNotes,
      createdAt: Date.now(),
    };

    setRecords((prev) => {
      const next = [newRecord, ...prev];
      localStorage.setItem("trackx_records", JSON.stringify(next));
      return next;
    });

    // Save to Server Database
    if (activeUid) {
      apiClient.markAttendance(activeUid, newRecord).catch((e) => console.warn("API record save error:", e));
      try {
        setDoc(doc(db, "users", activeUid, "records", newRecord.id), newRecord).catch(() => {});
        if (updatedSub) {
          setDoc(doc(db, "users", activeUid, "subjects", updatedSub.id), updatedSub, { merge: true }).catch(() => {});
        }
      } catch {}
    }
  };

  const getClassNote = (subjectId: string, date: string | Date, periodNumber?: number): string => {
    const dateKey = typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
    const noteKey = `${dateKey}_${subjectId}_${periodNumber ?? 0}`;
    if (classNotes[noteKey]) return classNotes[noteKey];
    const rec = records.find(
      (r) =>
        r.subjectId === subjectId &&
        r.date.slice(0, 10) === dateKey &&
        (periodNumber !== undefined ? r.periodNumber === periodNumber : true)
    );
    return rec?.notes || "";
  };

  const saveClassNote = async (
    subjectId: string,
    date: string | Date,
    periodNumber: number | undefined,
    notes: string
  ) => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";
    const dateKey = typeof date === "string" ? date.slice(0, 10) : date.toISOString().slice(0, 10);
    const noteKey = `${dateKey}_${subjectId}_${periodNumber ?? 0}`;
    const trimmed = notes.trim();

    setClassNotes((prev) => {
      const next = { ...prev };
      if (trimmed) {
        next[noteKey] = trimmed;
      } else {
        delete next[noteKey];
      }
      localStorage.setItem("trackx_class_notes", JSON.stringify(next));
      return next;
    });

    const targetRec = records.find(
      (r) =>
        r.subjectId === subjectId &&
        r.date.slice(0, 10) === dateKey &&
        (periodNumber !== undefined ? r.periodNumber === periodNumber : true)
    );

    if (targetRec) {
      const updatedRec = { ...targetRec, notes: trimmed || undefined };
      setRecords((prev) => {
        const next = prev.map((r) => (r.id === targetRec.id ? updatedRec : r));
        localStorage.setItem("trackx_records", JSON.stringify(next));
        return next;
      });

      if (activeUid) {
        try {
          setDoc(doc(db, "users", activeUid, "records", targetRec.id), updatedRec, { merge: true }).catch(() => {});
        } catch {}
      }
    }
  };

  const deleteClassNote = async (
    subjectId: string,
    date: string | Date,
    periodNumber: number | undefined
  ) => {
    await saveClassNote(subjectId, date, periodNumber, "");
  };

  const unmarkAttendance = async (
    subjectId: string,
    targetDate?: Date,
    periodNumber?: number,
    durationHours: number = 1
  ) => {
    const targetIso = targetDate ? targetDate.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";

    let removedRecordStatus: "present" | "absent" | undefined;
    let targetRecordId: string | undefined;

    setRecords((prev) => {
      const foundIdx = prev.findIndex(
        (r) =>
          r.subjectId === subjectId &&
          r.date.slice(0, 10) === targetIso &&
          (periodNumber !== undefined ? r.periodNumber === periodNumber : true)
      );

      if (foundIdx >= 0) {
        removedRecordStatus = prev[foundIdx].status;
        targetRecordId = prev[foundIdx].id;
        const next = [...prev];
        next.splice(foundIdx, 1);
        localStorage.setItem("trackx_records", JSON.stringify(next));
        return next;
      }
      return prev;
    });

    const currentSub = subjects.find((s) => s.id === subjectId);
    const updatedSub: Subject | undefined = currentSub && removedRecordStatus
      ? {
          ...currentSub,
          presentClasses: removedRecordStatus === "present" ? Math.max(0, currentSub.presentClasses - durationHours) : currentSub.presentClasses,
          absentClasses: removedRecordStatus === "absent" ? Math.max(0, currentSub.absentClasses - durationHours) : currentSub.absentClasses,
          updatedAt: Date.now(),
        }
      : undefined;

    setSubjects((prev) => {
      const next = prev.map((s) => {
        if (s.id === subjectId && removedRecordStatus) {
          const p = removedRecordStatus === "present" ? Math.max(0, s.presentClasses - durationHours) : s.presentClasses;
          const a = removedRecordStatus === "absent" ? Math.max(0, s.absentClasses - durationHours) : s.absentClasses;
          return { ...s, presentClasses: p, absentClasses: a, updatedAt: Date.now() };
        }
        return s;
      });
      localStorage.setItem("trackx_subjects", JSON.stringify(next));
      return next;
    });

    // Delete in Server Database
    if (activeUid) {
      apiClient.unmarkAttendance(activeUid, subjectId, targetIso, periodNumber, durationHours).catch(() => {});
      try {
        if (targetRecordId) {
          deleteDoc(doc(db, "users", activeUid, "records", targetRecordId)).catch(() => {});
        }
        if (updatedSub) {
          setDoc(doc(db, "users", activeUid, "subjects", updatedSub.id), updatedSub, { merge: true }).catch(() => {});
        }
      } catch {}
    }
  };

  const deleteAttendanceRecord = async (recordId: string) => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";

    let targetRecord: AttendanceRecord | undefined;

    setRecords((prev) => {
      const found = prev.find((r) => r.id === recordId);
      if (found) {
        targetRecord = found;
        const next = prev.filter((r) => r.id !== recordId);
        localStorage.setItem("trackx_records", JSON.stringify(next));
        return next;
      }
      return prev;
    });

    if (!targetRecord) return;

    const duration = targetRecord.durationHours || 1;
    const subId = targetRecord.subjectId;
    const wasPresent = targetRecord.status === "present";
    const wasAbsent = targetRecord.status === "absent";

    const currentSub = subjects.find((s) => s.id === subId);
    const updatedSub: Subject | undefined = currentSub
      ? {
          ...currentSub,
          presentClasses: wasPresent ? Math.max(0, currentSub.presentClasses - duration) : currentSub.presentClasses,
          absentClasses: wasAbsent ? Math.max(0, currentSub.absentClasses - duration) : currentSub.absentClasses,
          updatedAt: Date.now(),
        }
      : undefined;

    setSubjects((prev) => {
      const next = prev.map((s) => {
        if (s.id === subId) {
          const p = wasPresent ? Math.max(0, s.presentClasses - duration) : s.presentClasses;
          const a = wasAbsent ? Math.max(0, s.absentClasses - duration) : s.absentClasses;
          return { ...s, presentClasses: p, absentClasses: a, updatedAt: Date.now() };
        }
        return s;
      });
      localStorage.setItem("trackx_subjects", JSON.stringify(next));
      return next;
    });

    if (activeUid) {
      try {
        deleteDoc(doc(db, "users", activeUid, "records", recordId)).catch(() => {});
        if (updatedSub) {
          setDoc(doc(db, "users", activeUid, "subjects", updatedSub.id), updatedSub, { merge: true }).catch(() => {});
        }
      } catch {}
    }
  };

  const addSubject = async (
    newSub: Omit<Subject, "id" | "userId" | "createdAt" | "updatedAt">
  ): Promise<Subject> => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";

    // Idempotence & Deduplication Guard:
    // If a subject with matching name, code, or acronym already exists, update and return it!
    const existing = findMatchingSubject(newSub, subjects);
    if (existing) {
      const updatedSub: Subject = {
        ...existing,
        ...newSub,
        id: existing.id,
        userId: existing.userId,
        createdAt: existing.createdAt,
        updatedAt: Date.now(),
        presentClasses: newSub.presentClasses !== undefined ? newSub.presentClasses : existing.presentClasses,
        absentClasses: newSub.absentClasses !== undefined ? newSub.absentClasses : existing.absentClasses,
        baselinePercentage: newSub.baselinePercentage !== undefined ? newSub.baselinePercentage : existing.baselinePercentage,
        name: (newSub.name.length > existing.name.length && !/^[A-Z0-9\s]{1,6}$/.test(newSub.name))
          ? newSub.name
          : existing.name,
        code: newSub.code || existing.code,
      };

      setSubjects((prev) => {
        const next = prev.map((s) => (s.id === existing.id ? updatedSub : s));
        localStorage.setItem("trackx_subjects", JSON.stringify(next));
        return next;
      });

      if (activeUid) {
        apiClient.saveSubject(activeUid, updatedSub).catch((e) => console.warn("API updateSubject notice:", e));
        try {
          const firePromise = setDoc(doc(db, "users", activeUid, "subjects", existing.id), updatedSub, { merge: true });
          const timeoutPromise = new Promise<void>((res) => setTimeout(res, 800));
          await Promise.race([firePromise, timeoutPromise]).catch(() => {});
        } catch {}
      }
      return updatedSub;
    }

    const id = `sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const fullSub: Subject = {
      ...newSub,
      id,
      userId: activeUid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setSubjects((prev) => {
      const next = [...prev, fullSub];
      localStorage.setItem("trackx_subjects", JSON.stringify(next));
      return next;
    });

    if (activeUid) {
      apiClient.saveSubject(activeUid, fullSub).catch((e) => console.warn("API addSubject notice:", e));
      try {
        const firePromise = setDoc(doc(db, "users", activeUid, "subjects", id), fullSub);
        const timeoutPromise = new Promise<void>((res) => setTimeout(res, 800));
        await Promise.race([firePromise, timeoutPromise]).catch(() => {});
      } catch {}
    }
    return fullSub;
  };

  const updateSubject = async (id: string, updates: Partial<Subject>) => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";
    const existing = subjects.find((s) => s.id === id);
    const updatedSub: Subject = existing
      ? { ...existing, ...updates, updatedAt: Date.now() }
      : ({ id, userId: activeUid, ...updates, updatedAt: Date.now() } as Subject);

    setSubjects((prev) => {
      const next = prev.map((s) => (s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s));
      localStorage.setItem("trackx_subjects", JSON.stringify(next));
      return next;
    });

    if (activeUid) {
      apiClient.saveSubject(activeUid, updatedSub).catch(() => {});
      try {
        const firePromise = setDoc(doc(db, "users", activeUid, "subjects", id), updatedSub, { merge: true });
        const timeoutPromise = new Promise<void>((res) => setTimeout(res, 800));
        await Promise.race([firePromise, timeoutPromise]).catch(() => {});
      } catch (err) {
        console.warn("Firestore updateSubject error:", err);
      }
    }
  };

  const deleteSubject = async (id: string) => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";

    setSubjects((prev) => {
      const next = prev.filter((s) => s.id !== id);
      localStorage.setItem("trackx_subjects", JSON.stringify(next));
      return next;
    });

    setTimetable((prev) => {
      const next = prev.filter((t) => t.subjectId !== id);
      localStorage.setItem("trackx_timetable", JSON.stringify(next));
      return next;
    });

    setRecords((prev) => {
      const next = prev.filter((r) => r.subjectId !== id);
      localStorage.setItem("trackx_records", JSON.stringify(next));
      return next;
    });

    if (activeUid) {
      apiClient.deleteSubject(activeUid, id).catch(() => {});
      try {
        deleteDoc(doc(db, "users", activeUid, "subjects", id)).catch(() => {});
      } catch {}
    }
  };

  const addTimetableEntry = async (
    entry: Omit<TimetableEntry, "id" | "userId" | "createdAt" | "updatedAt">
  ): Promise<TimetableEntry> => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";
    const id = `tt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const fullEntry: TimetableEntry = {
      ...entry,
      id,
      userId: activeUid,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    setTimetable((prev) => {
      const next = [...prev, fullEntry];
      localStorage.setItem("trackx_timetable", JSON.stringify(next));
      return next;
    });

    if (activeUid) {
      apiClient.saveTimetableEntry(activeUid, fullEntry).catch(() => {});
      try {
        setDoc(doc(db, "users", activeUid, "timetable", id), fullEntry).catch(() => {});
      } catch {}
    }
    return fullEntry;
  };

  const batchSaveTimetable = useCallback(async (entries: TimetableEntry[], replace: boolean = false) => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";
    setTimetable((prev) => {
      let next: TimetableEntry[];
      if (replace) {
        next = [...entries];
      } else {
        next = [...prev];
        entries.forEach((entry) => {
          const idx = next.findIndex(
            (e) =>
              e.id === entry.id ||
              (e.dayOfWeek === entry.dayOfWeek &&
                e.startTime === entry.startTime &&
                e.endTime === entry.endTime &&
                (e.subjectId === entry.subjectId || e.notes === entry.notes))
          );
          if (idx >= 0) next[idx] = entry;
          else next.push(entry);
        });
      }
      localStorage.setItem("trackx_timetable", JSON.stringify(next));
      return next;
    });

    if (activeUid) {
      apiClient.batchSaveTimetable(activeUid, entries, replace).catch(() => {});
      try {
        if (replace) {
          const snap = await getDocs(collection(db, "users", activeUid, "timetable")).catch(() => null);
          const batch = writeBatch(db);
          if (snap && !snap.empty) {
            snap.docs.forEach((d: QueryDocumentSnapshot<DocumentData>) => batch.delete(d.ref));
          }
          entries.forEach((entry) => {
            const docRef = doc(db, "users", activeUid, "timetable", entry.id);
            batch.set(docRef, entry);
          });
          await batch.commit().catch(() => {});
        } else {
          const batch = writeBatch(db);
          entries.forEach((entry) => {
            const docRef = doc(db, "users", activeUid, "timetable", entry.id);
            batch.set(docRef, entry, { merge: true });
          });
          const batchPromise = batch.commit();
          const timeoutPromise = new Promise<void>((res) => setTimeout(res, 1000));
          await Promise.race([batchPromise, timeoutPromise]).catch(() => {});
        }
      } catch (fireErr) {
        console.warn("Firestore batchSaveTimetable note:", fireErr);
      }
    }
  }, [user?.id]);

  const generateTimetableFromSubjects = useCallback(
    async (subjectsToSchedule?: Subject[]) => {
      const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";
      const semId = activeSemester?.id || `sem-${activeUid}`;
      const targetSubjects = (subjectsToSchedule && subjectsToSchedule.length > 0)
        ? subjectsToSchedule
        : subjects;

      if (!targetSubjects || targetSubjects.length === 0) return;

      const standardPeriods = [
        { periodNumber: 1, startTime: 555, endTime: 615 }, // 09:15 - 10:15
        { periodNumber: 2, startTime: 615, endTime: 675 }, // 10:15 - 11:15
        { periodNumber: 3, startTime: 675, endTime: 735 }, // 11:15 - 12:15
        { periodNumber: 4, startTime: 780, endTime: 840 }, // 13:00 - 14:00
        { periodNumber: 5, startTime: 840, endTime: 900 }, // 14:00 - 15:00
      ];

      // Monday through Friday (5 periods each), Saturday (4 periods)
      const days = [1, 2, 3, 4, 5, 6];
      const newEntries: TimetableEntry[] = [];
      let subIdx = 0;

      days.forEach((dayOfWeek) => {
        const periodCount = dayOfWeek === 6 ? 4 : 5;
        const dayPeriods = standardPeriods.slice(0, periodCount);

        dayPeriods.forEach((p, pIdx) => {
          const sub = targetSubjects[(subIdx + pIdx + dayOfWeek) % targetSubjects.length];
          const isLab = sub.type === "Laboratory" || sub.name.toLowerCase().includes("lab");

          newEntries.push({
            id: `tt-${dayOfWeek}-${p.periodNumber}-${sub.id}`,
            userId: activeUid,
            semesterId: semId,
            subjectId: sub.id,
            dayOfWeek,
            periodNumber: p.periodNumber,
            startTime: p.startTime,
            endTime: p.endTime,
            room: isLab ? "Lab 201" : `LH-${(dayOfWeek + p.periodNumber) % 4 + 1}`,
            notes: `${sub.name}${sub.facultyName ? ` (${sub.facultyName})` : ""}`,
            isContinuousLab: false,
            isEnabled: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        });
        subIdx += 2;
      });

      await batchSaveTimetable(newEntries);
    },
    [user?.id, activeSemester?.id, subjects, batchSaveTimetable]
  );

  const updateTimetableEntry = async (id: string, updates: Partial<TimetableEntry>) => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";
    const existing = timetable.find((t) => t.id === id);
    const updatedEntry: TimetableEntry = existing
      ? { ...existing, ...updates, updatedAt: Date.now() }
      : ({ id, userId: activeUid, ...updates, updatedAt: Date.now() } as TimetableEntry);

    setTimetable((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t));
      localStorage.setItem("trackx_timetable", JSON.stringify(next));
      return next;
    });

    if (activeUid) {
      apiClient.saveTimetableEntry(activeUid, updatedEntry).catch(() => {});
      try {
        await setDoc(doc(db, "users", activeUid, "timetable", id), updatedEntry, { merge: true });
      } catch (err) {
        console.warn("Firestore updateTimetableEntry notice:", err);
      }
    }
  };

  const deleteTimetableEntry = async (id: string) => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";
    setTimetable((prev) => {
      const next = prev.filter((t) => t.id !== id);
      localStorage.setItem("trackx_timetable", JSON.stringify(next));
      return next;
    });

    if (activeUid) {
      apiClient.deleteTimetableEntry(activeUid, id).catch(() => {});
      try {
        deleteDoc(doc(db, "users", activeUid, "timetable", id)).catch(() => {});
      } catch {}
    }
  };

  const swapPeriods = async (dayOfWeek: number, periodA: number, periodB: number) => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";
    let entryA: TimetableEntry | undefined;
    let entryB: TimetableEntry | undefined;

    setTimetable((prev) => {
      const copy = [...prev];
      const idxA = copy.findIndex((e) => e.dayOfWeek === dayOfWeek && e.periodNumber === periodA);
      const idxB = copy.findIndex((e) => e.dayOfWeek === dayOfWeek && e.periodNumber === periodB);

      if (idxA >= 0) {
        copy[idxA] = { ...copy[idxA], periodNumber: periodB, updatedAt: Date.now() };
        entryA = copy[idxA];
      }
      if (idxB >= 0) {
        copy[idxB] = { ...copy[idxB], periodNumber: periodA, updatedAt: Date.now() };
        entryB = copy[idxB];
      }

      localStorage.setItem("trackx_timetable", JSON.stringify(copy));
      return copy;
    });

    if (activeUid) {
      const entriesToSave = [entryA, entryB].filter(Boolean) as TimetableEntry[];
      if (entriesToSave.length > 0) {
        await apiClient.batchSaveTimetable(activeUid, entriesToSave);
      }
    }
  };

  const copyDaySchedule = async (fromDay: number, toDay: number) => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";
    const entriesToCopy = timetable.filter((e) => e.dayOfWeek === fromDay);

    const newEntries: TimetableEntry[] = entriesToCopy.map((e) => ({
      ...e,
      id: `tt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      dayOfWeek: toDay,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    setTimetable((prev) => {
      const filtered = prev.filter((e) => e.dayOfWeek !== toDay);
      const next = [...filtered, ...newEntries];
      localStorage.setItem("trackx_timetable", JSON.stringify(next));
      return next;
    });

    if (activeUid) {
      await apiClient.clearDaySchedule(activeUid, toDay);
      await apiClient.batchSaveTimetable(activeUid, newEntries);
    }
  };

  const clearDaySchedule = async (dayOfWeek: number) => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";
    setTimetable((prev) => {
      const next = prev.filter((e) => e.dayOfWeek !== dayOfWeek);
      localStorage.setItem("trackx_timetable", JSON.stringify(next));
      return next;
    });

    if (activeUid) {
      await apiClient.clearDaySchedule(activeUid, dayOfWeek);
    }
  };

  // CGPA Grades
  const addGrade = async (grade: Omit<CourseGradeItem, "id" | "userId">): Promise<CourseGradeItem> => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";
    const newGrade: CourseGradeItem = {
      ...grade,
      id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: activeUid,
      updatedAt: Date.now(),
    };

    setGrades((prev) => {
      const next = [...prev, newGrade];
      localStorage.setItem("trackx_grades", JSON.stringify(next));
      return next;
    });

    if (activeUid) {
      await apiClient.saveGrade(activeUid, newGrade);
    }
    return newGrade;
  };

  const deleteGrade = async (gradeId: string) => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";
    setGrades((prev) => {
      const next = prev.filter((g) => g.id !== gradeId);
      localStorage.setItem("trackx_grades", JSON.stringify(next));
      return next;
    });

    if (activeUid) {
      await apiClient.deleteGrade(activeUid, gradeId);
    }
  };

  // Academic Events
  const addAcademicEvent = async (event: Omit<AcademicEventItem, "id" | "userId">): Promise<AcademicEventItem> => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";
    const newEvent: AcademicEventItem = {
      ...event,
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: activeUid,
      updatedAt: Date.now(),
    };

    setAcademicEvents((prev) => {
      const next = [...prev, newEvent];
      localStorage.setItem("trackx_academic_events", JSON.stringify(next));
      return next;
    });

    if (activeUid) {
      await apiClient.saveEvent(activeUid, newEvent);
    }
    return newEvent;
  };

  const deleteAcademicEvent = async (eventId: string) => {
    const activeUid = auth.currentUser?.uid || user?.id || "usr-guest";
    setAcademicEvents((prev) => {
      const next = prev.filter((e) => e.id !== eventId);
      localStorage.setItem("trackx_academic_events", JSON.stringify(next));
      return next;
    });

    if (activeUid) {
      await apiClient.deleteEvent(activeUid, eventId);
    }
  };

  // Computations
  const { overallMetrics, subjectMetrics } = useMemo(() => {
    let totalAttended = 0;
    let totalConducted = 0;
    const subMap: Record<string, AttendanceMetrics> = {};
    const target = user?.globalTarget || 75;

    subjects.forEach((sub) => {
      const conducted = (sub.presentClasses || 0) + (sub.absentClasses || 0);
      totalAttended += sub.presentClasses || 0;
      totalConducted += conducted;

      subMap[sub.id] = computeMetrics(
        sub.presentClasses || 0,
        conducted,
        sub.targetAttendance || target,
        sub.baselinePercentage
      );
    });

    let overall = computeMetrics(totalAttended, totalConducted, target);
    if (totalConducted === 0 && subjects.length > 0) {
      const subjectsWithBaseline = subjects.filter(
        (s) => s.baselinePercentage !== undefined && s.baselinePercentage !== null
      );
      if (subjectsWithBaseline.length > 0) {
        const avgBaseline =
          subjectsWithBaseline.reduce((acc, s) => acc + (s.baselinePercentage || 0), 0) /
          subjectsWithBaseline.length;
        overall = computeMetrics(0, 0, target, avgBaseline);
      }
    }

    return {
      overallMetrics: overall,
      subjectMetrics: subMap,
    };
  }, [subjects, user?.globalTarget]);

  // Notifications
  const notifications: NotificationItem[] = useMemo(() => {
    const list: NotificationItem[] = [];
    const target = user?.globalTarget || 75;

    subjects.forEach((sub) => {
      const conducted = (sub.presentClasses || 0) + (sub.absentClasses || 0);
      if (conducted > 0) {
        const pct = ((sub.presentClasses || 0) / conducted) * 100;
        const subTarget = sub.targetAttendance || target;
        if (pct < subTarget) {
          const req = Math.ceil((subTarget * conducted - 100 * (sub.presentClasses || 0)) / (100 - subTarget));
          list.push({
            id: `notif-warn-${sub.id}`,
            title: `${sub.name} Attendance Alert`,
            message: `Current attendance is ${pct.toFixed(1)}%, below your ${subTarget}% target. Attend the next ${Math.max(1, req)} sessions consecutively to recover.`,
            type: "warning",
            timestamp: sub.updatedAt || sub.createdAt || 0,
            isRead: readNotifIds.includes(`notif-warn-${sub.id}`),
            actionUrl: `/subjects/${sub.id}`,
          });
        }
      }
    });

    const totalSafe = overallMetrics.safeBunks;
    const totalRecovery = overallMetrics.requiredRecovery;

    if (totalSafe > 0) {
      list.push({
        id: "notif-safe-skips",
        title: "Safe Skip Margin Available",
        message: `You currently have ${totalSafe} total ${totalSafe === 1 ? "class" : "classes"} you can safely skip across your coursework while keeping your standing above ${target}%.`,
        type: "info",
        timestamp: activeSemester?.createdAt || 0,
        isRead: readNotifIds.includes("notif-safe-skips"),
        actionUrl: "/dashboard",
      });
    } else if (totalRecovery > 0) {
      list.push({
        id: "notif-recovery-needed",
        title: "Attendance Recovery Target",
        message: `You need to attend the next ${totalRecovery} consecutive ${totalRecovery === 1 ? "class" : "classes"} across all subjects to reach your overall ${target}% target.`,
        type: "warning",
        timestamp: activeSemester?.createdAt || 0,
        isRead: readNotifIds.includes("notif-recovery-needed"),
        actionUrl: "/dashboard",
      });
    }

    if (timetable.length > 0) {
      list.push({
        id: "notif-schedule-active",
        title: "Timetable Schedule Active",
        message: `You have ${timetable.length} weekly sessions configured in your timetable routine.`,
        type: "reminder",
        timestamp: activeSemester?.createdAt || 0,
        isRead: readNotifIds.includes("notif-schedule-active"),
        actionUrl: "/calendar",
      });
    }

    return list.filter((n) => !dismissedNotifIds.includes(n.id));
  }, [subjects, user?.globalTarget, timetable, activeSemester?.createdAt, readNotifIds, dismissedNotifIds, overallMetrics]);

  const markNotificationAsRead = (id: string) => {
    setReadNotifIds((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      localStorage.setItem("trackx_read_notifs", JSON.stringify(updated));
      return updated;
    });
  };

  const markAllNotificationsAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadNotifIds(allIds);
    localStorage.setItem("trackx_read_notifs", JSON.stringify(allIds));
  };

  const clearAllNotifications = () => {
    const allIds = notifications.map((n) => n.id);
    setDismissedNotifIds(allIds);
    localStorage.setItem("trackx_dismissed_notifs", JSON.stringify(allIds));
  };

  const updateUserProfile = async (updates: Partial<UserProfile>) => {
    const activeUid = auth.currentUser?.uid || user?.id;
    setUser((prev) => {
      const base: UserProfile = prev || {
        id: activeUid || `usr-${Date.now()}`,
        name: "",
        email: auth.currentUser?.email || "",
        branch: "Computer Science & Engineering",
        semester: 1,
        globalTarget: 75.0,
        themeMode: "dark",
        onboardingCompleted: false,
        createdTimestamp: Date.now(),
        updatedTimestamp: Date.now(),
      };
      const updated = { ...base, ...updates, updatedTimestamp: Date.now() };
      localStorage.setItem("trackx_user", JSON.stringify(updated));
      return updated;
    });

    setProfileStatus("loaded");
    if (updates.onboardingCompleted !== undefined || updates.onboardingState !== undefined) {
      const isComp =
        Boolean(updates.onboardingCompleted ?? user?.onboardingCompleted) &&
        (updates.onboardingState ? Boolean(updates.onboardingState.completed) : true);
      setOnboardingStatus(isComp ? "complete" : "incomplete");
    }

    if (activeUid) {
      try {
        const firePromise = setDoc(doc(db, "users", activeUid), { ...updates, updatedTimestamp: Date.now() }, { merge: true });
        const timeoutPromise = new Promise<void>((res) => setTimeout(res, 800));
        await Promise.race([firePromise, timeoutPromise]).catch(() => {});
        setFirestoreStatus("connected");
        setFirestoreErrorMessage(null);
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string };
        console.warn("Firestore updateUserProfile notice:", error?.message);
        if (
          error?.code === "unavailable" ||
          error?.message?.includes("unavailable") ||
          error?.message?.includes("offline")
        ) {
          setFirestoreStatus("unavailable");
          setFirestoreErrorMessage("Could not reach Cloud Firestore backend. Changes saved locally.");
        }
      }
      apiClient.updateProfile(activeUid, updates).catch(() => {});
    }
  };

  const resetToDemoData = () => {
    setSubjects([]);
    setTimetable([]);
    setRecords([]);
    setGrades([]);
    setAcademicEvents([]);
    setClassSubstitutes({});
    setHolidayOverrides({});
    setReadNotifIds([]);
    setDismissedNotifIds([]);
    localStorage.removeItem("trackx_subjects");
    localStorage.removeItem("trackx_timetable");
    localStorage.removeItem("trackx_records");
    localStorage.removeItem("trackx_grades");
    localStorage.removeItem("trackx_academic_events");
    localStorage.removeItem("trackx_substitutes");
    localStorage.removeItem("trackx_holidays");
    localStorage.removeItem("trackx_read_notifs");
    localStorage.removeItem("trackx_dismissed_notifs");
    localStorage.removeItem("trackx_class_notes");
    setClassNotes({});
  };

  return (
    <TrackXContext.Provider
      value={{
        user,
        firebaseUser,
        activeSemester,
        subjects,
        records,
        timetable,
        notifications,
        grades,
        academicEvents,
        theme,
        overallMetrics,
        subjectMetrics,
        isLoading,
        authStatus,
        firestoreStatus,
        profileStatus,
        onboardingStatus,
        firestoreErrorMessage,
        retryFirestoreConnection,
        classSubstitutes,
        holidayOverrides,
        saturdayTimetableOverrides,
        setSaturdayTimetableOverride,
        classNotes,
        getClassNote,
        saveClassNote,
        deleteClassNote,
        setTheme,
        updateGlobalTarget,
        markAttendance,
        unmarkAttendance,
        deleteAttendanceRecord,
        setSubstitute,
        removeSubstitute,
        toggleHolidayOverride,
        resetHolidayOverride,
        addSubject,
        updateSubject,
        deleteSubject,
        addTimetableEntry,
        batchSaveTimetable,
        generateTimetableFromSubjects,
        updateTimetableEntry,
        deleteTimetableEntry,
        swapPeriods,
        copyDaySchedule,
        clearDaySchedule,
        addGrade,
        deleteGrade,
        addAcademicEvent,
        deleteAcademicEvent,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        clearAllNotifications,
        updateUserProfile,
        resetToDemoData,
        logout,
        refreshBackendData,
      }}
    >
      {children}
    </TrackXContext.Provider>
  );
}

export function useTrackX() {
  const context = useContext(TrackXContext);
  if (!context) {
    throw new Error("useTrackX must be used within a TrackXProvider");
  }
  return context;
}
