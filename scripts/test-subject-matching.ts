import { isSubjectMatch, findMatchingSubject, deduplicateSubjectList } from "../src/lib/subjectMatcher";
import { Subject } from "../src/types/trackx";

function createDummySubject(name: string, code?: string, type: Subject["type"] = "Theory", present = 0, absent = 0): Subject {
  return {
    id: `sub-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
    userId: "usr-test",
    semesterId: "sem-1",
    name,
    code,
    facultyName: "Faculty",
    colorValue: "#4ADE80",
    type,
    targetAttendance: 75,
    presentClasses: present,
    absentClasses: absent,
    status: "Active",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function runTests() {
  console.log("=== TRACKX SUBJECT MATCHING & DEDUPLICATION TESTS ===");

  const existingSubjects: Subject[] = [
    createDummySubject("OS", "OS", "Theory", 0, 0),
    createDummySubject("AJP", "AJP", "Theory", 0, 0),
    createDummySubject("AJP LAB", "AJP LAB", "Laboratory", 0, 0),
    createDummySubject("Automata and Compiler Design", "ATCD", "Theory", 0, 0),
    createDummySubject("CN", "CN", "Theory", 0, 0),
    createDummySubject("DWDM", "DWDM", "Theory", 0, 0),
    createDummySubject("Industry 4.0 and IIOT", undefined, "Theory", 0, 0),
    createDummySubject("VI LAB", "VI LAB", "Laboratory", 0, 0),
    createDummySubject("Training & Placement", "TP", "Theory", 0, 0),
    createDummySubject("Coding & Training", undefined, "Theory", 0, 0),
    createDummySubject("Community Project", undefined, "Theory", 0, 0),
  ];

  const extractedCandidates = [
    { name: "Operating Systems", percentage: 69.23 },
    { name: "Advanced Java Programming", percentage: 81.25 },
    { name: "Advanced Java Programming Lab", percentage: 88.89, type: "Laboratory" },
    { name: "Automata and Compiler Design", percentage: 71.88 },
    { name: "Computer Networks", percentage: 70.97 },
    { name: "Data Warehousing and Data Mining", percentage: 85.71 },
    { name: "Industry 4.0 and IIOT", percentage: 72.41 },
    { name: "Virtual Instrumentation Lab", percentage: 100, type: "Laboratory" },
    { name: "Training & Placement", percentage: 100 },
    { name: "Coding & Training - 1", percentage: 100 },
    { name: "Community Project", percentage: 0 },
  ];

  let matches = 0;
  for (const cand of extractedCandidates) {
    const matched = findMatchingSubject(cand, existingSubjects);
    if (matched) {
      console.log(`✔ Matched '${cand.name}' -> Existing '${matched.name}' (${matched.id})`);
      matches++;
    } else {
      console.error(`✖ Failed to match '${cand.name}'`);
    }
  }

  if (matches !== extractedCandidates.length) {
    console.error(`Only ${matches}/${extractedCandidates.length} matched.`);
    process.exit(1);
  }

  // Verify Theory vs Lab separation
  const ajpTheory = existingSubjects.find(s => s.name === "AJP")!;
  const ajpLabCandidate = { name: "Advanced Java Programming Lab", type: "Laboratory" };
  if (isSubjectMatch(ajpLabCandidate, ajpTheory)) {
    console.error("✖ FAILED: Lab candidate matched Theory subject!");
    process.exit(1);
  } else {
    console.log("✔ Theory vs Lab separation verified: AJP Lab did not match AJP Theory.");
  }

  // Verify Deduplication of existing duplicate subjects
  const duplicates: Subject[] = [
    createDummySubject("Operating Systems", undefined, "Theory", 18, 8),
    createDummySubject("OS", "OS", "Theory", 0, 0), // duplicate
    createDummySubject("Advanced Java Programming", undefined, "Theory", 26, 6),
    createDummySubject("AJP", "AJP", "Theory", 0, 0), // duplicate
  ];

  const { canonicalSubjects, idRemap } = deduplicateSubjectList(duplicates);
  console.log(`Deduplication reduced ${duplicates.length} subjects to ${canonicalSubjects.length} subjects.`);
  if (canonicalSubjects.length !== 2) {
    console.error("✖ Deduplication failed to collapse 4 subjects into 2.");
    process.exit(1);
  }
  console.log("Canonical subjects:", canonicalSubjects.map(s => `${s.name} (${s.code || 'no code'}) [Attended: ${s.presentClasses}]`));
  console.log("ID Remap table:", Object.fromEntries(idRemap.entries()));
  console.log("ALL TESTS PASSED!");
}

runTests();
