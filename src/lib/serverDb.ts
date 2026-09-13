import crypto from "crypto";
import {
  UserProfile,
  Subject,
  TimetableEntry,
  AttendanceRecord,
  CourseGradeItem,
  AcademicEventItem,
} from "@/types/trackx";
import { getAdminFirestore } from "@/lib/serverAuth";

export interface UserDbEntry extends UserProfile {
  passwordHash?: string;
  salt?: string;
  substitutes?: Record<string, string>;
  holidays?: Record<string, boolean>;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  action:
    | "login"
    | "signup"
    | "attendance_mark"
    | "attendance_delete"
    | "subject_create"
    | "subject_update"
    | "subject_delete"
    | "timetable_update"
    | "ocr_scan"
    | "profile_update";
  details?: Record<string, unknown>;
  timestamp: number;
}

export function isFirestoreConfigured(): boolean {
  if (
    (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.K_SERVICE ||
    process.env.GAE_APPLICATION
  ) {
    return true;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("path");
    const saPath = path.resolve(process.cwd(), "firebase-service-account.json");
    return fs.existsSync(saPath);
  } catch {
    return false;
  }
}

// In-memory operational store fallback solely for offline/dev environments lacking Google ADC
const devMemoryStore = {
  users: new Map<string, UserDbEntry>(),
  subjects: new Map<string, Subject>(),
  timetable: new Map<string, TimetableEntry>(),
  records: new Map<string, AttendanceRecord>(),
  grades: new Map<string, CourseGradeItem>(),
  events: new Map<string, AcademicEventItem>(),
  activityLogs: [] as ActivityLog[],
};

async function safeFirestore<T>(
  op: (db: ReturnType<typeof getAdminFirestore>) => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<T> {
  if (isFirestoreConfigured()) {
    try {
      const db = getAdminFirestore();
      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Firestore operation timed out after 3500ms")), 3500);
      });
      const result = await Promise.race([op(db), timeoutPromise]);
      if (timer) clearTimeout(timer);
      return result;
    } catch (err: unknown) {
      console.warn("Firestore operation warning, falling back to memory store:", err instanceof Error ? err.message : err);
    }
  }
  return fallback();
}

export function sanitizeUser(user: UserDbEntry | null | undefined): UserProfile | null {
  if (!user) return null;
  const safeUser: UserProfile = { ...user };
  delete (safeUser as Partial<UserDbEntry>).passwordHash;
  delete (safeUser as Partial<UserDbEntry>).salt;
  delete (safeUser as Partial<UserDbEntry>).substitutes;
  delete (safeUser as Partial<UserDbEntry>).holidays;
  return safeUser;
}

// Password hashing utilities using Node.js crypto
export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const derived = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(derived, "hex"));
  } catch {
    return false;
  }
}

// ------------------------------------------------------------
// User Profile Operations (Firestore: users/{uid})
// ------------------------------------------------------------

export async function findUserById(id: string): Promise<UserDbEntry | null> {
  if (isFirestoreConfigured()) {
    try {
      const db = getAdminFirestore();
      const docSnap = await db.collection("users").doc(id).get();
      if (docSnap.exists) {
        return docSnap.data() as UserDbEntry;
      }
      return null;
    } catch (err: unknown) {
      console.warn("Firestore findUserById error, falling back to memory:", err instanceof Error ? err.message : err);
    }
  }

  return devMemoryStore.users.get(id) || null;
}

export async function findUserByEmail(email: string): Promise<UserDbEntry | null> {
  const normalized = email.toLowerCase();
  if (isFirestoreConfigured()) {
    try {
      const db = getAdminFirestore();
      const querySnap = await db.collection("users").where("email", "==", normalized).limit(1).get();
      if (!querySnap.empty) {
        return querySnap.docs[0].data() as UserDbEntry;
      }
      return null;
    } catch (err: unknown) {
      console.warn("Firestore findUserByEmail error, falling back to memory:", err instanceof Error ? err.message : err);
    }
  }

  for (const user of devMemoryStore.users.values()) {
    if (user.email.toLowerCase() === normalized) {
      return user;
    }
  }
  return null;
}

export async function upsertUser(user: UserDbEntry): Promise<UserDbEntry> {
  const updatedUser: UserDbEntry = {
    ...user,
    updatedTimestamp: Date.now(),
  };

  if (isFirestoreConfigured()) {
    try {
      const db = getAdminFirestore();
      await db.collection("users").doc(user.id).set(updatedUser, { merge: true });
    } catch (err: unknown) {
      console.warn("Firestore upsertUser error, falling back to memory:", err instanceof Error ? err.message : err);
    }
  }

  devMemoryStore.users.set(user.id, updatedUser);
  return updatedUser;
}

// ------------------------------------------------------------
// Subjects Operations (Firestore: users/{uid}/subjects/{subjectId})
// ------------------------------------------------------------

export async function getUserSubjects(userId: string): Promise<Subject[]> {
  return safeFirestore(
    async (db) => {
      const snap = await db.collection("users").doc(userId).collection("subjects").get();
      if (!snap.empty) {
        return snap.docs.map((d) => d.data() as Subject);
      }
      return [];
    },
    () => Array.from(devMemoryStore.subjects.values()).filter((s) => s.userId === userId)
  );
}

export async function saveSubject(subject: Subject): Promise<Subject> {
  const fullSubject: Subject = {
    ...subject,
    updatedAt: Date.now(),
  };

  await safeFirestore(
    async (db) => {
      await db
        .collection("users")
        .doc(subject.userId)
        .collection("subjects")
        .doc(subject.id)
        .set(fullSubject, { merge: true });
    },
    () => {}
  );

  devMemoryStore.subjects.set(subject.id, fullSubject);
  return fullSubject;
}

export async function removeSubject(userId: string, subjectId: string): Promise<void> {
  await safeFirestore(
    async (db) => {
      const batch = db.batch();

      // 1. Delete subject doc
      const subRef = db.collection("users").doc(userId).collection("subjects").doc(subjectId);
      batch.delete(subRef);

      // 2. Cascade delete timetable slots referencing subject
      const ttSnap = await db.collection("users").doc(userId).collection("timetable").where("subjectId", "==", subjectId).get();
      ttSnap.docs.forEach((doc) => batch.delete(doc.ref));

      // 3. Cascade delete records referencing subject
      const recSnap = await db.collection("users").doc(userId).collection("records").where("subjectId", "==", subjectId).get();
      recSnap.docs.forEach((doc) => batch.delete(doc.ref));

      await batch.commit();
    },
    () => {}
  );

  devMemoryStore.subjects.delete(subjectId);
  for (const [id, entry] of devMemoryStore.timetable.entries()) {
    if (entry.userId === userId && entry.subjectId === subjectId) {
      devMemoryStore.timetable.delete(id);
    }
  }
  for (const [id, rec] of devMemoryStore.records.entries()) {
    if (rec.userId === userId && rec.subjectId === subjectId) {
      devMemoryStore.records.delete(id);
    }
  }
}

// ------------------------------------------------------------
// Timetable Operations (Firestore: users/{uid}/timetable/{entryId})
// ------------------------------------------------------------

export async function getUserTimetable(userId: string): Promise<TimetableEntry[]> {
  const result = await safeFirestore(
    async (db) => {
      const snap = await db.collection("users").doc(userId).collection("timetable").get();
      if (!snap.empty) {
        return snap.docs.map((d) => d.data() as TimetableEntry);
      }
      return null;
    },
    () => null
  );

  if (result && result.length > 0) return result;

  const existing = Array.from(devMemoryStore.timetable.values()).filter((t) => t.userId === userId);
  if (existing.length > 0) return existing;

  // Resilient fallback: If server memory restarted, auto-reconstruct weekly timetable from user's subjects
  const userSubjects = Array.from(devMemoryStore.subjects.values()).filter((s) => s.userId === userId);
  if (userSubjects.length > 0) {
    const standardPeriods = [
      { periodNumber: 1, startTime: 555, endTime: 615 },
      { periodNumber: 2, startTime: 615, endTime: 675 },
      { periodNumber: 3, startTime: 675, endTime: 735 },
      { periodNumber: 4, startTime: 780, endTime: 840 },
      { periodNumber: 5, startTime: 840, endTime: 900 },
    ];
    const generated: TimetableEntry[] = [];
    let subIdx = 0;
    [1, 2, 3, 4, 5, 6].forEach((dayOfWeek) => {
      const pCount = dayOfWeek === 6 ? 4 : 5;
      standardPeriods.slice(0, pCount).forEach((p, pIdx) => {
        const sub = userSubjects[(subIdx + pIdx + dayOfWeek) % userSubjects.length];
        const isLab = sub.type === "Laboratory" || sub.name.toLowerCase().includes("lab");
        const entry: TimetableEntry = {
          id: `tt-sdb-${dayOfWeek}-${p.periodNumber}-${sub.id}`,
          userId,
          semesterId: sub.semesterId || `sem-${userId}`,
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
        };
        devMemoryStore.timetable.set(entry.id, entry);
        generated.push(entry);
      });
      subIdx += 2;
    });
    return generated;
  }

  return [];
}

export async function saveTimetableEntry(entry: TimetableEntry): Promise<TimetableEntry> {
  const fullEntry: TimetableEntry = {
    ...entry,
    updatedAt: Date.now(),
  };

  await safeFirestore(
    async (db) => {
      await db
        .collection("users")
        .doc(entry.userId)
        .collection("timetable")
        .doc(entry.id)
        .set(fullEntry, { merge: true });
    },
    () => {}
  );

  devMemoryStore.timetable.set(entry.id, fullEntry);
  return fullEntry;
}

export async function batchSaveTimetableEntries(userId: string, entries: TimetableEntry[]): Promise<void> {
  const now = Date.now();
  await safeFirestore(
    async (db) => {
      const batch = db.batch();
      entries.forEach((entry) => {
        const fullEntry = { ...entry, userId, updatedAt: now };
        const ref = db.collection("users").doc(userId).collection("timetable").doc(entry.id);
        batch.set(ref, fullEntry, { merge: true });
        devMemoryStore.timetable.set(entry.id, fullEntry);
      });
      await batch.commit();
    },
    () => {}
  );

  entries.forEach((entry) => {
    devMemoryStore.timetable.set(entry.id, { ...entry, userId, updatedAt: now });
  });
}

export async function replaceUserTimetableEntries(userId: string, entries: TimetableEntry[]): Promise<void> {
  const now = Date.now();
  await safeFirestore(
    async (db) => {
      const existingSnap = await db.collection("users").doc(userId).collection("timetable").get();
      const batch = db.batch();

      // Delete all existing user timetable entries
      existingSnap.docs.forEach((d) => {
        batch.delete(d.ref);
      });

      // Write new sanitized entries
      entries.forEach((entry) => {
        const fullEntry = { ...entry, userId, updatedAt: now };
        const ref = db.collection("users").doc(userId).collection("timetable").doc(entry.id);
        batch.set(ref, fullEntry);
      });

      await batch.commit();
    },
    () => {}
  );

  // Fallback memory store update
  for (const [id, entry] of Array.from(devMemoryStore.timetable.entries())) {
    if (entry.userId === userId) {
      devMemoryStore.timetable.delete(id);
    }
  }
  entries.forEach((entry) => {
    devMemoryStore.timetable.set(entry.id, { ...entry, userId, updatedAt: now });
  });
}

export async function removeTimetableEntry(userId: string, entryId: string): Promise<void> {
  await safeFirestore(
    async (db) => {
      await db.collection("users").doc(userId).collection("timetable").doc(entryId).delete();
    },
    () => {}
  );

  devMemoryStore.timetable.delete(entryId);
}

export async function clearDayScheduleInDb(userId: string, dayOfWeek: number): Promise<void> {
  await safeFirestore(
    async (db) => {
      const snap = await db.collection("users").doc(userId).collection("timetable").where("dayOfWeek", "==", dayOfWeek).get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    },
    () => {}
  );

  for (const [id, entry] of devMemoryStore.timetable.entries()) {
    if (entry.userId === userId && entry.dayOfWeek === dayOfWeek) {
      devMemoryStore.timetable.delete(id);
    }
  }
}

// ------------------------------------------------------------
// Attendance Records Operations (Firestore: users/{uid}/records/{recordId})
// With Atomic Transactions to maintain Subject present/absent counts
// ------------------------------------------------------------

export async function getUserRecords(userId: string): Promise<AttendanceRecord[]> {
  return safeFirestore(
    async (db) => {
      const snap = await db.collection("users").doc(userId).collection("records").get();
      if (!snap.empty) {
        return snap.docs.map((d) => d.data() as AttendanceRecord);
      }
      return [];
    },
    () => Array.from(devMemoryStore.records.values()).filter((r) => r.userId === userId)
  );
}

export async function addAttendanceRecord(record: AttendanceRecord): Promise<void> {
  const userId = record.userId;
  const duration = record.durationHours || 1;
  const recordDateDay = record.date.slice(0, 10);

  let firestoreSucceeded = false;
  if (isFirestoreConfigured()) {
    try {
      const db = getAdminFirestore();
      const userRef = db.collection("users").doc(userId);
      const subRef = userRef.collection("subjects").doc(record.subjectId);
      const newRecordRef = userRef.collection("records").doc(record.id);

      await db.runTransaction(async (transaction) => {
        // 1. Check for existing record for same subject, date day, and period
        let query = userRef
          .collection("records")
          .where("subjectId", "==", record.subjectId)
          .where("date", ">=", `${recordDateDay}T00:00:00.000Z`)
          .where("date", "<=", `${recordDateDay}T23:59:59.999Z`);

        if (record.periodNumber !== undefined) {
          query = query.where("periodNumber", "==", record.periodNumber);
        }

        const existingSnap = await transaction.get(query);
        let prevStatus: "present" | "absent" | null = null;
        let prevDuration = 0;
        let existingDocRef: FirebaseFirestore.DocumentReference | null = null;

        if (!existingSnap.empty) {
          const prevDoc = existingSnap.docs[0];
          const prevData = prevDoc.data() as AttendanceRecord;
          prevStatus = prevData.status;
          prevDuration = prevData.durationHours || 1;
          existingDocRef = prevDoc.ref;
        }

        // 2. Read Subject document
        const subSnap = await transaction.get(subRef);
        if (subSnap.exists) {
          const subData = subSnap.data() as Subject;
          let present = subData.presentClasses || 0;
          let absent = subData.absentClasses || 0;

          // Revert previous if overwriting
          if (prevStatus === "present") present = Math.max(0, present - prevDuration);
          if (prevStatus === "absent") absent = Math.max(0, absent - prevDuration);

          // Apply new status
          if (record.status === "present") present += duration;
          if (record.status === "absent") absent += duration;

          transaction.update(subRef, {
            presentClasses: present,
            absentClasses: absent,
            updatedAt: Date.now(),
          });
        }

        // 3. Remove old duplicate doc if changing ID
        if (existingDocRef && existingDocRef.id !== record.id) {
          transaction.delete(existingDocRef);
        }

        // 4. Save new attendance record
        transaction.set(newRecordRef, { ...record, updatedAt: Date.now() });
      });
      firestoreSucceeded = true;
    } catch (err: unknown) {
      console.warn("Firestore addAttendanceRecord warning, falling back to memory:", err instanceof Error ? err.message : err);
    }
  }

  // Memory store update
  devMemoryStore.records.set(record.id, record);
  if (!firestoreSucceeded) {
    const sub = devMemoryStore.subjects.get(record.subjectId);
    if (sub) {
      if (record.status === "present") sub.presentClasses = (sub.presentClasses || 0) + duration;
      else sub.absentClasses = (sub.absentClasses || 0) + duration;
      sub.updatedAt = Date.now();
    }
  }
}

export async function removeAttendanceRecord(
  userId: string,
  subjectId: string,
  targetDateIso: string,
  periodNumber?: number,
  durationHours: number = 1
): Promise<void> {
  const targetDay = targetDateIso.slice(0, 10);
  let firestoreSucceeded = false;

  if (isFirestoreConfigured()) {
    try {
      const db = getAdminFirestore();
      const userRef = db.collection("users").doc(userId);
      const subRef = userRef.collection("subjects").doc(subjectId);

      await db.runTransaction(async (transaction) => {
        let query = userRef
          .collection("records")
          .where("subjectId", "==", subjectId)
          .where("date", ">=", `${targetDay}T00:00:00.000Z`)
          .where("date", "<=", `${targetDay}T23:59:59.999Z`);

        if (periodNumber !== undefined) {
          query = query.where("periodNumber", "==", periodNumber);
        }

        const snap = await transaction.get(query);
        if (!snap.empty) {
          const docToDelete = snap.docs[0];
          const recordData = docToDelete.data() as AttendanceRecord;
          const dur = recordData.durationHours || durationHours;

          const subSnap = await transaction.get(subRef);
          if (subSnap.exists) {
            const subData = subSnap.data() as Subject;
            let present = subData.presentClasses || 0;
            let absent = subData.absentClasses || 0;

            if (recordData.status === "present") present = Math.max(0, present - dur);
            if (recordData.status === "absent") absent = Math.max(0, absent - dur);

            transaction.update(subRef, {
              presentClasses: present,
              absentClasses: absent,
              updatedAt: Date.now(),
            });
          }

          transaction.delete(docToDelete.ref);
        }
      });
      firestoreSucceeded = true;
    } catch (err: unknown) {
      console.warn("Firestore removeAttendanceRecord warning, falling back to memory:", err instanceof Error ? err.message : err);
    }
  }

  for (const [id, r] of devMemoryStore.records.entries()) {
    if (
      r.userId === userId &&
      r.subjectId === subjectId &&
      r.date.slice(0, 10) === targetDay &&
      (periodNumber !== undefined ? r.periodNumber === periodNumber : true)
    ) {
      devMemoryStore.records.delete(id);
      if (!firestoreSucceeded) {
        const sub = devMemoryStore.subjects.get(subjectId);
        if (sub) {
          if (r.status === "present") sub.presentClasses = Math.max(0, (sub.presentClasses || 0) - durationHours);
          else sub.absentClasses = Math.max(0, (sub.absentClasses || 0) - durationHours);
          sub.updatedAt = Date.now();
        }
      }
    }
  }
}

// ------------------------------------------------------------
// CGPA Grades Operations (Firestore: users/{uid}/grades/{gradeId})
// ------------------------------------------------------------

export async function getUserGrades(userId: string): Promise<CourseGradeItem[]> {
  return safeFirestore(
    async (db) => {
      const snap = await db.collection("users").doc(userId).collection("grades").get();
      if (!snap.empty) {
        return snap.docs.map((d) => d.data() as CourseGradeItem);
      }
      return [];
    },
    () => Array.from(devMemoryStore.grades.values()).filter((g) => g.userId === userId)
  );
}

export async function saveUserGrade(userId: string, grade: CourseGradeItem): Promise<CourseGradeItem> {
  const fullGrade: CourseGradeItem = {
    ...grade,
    userId,
    updatedAt: Date.now(),
  };

  await safeFirestore(
    async (db) => {
      await db
        .collection("users")
        .doc(userId)
        .collection("grades")
        .doc(grade.id)
        .set(fullGrade, { merge: true });
    },
    () => {}
  );

  devMemoryStore.grades.set(grade.id, fullGrade);
  return fullGrade;
}

export async function removeUserGrade(userId: string, gradeId: string): Promise<void> {
  await safeFirestore(
    async (db) => {
      await db.collection("users").doc(userId).collection("grades").doc(gradeId).delete();
    },
    () => {}
  );

  devMemoryStore.grades.delete(gradeId);
}

// ------------------------------------------------------------
// Academic Events Operations (Firestore: users/{uid}/events/{eventId})
// ------------------------------------------------------------

export async function getUserEvents(userId: string): Promise<AcademicEventItem[]> {
  return safeFirestore(
    async (db) => {
      const snap = await db.collection("users").doc(userId).collection("events").get();
      if (!snap.empty) {
        return snap.docs.map((d) => d.data() as AcademicEventItem);
      }
      return [];
    },
    () => Array.from(devMemoryStore.events.values()).filter((e) => e.userId === userId)
  );
}

export async function saveUserEvent(userId: string, event: AcademicEventItem): Promise<AcademicEventItem> {
  const fullEvent: AcademicEventItem = {
    ...event,
    userId,
    updatedAt: Date.now(),
  };

  await safeFirestore(
    async (db) => {
      await db
        .collection("users")
        .doc(userId)
        .collection("events")
        .doc(event.id)
        .set(fullEvent, { merge: true });
    },
    () => {}
  );

  devMemoryStore.events.set(event.id, fullEvent);
  return fullEvent;
}

export async function removeUserEvent(userId: string, eventId: string): Promise<void> {
  await safeFirestore(
    async (db) => {
      await db.collection("users").doc(userId).collection("events").doc(eventId).delete();
    },
    () => {}
  );

  devMemoryStore.events.delete(eventId);
}

// ------------------------------------------------------------
// Substitutes & Holidays (Firestore: users/{uid} document fields)
// ------------------------------------------------------------

export async function getUserSubstitutes(userId: string): Promise<Record<string, string>> {
  return safeFirestore(
    async (db) => {
      const docSnap = await db.collection("users").doc(userId).get();
      if (docSnap.exists) {
        return (docSnap.data()?.substitutes as Record<string, string>) || {};
      }
      return {};
    },
    () => devMemoryStore.users.get(userId)?.substitutes || {}
  );
}

export async function setUserSubstitute(userId: string, swapKey: string, subjectId: string): Promise<void> {
  await safeFirestore(
    async (db) => {
      await db
        .collection("users")
        .doc(userId)
        .set(
          {
            substitutes: { [swapKey]: subjectId },
            updatedTimestamp: Date.now(),
          },
          { merge: true }
        );
    },
    () => {}
  );

  const existing = devMemoryStore.users.get(userId);
  if (existing) {
    existing.substitutes = { ...(existing.substitutes || {}), [swapKey]: subjectId };
  }
}

export async function removeUserSubstitute(userId: string, swapKey: string): Promise<void> {
  await safeFirestore(
    async (db) => {
      const docSnap = await db.collection("users").doc(userId).get();
      if (docSnap.exists) {
        const substitutes = (docSnap.data()?.substitutes as Record<string, string>) || {};
        delete substitutes[swapKey];
        await db.collection("users").doc(userId).update({ substitutes, updatedTimestamp: Date.now() });
      }
    },
    () => {}
  );

  const existing = devMemoryStore.users.get(userId);
  if (existing?.substitutes) {
    delete existing.substitutes[swapKey];
  }
}

export async function getUserHolidays(userId: string): Promise<Record<string, boolean>> {
  return safeFirestore(
    async (db) => {
      const docSnap = await db.collection("users").doc(userId).get();
      if (docSnap.exists) {
        return (docSnap.data()?.holidays as Record<string, boolean>) || {};
      }
      return {};
    },
    () => devMemoryStore.users.get(userId)?.holidays || {}
  );
}

export async function toggleUserHoliday(
  userId: string,
  dateKey: string,
  explicitValue?: boolean
): Promise<Record<string, boolean>> {
  const result = await safeFirestore(
    async (db) => {
      const docSnap = await db.collection("users").doc(userId).get();
      let holidays: Record<string, boolean> = {};
      if (docSnap.exists) {
        holidays = (docSnap.data()?.holidays as Record<string, boolean>) || {};
      }
      holidays[dateKey] = explicitValue !== undefined ? explicitValue : !holidays[dateKey];
      await db.collection("users").doc(userId).set({ holidays, updatedTimestamp: Date.now() }, { merge: true });
      return holidays;
    },
    () => null
  );

  if (result !== null) return result;

  const existing = devMemoryStore.users.get(userId);
  if (existing) {
    existing.holidays = existing.holidays || {};
    existing.holidays[dateKey] = explicitValue !== undefined ? explicitValue : !existing.holidays[dateKey];
    return existing.holidays;
  }
  return { [dateKey]: explicitValue !== undefined ? explicitValue : true };
}

export async function resetUserHoliday(
  userId: string,
  dateKey: string
): Promise<Record<string, boolean>> {
  const result = await safeFirestore(
    async (db) => {
      const docSnap = await db.collection("users").doc(userId).get();
      let holidays: Record<string, boolean> = {};
      if (docSnap.exists) {
        holidays = (docSnap.data()?.holidays as Record<string, boolean>) || {};
      }
      delete holidays[dateKey];
      await db.collection("users").doc(userId).set({ holidays, updatedTimestamp: Date.now() }, { merge: true });
      return holidays;
    },
    () => null
  );

  if (result !== null) return result;

  const existing = devMemoryStore.users.get(userId);
  if (existing && existing.holidays) {
    delete existing.holidays[dateKey];
    return existing.holidays;
  }
  return {};
}

// ------------------------------------------------------------
// Activity Logging & Admin Operations
// ------------------------------------------------------------

export async function logUserActivity(params: {
  userId: string;
  userEmail?: string;
  userName?: string;
  action: ActivityLog["action"];
  details?: Record<string, unknown>;
}): Promise<ActivityLog> {
  let email = params.userEmail || "";
  let name = params.userName || "";

  if (!email || !name) {
    try {
      const user = await findUserById(params.userId);
      if (user) {
        if (!email) email = user.email || "";
        if (!name) name = user.name || "";
      }
    } catch {
      // ignore user lookup failure
    }
  }

  const entry: ActivityLog = {
    id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId: params.userId,
    userEmail: email,
    userName: name || "Student",
    action: params.action,
    details: params.details || {},
    timestamp: Date.now(),
  };

  await safeFirestore(
    async (db) => {
      await db.collection("activity_logs").doc(entry.id).set(entry);
    },
    () => {}
  );

  devMemoryStore.activityLogs.unshift(entry);
  if (devMemoryStore.activityLogs.length > 2000) {
    devMemoryStore.activityLogs.pop();
  }

  return entry;
}

export async function getRecentActivityLogs(limitCount = 100, userId?: string): Promise<ActivityLog[]> {
  return safeFirestore(
    async (db) => {
      let query: FirebaseFirestore.Query = db.collection("activity_logs");
      if (userId) {
        query = query.where("userId", "==", userId);
      }
      query = query.orderBy("timestamp", "desc").limit(limitCount);
      const snap = await query.get();
      return snap.docs.map((doc) => doc.data() as ActivityLog);
    },
    () => {
      let filtered = devMemoryStore.activityLogs;
      if (userId) {
        filtered = filtered.filter((a) => a.userId === userId);
      }
      return filtered.slice(0, limitCount);
    }
  );
}

export async function getAllUsersAdmin(): Promise<
  Array<UserProfile & { subjectsCount: number; attendanceCount: number; lastActiveTimestamp: number }>
> {
  return safeFirestore(
    async (db) => {
      const snap = await db.collection("users").get();
      const users: Array<UserProfile & { subjectsCount: number; attendanceCount: number; lastActiveTimestamp: number }> = [];

      for (const doc of snap.docs) {
        const u = doc.data() as UserDbEntry;
        const sanitized = sanitizeUser(u);
        if (!sanitized) continue;

        const [subSnap, recSnap] = await Promise.all([
          doc.ref.collection("subjects").get().catch(() => ({ size: 0 })),
          doc.ref.collection("records").get().catch(() => ({ size: 0 })),
        ]);

        users.push({
          ...sanitized,
          subjectsCount: subSnap.size,
          attendanceCount: recSnap.size,
          lastActiveTimestamp: u.updatedTimestamp || u.createdTimestamp || Date.now(),
        });
      }

      return users.sort((a, b) => (b.lastActiveTimestamp || 0) - (a.lastActiveTimestamp || 0));
    },
    () => {
      return Array.from(devMemoryStore.users.values()).map((u) => {
        const sanitized = sanitizeUser(u)!;
        const subjectsCount = Array.from(devMemoryStore.subjects.values()).filter((s) => s.userId === u.id).length;
        const attendanceCount = Array.from(devMemoryStore.records.values()).filter((r) => r.userId === u.id).length;
        return {
          ...sanitized,
          subjectsCount,
          attendanceCount,
          lastActiveTimestamp: u.updatedTimestamp || u.createdTimestamp || Date.now(),
        };
      });
    }
  );
}

export async function getUserDeepDiveAdmin(userId: string): Promise<{
  user: UserProfile | null;
  subjects: Subject[];
  timetable: TimetableEntry[];
  records: AttendanceRecord[];
  activities: ActivityLog[];
}> {
  const [user, subjects, timetable, records, activities] = await Promise.all([
    findUserById(userId).then(sanitizeUser),
    getUserSubjects(userId),
    getUserTimetable(userId),
    getUserRecords(userId),
    getRecentActivityLogs(50, userId),
  ]);

  return { user, subjects, timetable, records, activities };
}

export async function updateUserAdmin(userId: string, updates: Partial<UserDbEntry>): Promise<UserProfile> {
  const existing = await findUserById(userId);
  if (!existing) throw new Error("User not found");

  const safeUpdates = { ...updates };
  delete safeUpdates.passwordHash;
  delete safeUpdates.salt;
  delete safeUpdates.id;

  const merged: UserDbEntry = {
    ...existing,
    ...safeUpdates,
    updatedTimestamp: Date.now(),
  };

  const saved = await upsertUser(merged);
  return sanitizeUser(saved)!;
}

export async function deleteUserAdmin(userId: string): Promise<void> {
  await safeFirestore(
    async (db) => {
      const userRef = db.collection("users").doc(userId);

      const subcollections = ["subjects", "records", "timetable", "grades", "events"];
      for (const collName of subcollections) {
        const snap = await userRef.collection(collName).get();
        if (!snap.empty) {
          const batch = db.batch();
          snap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }

      await userRef.delete();
    },
    () => {
      devMemoryStore.users.delete(userId);
      for (const [key, s] of devMemoryStore.subjects.entries()) {
        if (s.userId === userId) devMemoryStore.subjects.delete(key);
      }
      for (const [key, r] of devMemoryStore.records.entries()) {
        if (r.userId === userId) devMemoryStore.records.delete(key);
      }
      for (const [key, t] of devMemoryStore.timetable.entries()) {
        if (t.userId === userId) devMemoryStore.timetable.delete(key);
      }
    }
  );
}

export async function clearUserStudentData(userId: string): Promise<void> {
  await safeFirestore(
    async (db) => {
      const userRef = db.collection("users").doc(userId);
      const subcollections = ["subjects", "records", "timetable", "grades", "events"];
      for (const collName of subcollections) {
        const snap = await userRef.collection(collName).get();
        if (!snap.empty) {
          const batch = db.batch();
          snap.docs.forEach((doc) => batch.delete(doc.ref));
          await batch.commit();
        }
      }
    },
    () => {
      for (const [key, s] of devMemoryStore.subjects.entries()) {
        if (s.userId === userId) devMemoryStore.subjects.delete(key);
      }
      for (const [key, r] of devMemoryStore.records.entries()) {
        if (r.userId === userId) devMemoryStore.records.delete(key);
      }
      for (const [key, t] of devMemoryStore.timetable.entries()) {
        if (t.userId === userId) devMemoryStore.timetable.delete(key);
      }
    }
  );
}


