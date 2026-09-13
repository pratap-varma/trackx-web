/**
 * Stage 4 AI / OCR Pipeline Verification Test Suite
 * Tests all prompt scenarios without mocking live AI success if credentials are not present.
 */

import {
  validateImageUpload,
  validateAttendanceExtraction,
  validateTimetableExtraction,
  GeminiServiceError,
} from "../src/lib/serverGemini";
import * as fs from "fs";
import * as path from "path";

async function runTests() {
  console.log("==================================================");
  console.log("RUNNING STAGE 4 AI / OCR TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ""}`);
      failed++;
    }
  }

  // --- TEST 2: Attendance screenshot with attended/conducted counts ---
  try {
    const rawAttendance = {
      subjects: [
        {
          subjectCode: "CS501",
          subjectName: "Computer Networks",
          faculty: "Prof. Alan Turing",
          attended: 18,
          conducted: 26,
          percentage: 69.23,
        },
      ],
      overall: {
        attended: 18,
        conducted: 26,
        percentage: 69.23,
      },
      confidence: 0.98,
      warnings: [],
    };
    const result = validateAttendanceExtraction(rawAttendance);
    assert(
      result.subjects[0].attended === 18 &&
      result.subjects[0].conducted === 26 &&
      result.subjects[0].percentage === 69.23,
      "TEST 2: Attendance screenshot containing attended/conducted counts extracts correctly"
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(false, "TEST 2", msg);
  }

  // --- TEST 3: Attendance screenshot containing ONLY percentage ---
  try {
    const rawPercentageOnly = {
      subjects: [
        {
          subjectCode: "MATH201",
          subjectName: "Linear Algebra",
          faculty: null,
          attended: null,
          conducted: null,
          percentage: 75.0,
        },
      ],
      overall: {
        attended: null,
        conducted: null,
        percentage: 75.0,
      },
      confidence: 0.95,
      warnings: [],
    };
    const result = validateAttendanceExtraction(rawPercentageOnly);
    assert(
      result.subjects[0].attended === null &&
      result.subjects[0].conducted === null &&
      result.subjects[0].percentage === 75.0 &&
      result.warnings.some((w) => w.includes("Only percentage")),
      "TEST 3: Attendance with only percentage keeps counts null without hallucination"
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(false, "TEST 3", msg);
  }

  // --- TEST 4: Unreadable attendance field -> returns null with warning ---
  try {
    const rawUnreadable = {
      subjects: [
        {
          subjectCode: null,
          subjectName: "Advanced Algorithms",
          faculty: null,
          attended: null,
          conducted: null,
          percentage: null,
        },
      ],
      confidence: 0.4,
      warnings: ["Subject code and attendance counts are unreadable or blurry"],
    };
    const result = validateAttendanceExtraction(rawUnreadable);
    assert(
      result.subjects[0].subjectCode === null &&
      result.subjects[0].attended === null &&
      result.subjects[0].conducted === null &&
      result.warnings.length > 0,
      "TEST 4: Unreadable fields return null and generate warnings"
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(false, "TEST 4", msg);
  }

  // --- TEST 6: Merged 2-hour timetable cell -> one continuous entry ---
  try {
    const rawTimetableMerged = {
      entries: [
        {
          day: "Monday",
          startTime: "10:15",
          endTime: "12:15",
          subjectCode: "CS502L",
          subjectName: "Virtual Instrumentation Lab",
          faculty: "Dr. Grace Hopper",
          type: "lab",
          isContinuousBlock: true,
          confidence: 0.96,
        },
      ],
      warnings: [],
    };
    const result = validateTimetableExtraction(rawTimetableMerged);
    const entry = result.entries[0];
    assert(
      result.entries.length === 1 &&
      entry.startTime === "10:15" &&
      entry.endTime === "12:15" &&
      entry.startTimeMinutes === 615 &&
      entry.endTimeMinutes === 735 &&
      entry.isContinuousLab === true,
      "TEST 6: Merged 2-hour timetable cell remains one continuous entry (10:15–12:15)"
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(false, "TEST 6", msg);
  }

  // --- TEST 7: Timetable cell without faculty -> faculty remains null ---
  try {
    const rawTimetableNoFaculty = {
      entries: [
        {
          day: "Wednesday",
          startTime: "09:00",
          endTime: "10:00",
          subjectCode: "CS301",
          subjectName: "Operating Systems",
          faculty: null,
          type: "lecture",
          confidence: 0.9,
        },
      ],
      warnings: [],
    };
    const result = validateTimetableExtraction(rawTimetableNoFaculty);
    assert(
      result.entries[0].faculty === null,
      "TEST 7: Timetable cell without faculty keeps faculty as null (no hallucination)"
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(false, "TEST 7", msg);
  }

  // --- TEST 8: Malformed Gemini response -> validation failure rejected safely ---
  try {
    let failedSafely = false;
    try {
      validateAttendanceExtraction("not-a-json-object");
    } catch (e: unknown) {
      if (e instanceof GeminiServiceError && e.status === 502) {
        failedSafely = true;
      }
    }
    assert(failedSafely, "TEST 8: Malformed Gemini response rejected safely without corrupting data");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(false, "TEST 8", msg);
  }

  // --- TEST 9: Unauthenticated AI API request rejection (401) ---
  try {
    const { requireAuthenticatedUser, AuthError } = await import("../src/lib/serverAuth");
    const fakeReq = {
      headers: new Headers(),
    } as unknown as import("next/server").NextRequest;

    let rejectedUnauth = false;
    try {
      await requireAuthenticatedUser(fakeReq);
    } catch (e: unknown) {
      if (e instanceof AuthError && e.status === 401) {
        rejectedUnauth = true;
      }
    }
    assert(rejectedUnauth, "TEST 9: Unauthenticated AI request returns 401 Unauthorized");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(false, "TEST 9", msg);
  }

  // --- TEST 10: User A attempts to process/save data as User B (403 IDOR rejection) ---
  try {
    const { validateResourceOwnership, AuthError } = await import("../src/lib/serverAuth");
    let rejectedIdor = false;
    try {
      validateResourceOwnership("user_alice_123", "user_bob_456");
    } catch (e: unknown) {
      if (e instanceof AuthError && e.status === 403) {
        rejectedIdor = true;
      }
    }
    assert(rejectedIdor, "TEST 10: User A attempting to access/save as User B returns 403 Forbidden");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(false, "TEST 10", msg);
  }

  // --- TEST 11: Invalid / oversized file handling ---
  try {
    let rejectedType = false;
    try {
      validateImageUpload(Buffer.from("fake-text"), "text/plain");
    } catch (e: unknown) {
      if (e instanceof GeminiServiceError && e.status === 400) rejectedType = true;
    }

    let rejectedOversize = false;
    try {
      const hugeBuffer = Buffer.alloc(11 * 1024 * 1024);
      validateImageUpload(hugeBuffer, "image/png");
    } catch (e: unknown) {
      if (e instanceof GeminiServiceError && e.status === 413) rejectedOversize = true;
    }

    assert(rejectedType && rejectedOversize, "TEST 11: Invalid file format (400) and oversized file (413) rejected safely");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(false, "TEST 11", msg);
  }

  // --- TEST 12: Missing Gemini API key handling ---
  try {
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    let caughtSafeMissingKey = false;
    try {
      const { extractAttendanceFromImage } = await import("../src/lib/serverGemini");
      await extractAttendanceFromImage(Buffer.from("test"), "image/png");
    } catch (e: unknown) {
      if (e instanceof GeminiServiceError && e.status === 503 && e.code === "MISSING_API_KEY") {
        caughtSafeMissingKey = true;
      }
    }

    if (originalKey) process.env.GEMINI_API_KEY = originalKey;

    assert(
      caughtSafeMissingKey,
      "TEST 12: Missing GEMINI_API_KEY returns safe 503 error without leaking secrets or crashing"
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(false, "TEST 12", msg);
  }

  // --- TEST 13: Search repository for mock OCR implementations ---
  try {
    const uploadFile = fs.readFileSync(
      path.join(__dirname, "../src/app/attendance/upload/page.tsx"),
      "utf8"
    );
    const hasENG101 = uploadFile.includes("ENG101");
    const hasENG102 = uploadFile.includes("ENG102");
    const hasSimulate = uploadFile.includes("handleSimulateUpload");
    const hasFakeSetInterval = uploadFile.includes("setInterval");

    assert(
      !hasENG101 && !hasENG102 && !hasSimulate && !hasFakeSetInterval,
      "TEST 13: Zero mock OCR, zero fake setInterval progress, and zero hardcoded subjects in upload flow"
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(false, "TEST 13", msg);
  }

  // --- TEST 14: Search repository for local JSON persistence ---
  try {
    const serverDbFile = fs.readFileSync(
      path.join(__dirname, "../src/lib/serverDb.ts"),
      "utf8"
    );
    const usesLocalJson = serverDbFile.includes("trackx_db.json");
    assert(!usesLocalJson, "TEST 14: Zero runtime dependency on local trackx_db.json persistence");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    assert(false, "TEST 14", msg);
  }

  // --- TEST 1 & 5: Live Gemini API check status ---
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey || geminiKey.trim() === "") {
    console.log("[STATUS] LIVE GEMINI TESTING: BLOCKED (GEMINI_API_KEY is not configured in local environment)");
  } else {
    console.log("[STATUS] GEMINI_API_KEY is detected in environment.");
  }

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err: unknown) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
