/**
 * TrackX Subject Matching & Deduplication Engine
 *
 * Solves duplicate subject / tile creation when importing from attendance reports,
 * timetable grids, or manual uploads.
 */

import { Subject } from "@/types/trackx";

const STOP_WORDS = new Set([
  "and",
  "&",
  "of",
  "in",
  "the",
  "for",
  "to",
  "on",
  "a",
  "an",
  "with",
  "-",
  "/",
]);

/**
 * Strips academic course prefixes commonly seen in Indian university timetables
 * e.g. "DSC- E1 Data Warehousing...", "EOEC 3 Entrepreneurship...", "PCC-CS501 Operating..."
 */
export function stripAcademicPrefix(str: string): string {
  if (!str) return "";
  return str
    .replace(/^(dsc\s*-\s*[a-z0-9]+|eoec\s*(lab)?\s*\d*|pcc\s*-\s*[a-z0-9]+|hs\s*-\s*\d+|oe\s*-\s*\d+|pe\s*-\s*\d+|r\d+[a-z0-9]+)\s+/i, "")
    .trim();
}

/**
 * Normalizes subject string for resilient comparison
 */
export function normalizeSubjectString(str: string): string {
  if (!str) return "";
  return stripAcademicPrefix(str)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if subject represents a laboratory session
 */
export function isLabSubject(name: string, type?: string, code?: string): boolean {
  const combined = `${name || ""} ${type || ""} ${code || ""}`.toLowerCase();
  return (
    combined.includes("lab") ||
    combined.includes("laboratory") ||
    combined.includes("practical") ||
    combined.includes("workshop")
  );
}

/**
 * Generates acronym / abbreviation candidates for a subject name
 * E.g., "Operating Systems" -> ["os"]
 * "Advanced Java Programming" -> ["ajp"]
 * "Automata and Compiler Design" -> ["acd", "atcd"]
 * "Data Warehousing and Data Mining" -> ["dwdm"]
 * "Industry 4.0 and IIOT" -> ["iiot", "i40"]
 * "Advanced Java Programming Lab" -> ["ajpl", "ajp lab", "ajp"]
 * "Virtual Instrumentation Lab" -> ["vil", "vi lab", "vi"]
 */
export function generateSubjectAcronyms(fullName: string): string[] {
  if (!fullName) return [];
  const clean = stripAcademicPrefix(fullName).trim();
  const words = clean.split(/[\s\-_/&+()]+/).filter(Boolean);

  const significantWords = words.filter(
    (w) => !STOP_WORDS.has(w.toLowerCase())
  );

  const acronyms = new Set<string>();

  // Direct no-punctuation acronym if input is short like "T&P", "VI LAB"
  const compact = clean.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (compact.length >= 2 && compact.length <= 6) {
    acronyms.add(compact);
  }

  // 1. First letter of significant words
  if (significantWords.length > 1) {
    const acronym = significantWords.map((w) => w[0]).join("").toLowerCase();
    acronyms.add(acronym);
  }

  // 2. First letter of all words
  if (words.length > 1) {
    const allAcronym = words.map((w) => w[0]).join("").toLowerCase();
    acronyms.add(allAcronym);
  }

  // 3. Special handling for "ATCD" (Automata and Compiler Design)
  if (/automata.*compiler/i.test(fullName)) {
    acronyms.add("atcd");
    acronyms.add("acd");
  }

  // 4. Special handling for "IIOT" (Industry 4.0 and IIOT)
  if (/iiot/i.test(fullName)) {
    acronyms.add("iiot");
    acronyms.add("ent/iiot");
    acronyms.add("ent / iiot");
    acronyms.add("ent iiot");
    acronyms.add("ent");
  }

  // 5. Special handling for Labs: E.g. "AJP LAB", "VI LAB"
  const isLab = isLabSubject(fullName);
  if (isLab) {
    const nonLabWords = significantWords.filter(
      (w) => !/^(lab|laboratory|practical)$/i.test(w)
    );
    if (nonLabWords.length > 0) {
      const baseAcr = nonLabWords.map((w) => w[0]).join("").toLowerCase();
      acronyms.add(`${baseAcr} lab`);
      acronyms.add(`${baseAcr}lab`);
      acronyms.add(baseAcr); // e.g. "VI" for "Virtual Instrumentation Lab"
    }
    // Special handling for VI Lab in shared elective "VI / DE LAB"
    if (/virtual\s*instrumentation/i.test(fullName)) {
      acronyms.add("vi");
      acronyms.add("vi lab");
      acronyms.add("vi / de lab");
      acronyms.add("vi de lab");
    }
  }

  // 6. Special handling for "T&P" / "Training & Placement"
  if (/training.*placement|t\s*&\s*p/i.test(fullName)) {
    acronyms.add("tp");
    acronyms.add("t&p");
    acronyms.add("t & p");
    acronyms.add("t p");
  }

  // 7. Special handling for "Coding & Training"
  if (/coding.*training/i.test(fullName)) {
    acronyms.add("ct");
    acronyms.add("c&t");
    acronyms.add("c & t");
    acronyms.add("coding & training");
    acronyms.add("coding & training 1");
    acronyms.add("coding training");
    acronyms.add("coding training 1");
  }

  return Array.from(acronyms);
}

/**
 * Evaluates whether a candidate subject matches an existing subject
 */
export function isSubjectMatch(
  candidate: { name: string; code?: string; type?: string },
  existing: Subject
): boolean {
  if (!candidate.name && !candidate.code) return false;

  const candNameClean = candidate.name.trim();
  const existNameClean = existing.name.trim();

  // If candidate contains slashes (e.g. "VI / DE LAB" or "ENT/IIOT" or "EOEC 3 Entrepreneurship / Industry 4.0 and IIOT")
  // Check if any sub-token matches existing
  if (candNameClean.includes("/") && !candNameClean.toLowerCase().includes("activities")) {
    const tokens = candNameClean.split("/").map((t) => t.trim()).filter(Boolean);
    const hasLabWord = isLabSubject(candNameClean);
    for (const rawToken of tokens) {
      // If parent string was a lab (e.g. "VI / DE LAB"), inherit "LAB" suffix for bare abbreviations like "VI"
      const token = hasLabWord && !isLabSubject(rawToken) ? `${rawToken} Lab` : rawToken;
      if (isSubjectMatch({ name: token, code: candidate.code, type: candidate.type }, existing)) {
        return true;
      }
    }
  }

  const candLab = isLabSubject(candidate.name, candidate.type, candidate.code);
  const existLab = isLabSubject(existing.name, existing.type, existing.code);

  // STRICT RULE: If one is explicitly a Laboratory and the other is a pure Theory course OF THE SAME ROOT
  // e.g. "Advanced Java Programming" (Theory) must NOT match "Advanced Java Programming Lab" (Lab)
  const candHasExplicitLab = /lab|laboratory|practical|workshop/i.test(candidate.name);
  const existHasExplicitLab = /lab|laboratory|practical|workshop/i.test(existing.name);
  if (candHasExplicitLab !== existHasExplicitLab) {
    return false;
  }

  const candNameNorm = normalizeSubjectString(candidate.name);
  const existNameNorm = normalizeSubjectString(existing.name);

  // 1. Exact Name Match
  if (candNameNorm && existNameNorm && candNameNorm === existNameNorm) {
    return true;
  }

  const candCode = (candidate.code || "").trim().toUpperCase();
  const existCode = (existing.code || "").trim().toUpperCase();

  // 2. Exact Code Match
  if (candCode && existCode && candCode === existCode) {
    return true;
  }

  // 3. Code matches Name (e.g. Candidate Code "OS" matches Existing Name "OS" or "Operating Systems")
  if (candCode) {
    const candCodeLower = candCode.toLowerCase();
    if (candCodeLower === existNameNorm) return true;
    if (existCode && candCodeLower === existCode.toLowerCase()) return true;
    const existAcronyms = generateSubjectAcronyms(existing.name);
    if (existAcronyms.includes(candCodeLower) || existAcronyms.includes(candCodeLower.replace(/[^a-z0-9]/g, ""))) return true;
  }

  if (existCode) {
    const existCodeLower = existCode.toLowerCase();
    if (existCodeLower === candNameNorm) return true;
    const candAcronyms = generateSubjectAcronyms(candidate.name);
    if (candAcronyms.includes(existCodeLower) || candAcronyms.includes(existCodeLower.replace(/[^a-z0-9]/g, ""))) return true;
  }

  // 4. Acronym Matching between Names (e.g. "OS" vs "Operating Systems", "AJP" vs "Advanced Java Programming")
  const candAcronyms = generateSubjectAcronyms(candidate.name);
  const existAcronyms = generateSubjectAcronyms(existing.name);

  // If candidate is an abbreviation (e.g. "OS", "AJP", "VI LAB")
  if (existAcronyms.includes(candNameNorm) || existAcronyms.includes(candNameNorm.replace(/[^a-z0-9]/g, ""))) {
    return true;
  }

  // If existing is an abbreviation (e.g. existing is "OS", candidate is "Operating Systems")
  if (candAcronyms.includes(existNameNorm) || candAcronyms.includes(existNameNorm.replace(/[^a-z0-9]/g, ""))) {
    return true;
  }

  // If both share a common acronym
  const intersection = candAcronyms.filter((a) =>
    existAcronyms.includes(a) || existAcronyms.includes(a.replace(/[^a-z0-9]/g, ""))
  );
  if (intersection.length > 0) {
    return true;
  }

  // 5. Containment check: candidate contains existing name or existing contains candidate name
  // e.g. "DSC- E1 Data Warehousing and Data Mining (DWDM)" contains "Data Warehousing and Data Mining"
  if (candNameNorm.length >= 6 && existNameNorm.length >= 6) {
    if (candNameNorm.includes(existNameNorm) || existNameNorm.includes(candNameNorm)) {
      return true;
    }
  }

  return false;
}

/**
 * Finds the best matching existing subject from a collection
 */
export function findMatchingSubject(
  candidate: { name: string; code?: string; type?: string },
  existingSubjects: Subject[]
): Subject | undefined {
  return existingSubjects.find((s) => isSubjectMatch(candidate, s));
}

/**
 * Deduplicates an array of subjects, returning a clean canonical list
 * and an ID remapping dictionary to update references in timetable and records.
 */
export function deduplicateSubjectList(subjects: Subject[]): {
  canonicalSubjects: Subject[];
  idRemap: Map<string, string>;
} {
  const canonical: Subject[] = [];
  const idRemap = new Map<string, string>();

  for (const sub of subjects) {
    const matched = canonical.find((c) =>
      isSubjectMatch({ name: sub.name, code: sub.code, type: sub.type }, c)
    );

    if (!matched) {
      canonical.push({ ...sub });
      idRemap.set(sub.id, sub.id);
    } else {
      // Map duplicate ID to canonical ID
      idRemap.set(sub.id, matched.id);

      // Merge data into matched:
      // Prefer fuller name
      if (sub.name.length > matched.name.length && !/^[A-Z0-9\s]{1,6}$/.test(sub.name)) {
        matched.name = sub.name;
      }
      // Retain code if matched doesn't have one
      if (!matched.code && sub.code) {
        matched.code = sub.code;
      }
      // Retain faculty if matched doesn't have one
      if ((!matched.facultyName || matched.facultyName === "Faculty") && sub.facultyName && sub.facultyName !== "Faculty") {
        matched.facultyName = sub.facultyName;
      }
      // Combine attendance counts if duplicate had higher or baseline
      const subTotal = (sub.presentClasses || 0) + (sub.absentClasses || 0);
      const matchedTotal = (matched.presentClasses || 0) + (matched.absentClasses || 0);

      if (subTotal > matchedTotal) {
        matched.presentClasses = sub.presentClasses;
        matched.absentClasses = sub.absentClasses;
        matched.baselinePercentage = sub.baselinePercentage ?? matched.baselinePercentage;
        matched.countsUnavailable = sub.countsUnavailable ?? matched.countsUnavailable;
      } else if (matched.baselinePercentage == null && sub.baselinePercentage != null) {
        matched.baselinePercentage = sub.baselinePercentage;
        matched.countsUnavailable = sub.countsUnavailable;
      }
    }
  }

  return { canonicalSubjects: canonical, idRemap };
}

/**
 * Checks if a timetable slot or subject title represents non-academic activities
 * (e.g. Lunch, Student Activities, Library, Sports, Free period) that should NOT
 * create attendance subjects or require attendance tracking.
 */
export function isNonAcademicSubject(name: string, classType?: string, type?: string): boolean {
  if (type === "lunch" || type === "break" || type === "free" || type === "activity") {
    return true;
  }
  const clean = (name || "").toLowerCase().trim();
  if (
    /lunch|break|recess|free\s*period|interval/i.test(clean) ||
    /student\s*activities|activities|certifications|certification/i.test(clean) ||
    /sports|library|mentoring|counseling|assembly|cocurricular|co-curricular/i.test(clean)
  ) {
    return true;
  }
  if (classType === "activity") {
    return true;
  }
  return false;
}

