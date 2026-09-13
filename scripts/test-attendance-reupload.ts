import { Subject, TimetableEntry } from '../src/types/trackx';
import { findMatchingSubject } from '../src/lib/subjectMatcher';
import { computeMetrics } from '../src/lib/attendanceMath';

console.log("=== TRACKX ATTENDANCE RE-UPLOAD & TIMETABLE SYNC TEST SUITE ===\n");

let passed = 0;
let total = 0;

function assert(condition: boolean, msg: string) {
  total++;
  if (condition) {
    console.log(`✔ PASSED: ${msg}`);
    passed++;
  } else {
    console.error(`✖ FAILED: ${msg}`);
  }
}

// 1. Initial State: User has subjects and timetable entries (e.g. from timetable upload)
const initialSubjects: Subject[] = [
  {
    id: "sub-os-1",
    userId: "usr-test",
    semesterId: "sem-fall-2026",
    name: "OS",
    code: "CS401",
    facultyName: "Faculty",
    colorValue: "#00F2FE",
    type: "Theory",
    targetAttendance: 75,
    presentClasses: 0,
    absentClasses: 0,
    status: "Active",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "sub-ajp-1",
    userId: "usr-test",
    semesterId: "sem-fall-2026",
    name: "AJP",
    code: "CS402",
    facultyName: "Faculty",
    colorValue: "#00F2FE",
    type: "Theory",
    targetAttendance: 75,
    presentClasses: 0,
    absentClasses: 0,
    status: "Active",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
];

const timetableEntries: TimetableEntry[] = [
  {
    id: "tt-mon-1",
    userId: "usr-test",
    semesterId: "sem-fall-2026",
    subjectId: "sub-os-1",
    dayOfWeek: 1,
    periodNumber: 1,
    startTime: 555,
    endTime: 615,
    isEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "tt-mon-2",
    userId: "usr-test",
    semesterId: "sem-fall-2026",
    subjectId: "sub-ajp-1",
    dayOfWeek: 1,
    periodNumber: 2,
    startTime: 615,
    endTime: 675,
    isEnabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
];

// Initial metrics before re-upload
const initialOsMetrics = computeMetrics(
  initialSubjects[0].presentClasses,
  initialSubjects[0].presentClasses + initialSubjects[0].absentClasses,
  initialSubjects[0].targetAttendance
);
assert(initialOsMetrics.attended === 0 && initialOsMetrics.conducted === 0, "Initial OS metrics show 0/0 conducted");

// 2. Simulated Re-upload data with edited Attended & Conducted counts from the UI
const reuploadData = [
  {
    id: "ocr-1",
    name: "Operating Systems", // full name
    code: "CS401",
    faculty: "Dr. Smith",
    attended: 18,
    conducted: 26,
    percentage: 69.23,
  },
  {
    id: "ocr-2",
    name: "Advanced Java Programming",
    code: "CS402",
    faculty: "Prof. Davis",
    attended: 22,
    conducted: 25,
    percentage: 88.0,
  },
  {
    id: "ocr-3",
    name: "Computer Networks", // newly added course in attendance report
    code: "CS403",
    faculty: "Prof. Brown",
    attended: 15,
    conducted: 18,
    percentage: 83.33,
  }
];

// Execute baseline confirmation simulation
let currentSubjects = [...initialSubjects];
const firestoreSaves: Record<string, Subject> = {};

for (const item of reuploadData) {
  const attended = Math.max(0, item.attended);
  const conducted = Math.max(0, item.conducted);
  const matched = findMatchingSubject(
    { name: item.name, code: item.code, type: "Theory" },
    currentSubjects
  );

  if (matched) {
    const updates = {
      presentClasses: attended,
      absentClasses: Math.max(0, conducted - attended),
      baselinePercentage: item.percentage,
      name: item.name.length > matched.name.length ? item.name : matched.name,
      facultyName: item.faculty,
    };
    const updatedSub = { ...matched, ...updates, updatedAt: Date.now() };
    firestoreSaves[matched.id] = updatedSub;
    currentSubjects = currentSubjects.map((s) => (s.id === matched.id ? updatedSub : s));
  } else {
    const newSub: Subject = {
      id: `sub-new-${Date.now()}`,
      userId: "usr-test",
      semesterId: "sem-fall-2026",
      name: item.name,
      code: item.code,
      facultyName: item.faculty,
      colorValue: "#00F2FE",
      type: "Theory",
      targetAttendance: 75,
      presentClasses: attended,
      absentClasses: Math.max(0, conducted - attended),
      baselinePercentage: item.percentage,
      status: "Active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    firestoreSaves[newSub.id] = newSub;
    currentSubjects.push(newSub);
  }
}

// Verification 1: OS is matched and updated in memory and mock Firestore
const os = currentSubjects.find(s => s.code === "CS401");
assert(Boolean(os), "Operating Systems exists in updated subjects");
assert(os?.name === "Operating Systems", "OS abbreviation upgraded to 'Operating Systems'");
assert(os?.presentClasses === 18, "Operating Systems attended updated to 18");
assert(os?.absentClasses === 8, "Operating Systems absent updated to 8 (26 - 18)");
assert(firestoreSaves["sub-os-1"]?.presentClasses === 18, "Firestore received the updated presentClasses for OS");

// Verification 2: AJP is matched and updated
const ajp = currentSubjects.find(s => s.code === "CS402");
assert(Boolean(ajp), "Advanced Java Programming exists in updated subjects");
assert(ajp?.presentClasses === 22, "AJP attended updated to 22");
assert(ajp?.absentClasses === 3, "AJP absent updated to 3 (25 - 22)");

// Verification 3: Computer Networks was newly created and tracked
const cn = currentSubjects.find(s => s.code === "CS403");
assert(Boolean(cn), "Newly extracted Computer Networks subject created");
assert(cn?.presentClasses === 15 && cn?.absentClasses === 3, "Computer Networks has 15 attended and 3 absent");

// Verification 4: Compute Metrics for updated subjects
const osUpdatedMetrics = computeMetrics(
  os!.presentClasses,
  os!.presentClasses + os!.absentClasses,
  os!.targetAttendance
);
assert(osUpdatedMetrics.percentage === 69.23, `OS percentage computed accurately as 69.23% (got ${osUpdatedMetrics.percentage}%)`);
assert(osUpdatedMetrics.attended === 18, "OS metric attended is 18");
assert(osUpdatedMetrics.conducted === 26, "OS metric conducted is 26");
assert(osUpdatedMetrics.requiredRecovery === 6, `OS requires 6 sessions to reach 75% target (got ${osUpdatedMetrics.requiredRecovery})`);

// Verification 5: Timetable Period Resolution
// In /attendance and /calendar, periods match using subjectId
const period1 = timetableEntries.find(t => t.id === "tt-mon-1");
const period1Sub = currentSubjects.find(s => s.id === period1?.subjectId);
assert(period1Sub?.name === "Operating Systems", "Timetable Period 1 resolved to 'Operating Systems'");
const period1Metrics = computeMetrics(
  period1Sub!.presentClasses,
  period1Sub!.presentClasses + period1Sub!.absentClasses,
  period1Sub!.targetAttendance
);
assert(period1Metrics.percentage === 69.23, "Timetable Period 1 card displays 69.23% live attendance");

console.log(`\nRESULTS: ${passed} / ${total} tests passed.`);
if (passed === total) {
  console.log("ALL TESTS PASSED! Re-upload attendance and timetable sync verified successfully.");
} else {
  process.exit(1);
}
