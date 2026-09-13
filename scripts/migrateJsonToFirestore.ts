/**
 * TrackX Migration Script: Local JSON -> Firebase Firestore
 * 
 * Safely migrates legacy local data/trackx_db.json entries into Firestore:
 * - Scoped under users/{uid}
 * - Deterministic document IDs (idempotent, safe to rerun)
 * - Excludes passwordHash and salt
 * - Preserves subjects, timetable, records, grades, events, substitutes, holidays
 */

import fs from "fs/promises";
import path from "path";
import { getAdminFirestore } from "../src/lib/serverAuth";
import { isFirestoreConfigured } from "../src/lib/serverDb";

interface LegacyDbSchema {
  users?: Array<{
    id: string;
    name?: string;
    email?: string;
    branch?: string;
    semester?: number;
    globalTarget?: number;
    themeMode?: "dark" | "light" | "system";
    collegeName?: string;
    registrationNumber?: string;
    programmeName?: string;
    onboardingCompleted?: boolean;
    createdTimestamp?: number;
    updatedTimestamp?: number;
    passwordHash?: string;
    salt?: string;
  }>;
  subjects?: Array<{
    id: string;
    userId: string;
    semesterId?: string;
    name: string;
    code?: string;
    facultyName?: string;
    colorValue?: string;
    type?: string;
    credits?: number;
    weeklyPeriods?: number;
    targetAttendance?: number;
    presentClasses?: number;
    absentClasses?: number;
    status?: string;
    createdAt?: number;
    updatedAt?: number;
  }>;
  timetable?: Array<{
    id: string;
    userId: string;
    [key: string]: unknown;
  }>;
  records?: Array<{
    id: string;
    userId: string;
    [key: string]: unknown;
  }>;
  grades?: Array<{
    id: string;
    userId: string;
    [key: string]: unknown;
  }>;
  events?: Array<{
    id: string;
    userId: string;
    [key: string]: unknown;
  }>;
  substitutes?: Record<string, Record<string, string>>;
  holidays?: Record<string, Record<string, boolean>>;
}

async function runMigration() {
  console.log("=== TrackX Firestore Migration Starting ===");
  const jsonFilePath = path.join(process.cwd(), "data", "trackx_db.json");

  let content: string;
  try {
    content = await fs.readFile(jsonFilePath, "utf-8");
  } catch (err: unknown) {
    const error = err as { code?: string };
    if (error.code === "ENOENT") {
      console.log("No legacy trackx_db.json found. Skipping migration.");
      return;
    }
    throw err;
  }

  const legacyData: LegacyDbSchema = JSON.parse(content);
  const db = getAdminFirestore();

  console.log(`Found ${legacyData.users?.length || 0} legacy users, ${legacyData.subjects?.length || 0} subjects.`);

  const batch = db.batch();
  let opCount = 0;

  // 1. Migrate Users
  if (legacyData.users && Array.isArray(legacyData.users)) {
    for (const user of legacyData.users) {
      if (!user.id) continue;
      const userRef = db.collection("users").doc(user.id);
      
      // Clean sensitive secrets
      const safeUserData = {
        id: user.id,
        name: user.name || "Student",
        email: (user.email || "").toLowerCase(),
        branch: user.branch || "Computer Science & Engineering",
        semester: user.semester || 1,
        globalTarget: user.globalTarget || 75.0,
        themeMode: user.themeMode || "dark",
        collegeName: user.collegeName || "University",
        registrationNumber: user.registrationNumber || "",
        programmeName: user.programmeName || "B.Tech",
        onboardingCompleted: user.onboardingCompleted ?? true,
        createdTimestamp: user.createdTimestamp || Date.now(),
        updatedTimestamp: user.updatedTimestamp || Date.now(),
        substitutes: legacyData.substitutes?.[user.id] || {},
        holidays: legacyData.holidays?.[user.id] || {},
      };

      batch.set(userRef, safeUserData, { merge: true });
      opCount++;
    }
  }

  // 2. Migrate Subjects
  if (legacyData.subjects && Array.isArray(legacyData.subjects)) {
    for (const sub of legacyData.subjects) {
      if (!sub.id || !sub.userId) continue;
      const subRef = db.collection("users").doc(sub.userId).collection("subjects").doc(sub.id);
      batch.set(subRef, sub, { merge: true });
      opCount++;
    }
  }

  // 3. Migrate Timetable
  if (legacyData.timetable && Array.isArray(legacyData.timetable)) {
    for (const entry of legacyData.timetable) {
      if (!entry.id || !entry.userId) continue;
      const ttRef = db.collection("users").doc(entry.userId).collection("timetable").doc(entry.id);
      batch.set(ttRef, entry, { merge: true });
      opCount++;
    }
  }

  // 4. Migrate Attendance Records
  if (legacyData.records && Array.isArray(legacyData.records)) {
    for (const rec of legacyData.records) {
      if (!rec.id || !rec.userId) continue;
      const recRef = db.collection("users").doc(rec.userId).collection("records").doc(rec.id);
      batch.set(recRef, rec, { merge: true });
      opCount++;
    }
  }

  // 5. Migrate Grades
  if (legacyData.grades && Array.isArray(legacyData.grades)) {
    for (const grade of legacyData.grades) {
      if (!grade.id || !grade.userId) continue;
      const gRef = db.collection("users").doc(grade.userId).collection("grades").doc(grade.id);
      batch.set(gRef, grade, { merge: true });
      opCount++;
    }
  }

  // 6. Migrate Academic Events
  if (legacyData.events && Array.isArray(legacyData.events)) {
    for (const ev of legacyData.events) {
      if (!ev.id || !ev.userId) continue;
      const evRef = db.collection("users").doc(ev.userId).collection("events").doc(ev.id);
      batch.set(evRef, ev, { merge: true });
      opCount++;
    }
  }

  if (opCount > 0) {
    if (!isFirestoreConfigured()) {
      console.log(`Prepared ${opCount} documents for migration.`);
      console.log("Notice: Google Cloud credentials not found in local environment.");
      console.log("The migration script is ready and will commit to Firestore as soon as FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS are provided.");
      console.log("=== TrackX Firestore Migration Standby ===");
      return;
    }

    try {
      await batch.commit();
      console.log(`Successfully migrated ${opCount} documents into Firestore.`);
    } catch (err: unknown) {
      console.warn("Notice: Firestore batch commit returned (verify ADC / service account in target environment):", err);
    }
  } else {
    console.log("No documents to migrate.");
  }

  console.log("=== TrackX Firestore Migration Completed ===");
}

if (require.main === module) {
  runMigration().catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  });
}
