import { GoogleGenAI, Type, Schema } from "@google/genai";
import { execSync } from "child_process";

/**
 * Standardized pipeline stages for error diagnostics
 */
export type GeminiPipelineStage =
  | "IMAGE_VALIDATION"
  | "INITIALIZATION"
  | "GEMINI_REQUEST"
  | "OUTPUT_PARSING"
  | "OUTPUT_VALIDATION";

/**
 * Standardized error class for Gemini AI operations
 */
export class GeminiServiceError extends Error {
  status: number;
  code: string;
  stage: GeminiPipelineStage;

  constructor(
    message: string,
    status: number = 500,
    code: string = "AI_ERROR",
    stage: GeminiPipelineStage = "GEMINI_REQUEST"
  ) {
    super(message);
    this.name = "GeminiServiceError";
    this.status = status;
    this.code = code;
    this.stage = stage;
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      stage: this.stage,
    };
  }
}

// Supported upload mime types
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Primary and fallback model identifiers
 */
export const PRIMARY_GEMINI_MODEL = "gemini-3.5-flash";
export const FALLBACK_GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
];

/**
 * Validates image upload parameters
 */
export function validateImageUpload(buffer: Buffer, mimeType: string): void {
  if (!buffer || buffer.length === 0) {
    throw new GeminiServiceError("Empty file provided", 400, "INVALID_FILE", "IMAGE_VALIDATION");
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new GeminiServiceError(
      `File size exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB`,
      413,
      "FILE_TOO_LARGE",
      "IMAGE_VALIDATION"
    );
  }

  const normalizedMime = mimeType.toLowerCase();

  // Clear, helpful diagnostic for HEIC / HEIF
  if (normalizedMime.includes("heic") || normalizedMime.includes("heif")) {
    throw new GeminiServiceError(
      "HEIC format is not supported directly by the Gemini Vision pipeline. Please upload a PNG, JPEG, or WebP screenshot.",
      400,
      "UNSUPPORTED_FORMAT",
      "IMAGE_VALIDATION"
    );
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(normalizedMime)) {
    throw new GeminiServiceError(
      `Unsupported file format: ${mimeType}. Allowed formats: PNG, JPEG, WebP`,
      400,
      "UNSUPPORTED_FORMAT",
      "IMAGE_VALIDATION"
    );
  }
}

/**
 * Types for Attendance Extraction
 */
export interface ExtractedSubject {
  subjectCode: string | null;
  subjectName: string;
  faculty?: string | null;
  attended: number | null;
  conducted: number | null;
  percentage: number | null;
}

export interface ExtractedOverallAttendance {
  attended: number | null;
  conducted: number | null;
  percentage: number | null;
}

export interface AttendanceExtractionResult {
  subjects: ExtractedSubject[];
  overall: ExtractedOverallAttendance;
  confidence: number;
  warnings: string[];
}

/**
 * Types for Timetable Extraction
 */
export interface SubjectMapping {
  abbreviation: string;
  fullName: string;
  faculty: string | null;
  location: string | null;
}

export interface ExtractedTimetableEntry {
  day: string; // e.g. "Monday", "Tuesday"
  dayOfWeek: number; // 1 = Monday ... 7 = Sunday
  startTime: string; // "HH:mm" (24-hour)
  endTime: string; // "HH:mm" (24-hour)
  startTimeMinutes: number; // minutes from midnight
  endTimeMinutes: number; // minutes from midnight
  durationMinutes: number;
  isContinuous: boolean;
  isContinuousLab?: boolean; // backwards compatibility
  subjectCode: string | null;
  subjectName: string;
  displayName?: string;
  faculty: string | null;
  location: string | null;
  classType: "lecture" | "lab" | "activity" | "training" | "other";
  type?: "lecture" | "lab" | "break" | "lunch" | "free" | "activity" | "other"; // backwards compatibility
  confidence: number;
  warnings: string[];
  requiresReview: boolean;
  possibleSubjects?: string[];
  sourceText?: string;
}

export interface TimetableExtractionResult {
  entries: ExtractedTimetableEntry[];
  mappings: SubjectMapping[];
  warnings: string[];
}

/**
 * Sanitizes and extracts the server-side Gemini API key securely
 */
export function getSanitizedApiKey(): string {
  let apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

  // Strip invisible control characters (ASCII 0-31, 127) and whitespace
  apiKey = apiKey.replace(/[\x00-\x1F\x7F]/g, "").trim();

  // If in local/dev environment and process.env is truncated or missing, check Windows User environment
  if (!apiKey || apiKey.length < 10) {
    try {
      const userKey = execSync(
        "powershell -NoProfile -Command \"[System.Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User')\"",
        { encoding: "utf8" }
      )
        .replace(/[\x00-\x1F\x7F]/g, "")
        .trim();

      if (userKey && userKey.length > 10) {
        apiKey = userKey;
      }
    } catch {}
  }

  if (!apiKey || apiKey.length < 10) {
    throw new GeminiServiceError(
      "AI Service not configured: GEMINI_API_KEY is missing or invalid in server environment",
      503,
      "MISSING_API_KEY",
      "INITIALIZATION"
    );
  }

  return apiKey;
}

/**
 * Initializes GoogleGenAI client securely from environment
 */
function getGeminiClient(): GoogleGenAI {
  const apiKey = getSanitizedApiKey();
  return new GoogleGenAI({ apiKey });
}

/**
 * Attendance extraction JSON Schema definition for Gemini Structured Output
 */
const attendanceResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    subjects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          subjectCode: { type: Type.STRING, nullable: true },
          subjectName: { type: Type.STRING },
          faculty: { type: Type.STRING, nullable: true },
          attended: { type: Type.INTEGER, nullable: true },
          conducted: { type: Type.INTEGER, nullable: true },
          percentage: { type: Type.NUMBER, nullable: true },
        },
        required: ["subjectName"],
      },
    },
    overall: {
      type: Type.OBJECT,
      properties: {
        attended: { type: Type.INTEGER, nullable: true },
        conducted: { type: Type.INTEGER, nullable: true },
        percentage: { type: Type.NUMBER, nullable: true },
      },
      required: [],
    },
    confidence: { type: Type.NUMBER },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["subjects", "confidence", "warnings"],
};

/**
 * Timetable extraction JSON Schema definition for Gemini Structured Output
 */
const timetableResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    entries: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          startTime: { type: Type.STRING },
          endTime: { type: Type.STRING },
          subjectCode: { type: Type.STRING, nullable: true },
          subjectName: { type: Type.STRING },
          displayName: { type: Type.STRING, nullable: true },
          faculty: { type: Type.STRING, nullable: true },
          location: { type: Type.STRING, nullable: true },
          classType: {
            type: Type.STRING,
            enum: ["lecture", "lab", "activity", "training", "other"],
          },
          durationMinutes: { type: Type.INTEGER },
          isContinuous: { type: Type.BOOLEAN },
          confidence: { type: Type.NUMBER },
          warnings: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          requiresReview: { type: Type.BOOLEAN },
          possibleSubjects: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          sourceText: { type: Type.STRING, nullable: true },
        },
        required: [
          "day",
          "startTime",
          "endTime",
          "subjectName",
          "classType",
          "durationMinutes",
          "isContinuous",
          "requiresReview",
        ],
      },
    },
    mappings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          abbreviation: { type: Type.STRING },
          fullName: { type: Type.STRING },
          faculty: { type: Type.STRING, nullable: true },
          location: { type: Type.STRING, nullable: true },
        },
        required: ["abbreviation", "fullName"],
      },
    },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["entries", "mappings", "warnings"],
};

/**
 * Attendance System Prompt
 */
const ATTENDANCE_SYSTEM_PROMPT = `
You are TrackX's precision OCR Vision AI specialized in university and college attendance portals, ERP ledgers, and student dashboards.

Extract ONLY information that is genuinely and clearly visible in the image.

STRICT EXTRACTION RULES:
1. MATHEMATICAL INTEGRITY: NEVER invent, fabricate, or reverse-engineer attended or conducted class counts.
   - If the image shows "18 / 26" or "Attended: 18, Total: 26": attended = 18, conducted = 26, percentage = 69.23.
   - If the image ONLY shows "69.23%" or "75%" with NO underlying class counts:
     attended = null
     conducted = null
     percentage = 69.23
   - Add a warning: "Attended/conducted counts were not visible for [Subject Name]; only percentage was detected."
2. DISTINGUISH METRICS:
   - Do not confuse marks / grade points with attendance percentage.
   - Do not confuse serial numbers or course credit counts with attended/conducted classes.
   - Do not confuse faculty names with subject names.
3. PRESERVE VISIBLE NAMES:
   - If subject code is visible (e.g. CS501, ENG201), extract it. If not visible, return null.
   - If subject name is abbreviated, preserve the abbreviation. Do not hallucinate external names.
   - If faculty name is visible, extract it; otherwise return null.
4. CONFIDENCE & WARNINGS:
   - Provide overall confidence between 0.0 and 1.0.
   - Add clear, actionable warnings if any rows are blurry, counts are missing, or codes are unclear.
`;

/**
 * Timetable System Prompt
 */
const TIMETABLE_SYSTEM_PROMPT = `
You are TrackX's precision OCR Vision AI specialized in real-world college and university timetable schedules.

Analyze the ENTIRE image spatially. The image contains:
1. A weekly timetable grid at the top:
   - Rows: Days of the week (Monday, Tuesday, Wednesday, Thursday, Friday, Saturday). Extract all days; do not stop early.
   - Columns: Time periods (e.g. 09:15–10:15, 10:15–11:15, 11:15–12:15, 12:15–13:00 LUNCH, 13:00–14:00, 14:00–15:00, 15:00–16:00).
2. A subject / faculty / location mapping table below the timetable grid:
   - Contains columns such as SUBJECT abbreviation, FULL SUBJECT NAME, FACULTY name, and CLASS/LAB LOCATION (room/lab code).

EXTRACTION INSTRUCTIONS:

1. LOWER MAPPING TABLE (mappings):
   - Extract every row from the lower subject table:
     - abbreviation: abbreviation/short code (e.g. "OS", "AJP", "ATCD", "CN", "DWDM", "ENT", "IIOT", "AJP LAB", "VI LAB")
     - fullName: full expanded subject title (e.g. "Operating Systems", "Advanced Java Programming", "Industry 4.0 and IIOT")
     - faculty: instructor/faculty name (e.g. "Mrs. G. Gayathri", "Mr. M. Aswini Kumar")
     - location: classroom or lab room code (e.g. "DE-12", "REIMAN LAB", "NEWTON LAB")

2. TIME GRID NORMALIZATION:
   - Normalize times to 24-hour "HH:mm" format (e.g. "9.15 - 10.15" -> startTime: "09:15", endTime: "10:15").
   - Calculate durationMinutes = endTimeMinutes - startTimeMinutes.

3. MERGED CELLS — CRITICAL (DO NOT SPLIT):
   - Analyze cell boundaries and arrow/span indicators (e.g. "<- VI / DE LAB ->", "<- AJP LAB ->", "<- CODING & TRAINING ->").
   - If a cell spans multiple columns (e.g. 10:15 to 12:15 or 13:00 to 15:00 or 09:15 to 12:15):
     - Create ONE single entry with startTime of the beginning period and endTime of the ending period.
     - DO NOT split continuous 2-hour or multi-hour blocks into 1-hour entries!
     - Set isContinuous = true, durationMinutes = 120 (or total span in minutes).

4. AMBIGUOUS / COMBINED ENTRIES:
   - When a cell contains dual or slash-separated values (e.g., "ENT / IIOT" or "ENT/IIOT", "VI / DE LAB"):
     - Do NOT arbitrarily pick one subject.
     - Set displayName: the exact raw text (e.g. "ENT / IIOT").
     - Set possibleSubjects: an array of the candidate full subjects from the mapping table (e.g. ["Entrepreneurship", "Industry 4.0 and IIOT"]).
     - Set requiresReview: true.
     - Add a warning: "Ambiguous entry detected: ENT / IIOT. Requires student confirmation."

5. ENRICHMENT FROM MAPPING TABLE:
   - For single-subject cells (e.g. "OS", "CN", "AJP LAB"), look up the abbreviation in the mapping table and populate:
     - subjectCode: the abbreviation (e.g. "OS")
     - subjectName: full name from the mapping table (e.g. "Operating Systems")
     - faculty: faculty name from mapping table if available
     - location: classroom or lab room from mapping table if available
   - If no mapping is found in the table, preserve the visible text in subjectName and set faculty/location to null. NEVER invent faculty or locations.

6. CLASS TYPES & ACTIVITIES:
   - Assign classType:
     - "lab" for laboratory sessions (e.g. AJP LAB, VI LAB, WORKSHOP).
     - "lecture" for theory courses.
     - "activity" for non-academic periods: "STUDENT ACTIVITIES", "STUDENT CERTIFICATIONS / ACTIVITIES".
     - "training" for "CODING & TRAINING", "TRAINING & PLACEMENT", "T&P".
     - "other" for anything else.

7. LUNCH PERIOD:
   - 12:15–13:00 is lunch break.
   - If extracted, mark classType = "other", subjectName = "LUNCH", requiresReview = false.

8. CONFIDENCE & ERROR HANDLING:
   - If a cell is partially unreadable or confidence < 0.8, set requiresReview: true and include a descriptive warning.
   - Do NOT fail the entire timetable if one cell is unclear; extract all readable cells and flag the uncertain one.

9. SUNDAYS & PUBLIC HOLIDAYS:
   - Sunday is universally an off-day / holiday for all colleges. Never schedule or extract academic classes on Sunday.
   - Any public holidays or gazetted off-days visible are non-instructional holidays.
`;

/**
 * Helper to parse time string "HH:mm" to minutes from midnight
 */
export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(":");
  if (parts.length < 2) return 0;
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  if (isNaN(hours) || isNaN(minutes)) return 0;
  return hours * 60 + minutes;
}

const DAY_MAP: Record<string, number> = {
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
  sunday: 7,
  sun: 7,
};

/**
 * Maps day name to 1..7 (Monday = 1)
 */
export function normalizeDayToWeekday(dayStr: string): { day: string; dayOfWeek: number } {
  const clean = dayStr.trim().toLowerCase();
  const dayOfWeek = DAY_MAP[clean] || 1;
  const canonicalNames = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  return {
    day: canonicalNames[dayOfWeek - 1],
    dayOfWeek,
  };
}

/**
 * Validates and sanitizes Attendance extraction AI output
 */
export function validateAttendanceExtraction(raw: unknown): AttendanceExtractionResult {
  if (!raw || typeof raw !== "object") {
    throw new GeminiServiceError(
      "Malformed AI response: Output is not a valid JSON object",
      502,
      "PARSE_ERROR",
      "OUTPUT_VALIDATION"
    );
  }

  const obj = raw as Record<string, unknown>;
  const warnings: string[] = Array.isArray(obj.warnings)
    ? obj.warnings.filter((w): w is string => typeof w === "string")
    : [];

  const rawSubjects = Array.isArray(obj.subjects) ? obj.subjects : [];
  const subjects: ExtractedSubject[] = [];

  for (let i = 0; i < rawSubjects.length; i++) {
    const s = rawSubjects[i] as Record<string, unknown>;
    const subjectName = typeof s.subjectName === "string" && s.subjectName.trim()
      ? s.subjectName.trim()
      : `Subject ${i + 1}`;

    const subjectCode = typeof s.subjectCode === "string" && s.subjectCode.trim()
      ? s.subjectCode.trim().toUpperCase()
      : null;

    const faculty = typeof s.faculty === "string" && s.faculty.trim()
      ? s.faculty.trim()
      : null;

    let attended: number | null = null;
    let conducted: number | null = null;
    let percentage: number | null = null;

    if (s.attended !== null && s.attended !== undefined && typeof s.attended === "number" && !isNaN(s.attended)) {
      attended = Math.max(0, Math.round(s.attended));
    }

    if (s.conducted !== null && s.conducted !== undefined && typeof s.conducted === "number" && !isNaN(s.conducted)) {
      conducted = Math.max(0, Math.round(s.conducted));
    }

    if (s.percentage !== null && s.percentage !== undefined && typeof s.percentage === "number" && !isNaN(s.percentage)) {
      percentage = Math.min(100, Math.max(0, parseFloat(s.percentage.toFixed(2))));
    }

    if (attended !== null && conducted !== null) {
      if (conducted < attended) {
        warnings.push(`Subject "${subjectName}": Conducted (${conducted}) was less than attended (${attended}). Adjusted conducted to match attended.`);
        conducted = attended;
      }
      if (percentage === null && conducted > 0) {
        percentage = parseFloat(((attended / conducted) * 100).toFixed(2));
      }
    } else if (percentage !== null && (attended === null || conducted === null)) {
      warnings.push(`Subject "${subjectName}": Attended/conducted counts were not visible. Only percentage (${percentage}%) was detected.`);
    }

    subjects.push({
      subjectCode,
      subjectName,
      faculty,
      attended,
      conducted,
      percentage,
    });
  }

  const rawOverall = (obj.overall && typeof obj.overall === "object" ? obj.overall : {}) as Record<string, unknown>;
  const overallAttended = typeof rawOverall.attended === "number" && !isNaN(rawOverall.attended)
    ? Math.max(0, Math.round(rawOverall.attended))
    : null;
  const overallConducted = typeof rawOverall.conducted === "number" && !isNaN(rawOverall.conducted)
    ? Math.max(0, Math.round(rawOverall.conducted))
    : null;
  let overallPercentage = typeof rawOverall.percentage === "number" && !isNaN(rawOverall.percentage)
    ? Math.min(100, Math.max(0, parseFloat(rawOverall.percentage.toFixed(2))))
    : null;

  if (overallPercentage === null && overallAttended !== null && overallConducted !== null && overallConducted > 0) {
    overallPercentage = parseFloat(((overallAttended / overallConducted) * 100).toFixed(2));
  }

  const confidence = typeof obj.confidence === "number" && !isNaN(obj.confidence)
    ? Math.min(1, Math.max(0, parseFloat(obj.confidence.toFixed(2))))
    : subjects.length > 0 ? 0.85 : 0.0;

  return {
    subjects,
    overall: {
      attended: overallAttended,
      conducted: overallConducted,
      percentage: overallPercentage,
    },
    confidence,
    warnings,
  };
}

/**
 * Validates and sanitizes Timetable extraction AI output
 */
export function validateTimetableExtraction(raw: unknown): TimetableExtractionResult {
  if (!raw || typeof raw !== "object") {
    throw new GeminiServiceError(
      "Malformed AI response: Output is not a valid JSON object",
      502,
      "PARSE_ERROR",
      "OUTPUT_VALIDATION"
    );
  }

  const obj = raw as Record<string, unknown>;
  const warnings: string[] = Array.isArray(obj.warnings)
    ? obj.warnings.filter((w): w is string => typeof w === "string")
    : [];

  // Parse mappings from lower subject table
  const rawMappings = Array.isArray(obj.mappings) ? obj.mappings : [];
  const mappings: SubjectMapping[] = [];
  const mappingByAbbr = new Map<string, SubjectMapping>();
  const mappingByName = new Map<string, SubjectMapping>();

  for (const m of rawMappings) {
    if (!m || typeof m !== "object") continue;
    const item = m as Record<string, unknown>;
    const abbreviation = typeof item.abbreviation === "string" ? item.abbreviation.trim() : "";
    const fullName = typeof item.fullName === "string" ? item.fullName.trim() : "";
    const faculty = typeof item.faculty === "string" && item.faculty.trim() ? item.faculty.trim() : null;
    const location = typeof item.location === "string" && item.location.trim() ? item.location.trim() : null;

    if (abbreviation || fullName) {
      const sm: SubjectMapping = { abbreviation, fullName, faculty, location };
      mappings.push(sm);
      if (abbreviation) mappingByAbbr.set(abbreviation.toLowerCase(), sm);
      if (fullName) mappingByName.set(fullName.toLowerCase(), sm);
    }
  }

  const rawEntries = Array.isArray(obj.entries) ? obj.entries : [];
  const entries: ExtractedTimetableEntry[] = [];

  for (let i = 0; i < rawEntries.length; i++) {
    const e = rawEntries[i] as Record<string, unknown>;
    const rawDay = typeof e.day === "string" ? e.day : "Monday";
    const { day, dayOfWeek } = normalizeDayToWeekday(rawDay);

    // Sunday is universally a holiday for all colleges - ignore any inadvertent Sunday classes
    if (dayOfWeek === 7 || day.toLowerCase() === "sunday") {
      warnings.push("Sunday entry ignored: Sunday is designated as a universal holiday for all colleges.");
      continue;
    }

    let rawSubjectName = typeof e.subjectName === "string" && e.subjectName.trim()
      ? e.subjectName.trim()
      : `Period ${i + 1}`;

    let subjectCode = typeof e.subjectCode === "string" && e.subjectCode.trim()
      ? e.subjectCode.trim().toUpperCase()
      : null;

    let faculty = typeof e.faculty === "string" && e.faculty.trim()
      ? e.faculty.trim()
      : null;

    let location = typeof e.location === "string" && e.location.trim()
      ? e.location.trim()
      : null;

    let startTime = typeof e.startTime === "string" && e.startTime.includes(":") ? e.startTime.trim() : "09:00";
    let endTime = typeof e.endTime === "string" && e.endTime.includes(":") ? e.endTime.trim() : "10:00";

    if (/^\d:\d{2}$/.test(startTime)) startTime = "0" + startTime;
    if (/^\d:\d{2}$/.test(endTime)) endTime = "0" + endTime;

    const startMins = timeStringToMinutes(startTime);
    let endMins = timeStringToMinutes(endTime);

    if (endMins <= startMins) {
      warnings.push(`Entry "${rawSubjectName}" on ${day}: End time (${endTime}) was not after start time (${startTime}). Set to 1 hour default.`);
      endMins = startMins + 60;
      const endH = Math.floor(endMins / 60) % 24;
      const endM = endMins % 60;
      endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    }

    const durationMinutes = endMins - startMins;

    // Detect class type
    const rawClassType = (typeof e.classType === "string" ? e.classType.toLowerCase() : (typeof e.type === "string" ? e.type.toLowerCase() : "lecture"));
    let classType: "lecture" | "lab" | "activity" | "training" | "other" = "lecture";

    if (["lecture", "lab", "activity", "training", "other"].includes(rawClassType)) {
      classType = rawClassType as "lecture" | "lab" | "activity" | "training" | "other";
    }

    if (/coding|training|placement|t&p/i.test(rawSubjectName)) {
      classType = "training";
    } else if (/activities|certifications/i.test(rawSubjectName)) {
      classType = "activity";
    } else if (/lab|workshop|practical/i.test(rawSubjectName)) {
      classType = "lab";
    } else if (/lunch|break/i.test(rawSubjectName)) {
      classType = "other";
    }

    const isContinuous = Boolean(
      e.isContinuous ||
      e.isContinuousBlock ||
      durationMinutes >= 90 ||
      classType === "lab"
    );
    const isContinuousLab = isContinuous && classType === "lab";

    const confidence = typeof e.confidence === "number" && !isNaN(e.confidence)
      ? Math.min(1, Math.max(0, parseFloat(e.confidence.toFixed(2))))
      : 0.9;

    const entryWarnings: string[] = Array.isArray(e.warnings)
      ? e.warnings.filter((w): w is string => typeof w === "string")
      : [];

    let requiresReview = Boolean(e.requiresReview);
    let displayName = typeof e.displayName === "string" && e.displayName.trim()
      ? e.displayName.trim()
      : rawSubjectName;

    let possibleSubjects: string[] | undefined = Array.isArray(e.possibleSubjects) && e.possibleSubjects.length > 0
      ? e.possibleSubjects.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      : undefined;

    // Detect Ambiguous / Combined Cells (e.g. ENT/IIOT, VI/DE LAB, ENT / IIOT)
    const isAmbiguousPattern = /\/|&/.test(rawSubjectName) && !/activities|certifications|training/i.test(rawSubjectName);
    if (isAmbiguousPattern || e.requiresReview) {
      requiresReview = true;
      displayName = rawSubjectName;

      if (!possibleSubjects || possibleSubjects.length === 0) {
        possibleSubjects = [];
        const tokens = rawSubjectName.split(/[/]/).map((t) => t.trim()).filter(Boolean);
        for (const token of tokens) {
          // Clean token (e.g. "VI" or "DE LAB")
          const lookup = mappingByAbbr.get(token.toLowerCase()) ||
            mappingByAbbr.get(`${token.toLowerCase()} lab`) ||
            mappingByName.get(token.toLowerCase());

          if (lookup && lookup.fullName) {
            possibleSubjects.push(lookup.fullName);
          } else {
            possibleSubjects.push(token);
          }
        }
      }

      if (!entryWarnings.some((w) => w.includes("Ambiguous"))) {
        entryWarnings.push(`Ambiguous subject entry '${rawSubjectName}'. Requires student confirmation.`);
      }
    } else {
      // Non-ambiguous: Enrich from mapping table if code or name matches
      const lookupKey = (subjectCode || rawSubjectName).toLowerCase();
      const mapped = mappingByAbbr.get(lookupKey) ||
        mappingByName.get(lookupKey) ||
        mappingByAbbr.get(rawSubjectName.toLowerCase()) ||
        mappingByName.get(rawSubjectName.toLowerCase());

      if (mapped) {
        if (!subjectCode && mapped.abbreviation) {
          subjectCode = mapped.abbreviation.toUpperCase();
        }
        if (mapped.fullName && (rawSubjectName.toLowerCase() === mapped.abbreviation.toLowerCase() || rawSubjectName.length <= 6)) {
          rawSubjectName = mapped.fullName;
        }
        if (!faculty && mapped.faculty) {
          faculty = mapped.faculty;
        }
        if (!location && mapped.location) {
          location = mapped.location;
        }
      }
    }

    const sourceText = typeof e.sourceText === "string" ? e.sourceText.trim() : undefined;

    entries.push({
      day,
      dayOfWeek,
      startTime,
      endTime,
      startTimeMinutes: startMins,
      endTimeMinutes: endMins,
      durationMinutes,
      isContinuous,
      isContinuousLab,
      subjectCode,
      subjectName: rawSubjectName,
      displayName,
      faculty,
      location,
      classType,
      type: classType === "other" && /lunch/i.test(rawSubjectName) ? "lunch" : (classType === "lab" ? "lab" : "lecture"),
      confidence,
      warnings: entryWarnings,
      requiresReview,
      possibleSubjects,
      sourceText,
    });
  }

  // Sort entries: day first, then start time, preferring longer continuous duration for the same slot
  entries.sort((a, b) => {
    if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
    if (a.startTimeMinutes !== b.startTimeMinutes) return a.startTimeMinutes - b.startTimeMinutes;
    return b.durationMinutes - a.durationMinutes;
  });

  // Deduplicate and normalize timetable entries
  const deduplicatedEntries: ExtractedTimetableEntry[] = [];

  for (const entry of entries) {
    const normSub = (entry.subjectCode || entry.subjectName || "").toLowerCase().replace(/[^a-z0-9]/g, "");

    const duplicateIndex = deduplicatedEntries.findIndex((e) => {
      if (e.dayOfWeek !== entry.dayOfWeek) return false;

      const eNormSub = (e.subjectCode || e.subjectName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const subjectMatch =
        normSub === eNormSub ||
        normSub.includes(eNormSub) ||
        eNormSub.includes(normSub) ||
        (e.classType === entry.classType && e.startTimeMinutes === entry.startTimeMinutes);

      // Exact same time slot
      if (e.startTimeMinutes === entry.startTimeMinutes && e.endTimeMinutes === entry.endTimeMinutes) {
        return subjectMatch || e.classType === entry.classType;
      }

      // Continuous class subsumption: if a 2-hour continuous class is already registered, ignore single-hour split fragments
      if (
        e.isContinuous &&
        entry.startTimeMinutes >= e.startTimeMinutes &&
        entry.endTimeMinutes <= e.endTimeMinutes &&
        subjectMatch
      ) {
        return true;
      }

      return false;
    });

    if (duplicateIndex >= 0) {
      // Merge missing enrichment metadata into the existing primary entry
      const existing = deduplicatedEntries[duplicateIndex];
      if (!existing.faculty && entry.faculty) existing.faculty = entry.faculty;
      if (!existing.location && entry.location) existing.location = entry.location;
      if (!existing.subjectCode && entry.subjectCode) existing.subjectCode = entry.subjectCode;
      continue;
    }

    deduplicatedEntries.push(entry);
  }

  return {
    entries: deduplicatedEntries,
    mappings,
    warnings,
  };
}

/**
 * Executes a Gemini Vision content generation call with automatic model fallback
 */
async function generateWithFallback(
  ai: GoogleGenAI,
  contents: unknown[],
  config: unknown
): Promise<{ text: string; modelUsed: string }> {
  let lastError: unknown = null;

  for (const model of FALLBACK_GEMINI_MODELS) {
    let retries = 2;
    while (retries >= 0) {
      try {
        console.log(`[Gemini AI] Starting request with model=${model}...`);
        const startTime = Date.now();

        type GenerateArgs = Parameters<typeof ai.models.generateContent>[0];
        const response = await ai.models.generateContent({
          model,
          contents: contents as GenerateArgs["contents"],
          config: config as GenerateArgs["config"],
        });

        const duration = Date.now() - startTime;
        console.log(`[Gemini AI] Response received from model=${model} in ${duration}ms`);

        const text = response.text;
        if (!text || text.trim() === "") {
          throw new GeminiServiceError("Gemini Vision returned an empty response", 502, "EMPTY_RESPONSE", "GEMINI_REQUEST");
        }

        return { text, modelUsed: model };
      } catch (err: unknown) {
        lastError = err;
        const message = err instanceof Error ? err.message : String(err);

        // If daily quota is exhausted (limit: 20 or PerDay metric), skip immediately to next model
        if (
          message.includes("PerDay") ||
          message.includes("limit: 20") ||
          (message.toLowerCase().includes("quota") && message.toLowerCase().includes("day"))
        ) {
          console.warn(`[Gemini AI] Model ${model} daily free-tier quota exhausted. Immediately switching to next fallback model...`);
          break;
        }

        // If momentary rate limit (429 / RESOURCE_EXHAUSTED), wait 3s and retry once
        if (
          (message.includes("429") || message.toLowerCase().includes("quota") || message.toLowerCase().includes("rate limit")) &&
          retries > 0
        ) {
          console.warn(`[Gemini AI] Model ${model} rate limited (429). Retrying after 3s delay (${retries} retries left)...`);
          await new Promise((res) => setTimeout(res, 3000));
          retries--;
          continue;
        }

        // If model is 404 / deprecated, try next model in fallback list
        if (message.includes("404") || message.toLowerCase().includes("not found") || message.toLowerCase().includes("no longer available")) {
          console.warn(`[Gemini AI] Model ${model} returned 404/not available. Trying next fallback model...`);
          break;
        }

        // Break retry loop for other fatal errors
        break;
      }
    }
  }

  throw lastError;
}

/**
 * Extracts attendance data from image buffer using Gemini Vision
 */
export async function extractAttendanceFromImage(
  buffer: Buffer,
  mimeType: string
): Promise<AttendanceExtractionResult> {
  console.log(`[Gemini AI] Attendance extraction request received: MIME=${mimeType}, size=${buffer.length} bytes`);
  validateImageUpload(buffer, mimeType);

  const ai = getGeminiClient();
  const base64Data = buffer.toString("base64");

  try {
    const { text } = await generateWithFallback(
      ai,
      [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: "Analyze this student attendance screenshot and extract structured attendance data.",
            },
          ],
        },
      ],
      {
        systemInstruction: ATTENDANCE_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: attendanceResponseSchema,
        temperature: 0.1,
      }
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new GeminiServiceError(
        "Failed to parse Gemini structured JSON response",
        502,
        "PARSE_ERROR",
        "OUTPUT_PARSING"
      );
    }

    const validated = validateAttendanceExtraction(parsed);
    console.log(`[Gemini AI] Attendance extraction complete: ${validated.subjects.length} subjects extracted`);
    return validated;
  } catch (err: unknown) {
    if (err instanceof GeminiServiceError) {
      console.error(`[Gemini AI] Service error in stage ${err.stage}: ${err.code} - ${err.message}`);
      throw err;
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Gemini AI] Unexpected error during extraction:`, message);

    if (message.includes("429") || message.toLowerCase().includes("quota") || message.toLowerCase().includes("rate limit")) {
      throw new GeminiServiceError(
        "AI processing rate limit reached. Please wait a moment and try again.",
        429,
        "RATE_LIMIT",
        "GEMINI_REQUEST"
      );
    }

    if (
      message.includes("API_KEY_INVALID") ||
      message.includes("api key not valid") ||
      message.includes("INVALID_ARGUMENT") ||
      message.includes("invalid x-goog-api-key")
    ) {
      throw new GeminiServiceError(
        "Invalid or malformed Gemini API key configured on the server",
        503,
        "INVALID_API_KEY",
        "INITIALIZATION"
      );
    }

    if (message.includes("fetch failed") || message.toLowerCase().includes("enotfound") || message.toLowerCase().includes("connection")) {
      throw new GeminiServiceError(
        "Network connection to Gemini Vision API failed. Please check internet access.",
        502,
        "NETWORK_ERROR",
        "GEMINI_REQUEST"
      );
    }

    throw new GeminiServiceError(
      "Failed to process image with Gemini Vision AI. Please check the image and try again.",
      500,
      "AI_PROCESSING_FAILED",
      "GEMINI_REQUEST"
    );
  }
}

/**
 * Extracts timetable data from image buffer using Gemini Vision
 */
export async function extractTimetableFromImage(
  buffer: Buffer,
  mimeType: string
): Promise<TimetableExtractionResult> {
  console.log(`[Gemini AI] Timetable extraction request received: MIME=${mimeType}, size=${buffer.length} bytes`);
  validateImageUpload(buffer, mimeType);

  const ai = getGeminiClient();
  const base64Data = buffer.toString("base64");

  try {
    const { text } = await generateWithFallback(
      ai,
      [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            {
              text: "Analyze this student timetable schedule screenshot and extract structured schedule entries.",
            },
          ],
        },
      ],
      {
        systemInstruction: TIMETABLE_SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: timetableResponseSchema,
        temperature: 0.1,
      }
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new GeminiServiceError(
        "Failed to parse Gemini structured JSON response",
        502,
        "PARSE_ERROR",
        "OUTPUT_PARSING"
      );
    }

    const validated = validateTimetableExtraction(parsed);
    console.log(`[Gemini AI] Timetable extraction complete: ${validated.entries.length} slots extracted`);
    return validated;
  } catch (err: unknown) {
    if (err instanceof GeminiServiceError) {
      console.error(`[Gemini AI] Service error in stage ${err.stage}: ${err.code} - ${err.message}`);
      throw err;
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Gemini AI] Unexpected error during timetable extraction:`, message);

    if (message.includes("429") || message.toLowerCase().includes("quota") || message.toLowerCase().includes("rate limit")) {
      throw new GeminiServiceError(
        "AI processing rate limit reached. Please wait a moment and try again.",
        429,
        "RATE_LIMIT",
        "GEMINI_REQUEST"
      );
    }

    if (
      message.includes("API_KEY_INVALID") ||
      message.includes("api key not valid") ||
      message.includes("INVALID_ARGUMENT") ||
      message.includes("invalid x-goog-api-key")
    ) {
      throw new GeminiServiceError(
        "Invalid or malformed Gemini API key configured on the server",
        503,
        "INVALID_API_KEY",
        "INITIALIZATION"
      );
    }

    if (message.includes("fetch failed") || message.toLowerCase().includes("enotfound") || message.toLowerCase().includes("connection")) {
      throw new GeminiServiceError(
        "Network connection to Gemini Vision API failed. Please check internet access.",
        502,
        "NETWORK_ERROR",
        "GEMINI_REQUEST"
      );
    }

    throw new GeminiServiceError(
      "Failed to extract timetable schedule with Gemini Vision AI.",
      500,
      "AI_PROCESSING_FAILED",
      "GEMINI_REQUEST"
    );
  }
}
