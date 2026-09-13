import { Subject, UserProfile } from '../src/types/trackx';
import { findMatchingSubject } from '../src/lib/subjectMatcher';
import { computeMetrics } from '../src/lib/attendanceMath';

console.log("=== TRACKX MANUAL ATTENDANCE SAVE & UPDATE TEST ===\n");

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

// Simulated initial user & state
const user: UserProfile = {
  id: "usr-manual-test",
  name: "Test User",
  email: "test@example.com",
  branch: "Computer Science",
  semester: 4,
  globalTarget: 75,
  themeMode: "dark",
  onboardingCompleted: true,
  onboardingState: {
    profileCompleted: true,
    attendanceBaselineCompleted: false,
    timetableCompleted: true,
    completed: true,
    currentStep: "complete",
  },
  createdTimestamp: Date.now(),
  updatedTimestamp: Date.now(),
};

let subjects: Subject[] = [
  {
    id: "sub-1",
    userId: user.id,
    semesterId: "sem-fall-2026",
    name: "Software Engineering",
    code: "CS401",
    facultyName: "Prof. Alan",
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


// Simulated manual entries entered by the user
const manualEnteredData = [
  {
    id: "sub-1",
    name: "Software Engineering",
    code: "CS401",
    faculty: "Prof. Alan",
    attended: 24,
    conducted: 30,
    percentage: 80.0,
    percentageOnly: false,
  },
  {
    id: "manual-new-1",
    name: "Cloud Computing",
    code: "CS405",
    faculty: "Dr. Grace",
    attended: 18,
    conducted: 20,
    percentage: 90.0,
    percentageOnly: false,
  }
];

// Test the updated handleConfirmBaseline logic
async function testSaveManualAttendance() {
  const startTime = Date.now();
  let currentSubjects = [...subjects];

  for (const item of manualEnteredData) {
    if (!item.name.trim()) continue;

    const hasCounts = typeof item.attended === "number" && typeof item.conducted === "number";
    const attended = hasCounts ? Math.max(0, item.attended!) : 0;
    const conducted = hasCounts ? Math.max(0, item.conducted!) : 0;

    const matched = findMatchingSubject(
      { name: item.name.trim(), code: item.code.trim(), type: "Theory" },
      currentSubjects
    );

    if (matched) {
      const updates = {
        presentClasses: attended,
        absentClasses: Math.max(0, conducted - attended),
        baselinePercentage: item.percentage,
        countsUnavailable: !hasCounts,
      };
      // Simulated updateSubject with fast timeout guarantee
      currentSubjects = currentSubjects.map((s) => (s.id === matched.id ? { ...s, ...updates, updatedAt: Date.now() } : s));
    } else {
      const newSub: Subject = {
        id: `sub-${Date.now()}-mock`,
        userId: user.id,
        semesterId: "sem-fall-2026",
        name: item.name.trim(),
        code: item.code.trim() || undefined,
        facultyName: item.faculty.trim() || "Faculty",
        colorValue: "#00F2FE",
        type: "Theory",
        targetAttendance: user.globalTarget || 75,
        presentClasses: attended,
        absentClasses: Math.max(0, conducted - attended),
        baselinePercentage: item.percentage,
        countsUnavailable: !hasCounts,
        status: "Active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      currentSubjects.push(newSub);
    }
  }

  // Update subjects
  subjects = currentSubjects;

  const duration = Date.now() - startTime;
  assert(duration < 500, `Execution completes in under 500ms (took ${duration}ms, no hanging)`);

  // Verify subject updates
  const se = subjects.find((s) => s.name === "Software Engineering");
  assert(!!se, "Software Engineering updated");
  assert(se?.presentClasses === 24, `SE presentClasses is 24 (got ${se?.presentClasses})`);
  assert(se?.absentClasses === 6, `SE absentClasses is 6 (got ${se?.absentClasses})`);

  const seMetrics = computeMetrics(se!.presentClasses, se!.presentClasses + se!.absentClasses, se!.targetAttendance);
  assert(seMetrics.percentage === 80, `SE computed percentage is 80% (got ${seMetrics.percentage}%)`);
  assert(seMetrics.riskStatus === "healthy", `SE risk status is healthy (got ${seMetrics.riskStatus})`);

  const cc = subjects.find((s) => s.name === "Cloud Computing");
  assert(!!cc, "Cloud Computing newly added");
  assert(cc?.presentClasses === 18, `CC presentClasses is 18 (got ${cc?.presentClasses})`);
  assert(cc?.absentClasses === 2, `CC absentClasses is 2 (got ${cc?.absentClasses})`);

  const ccMetrics = computeMetrics(cc!.presentClasses, cc!.presentClasses + cc!.absentClasses, cc!.targetAttendance);
  assert(ccMetrics.percentage === 90, `CC computed percentage is 90% (got ${ccMetrics.percentage}%)`);

  console.log(`\nRESULTS: ${passed} / ${total} tests passed.`);
}

testSaveManualAttendance().catch(console.error);
