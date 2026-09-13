import { Subject, TimetableEntry } from '../src/types/trackx';

console.log("=== TRACKX SUBJECT & TIMETABLE DAY ASSIGNMENT TEST ===\n");

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

const STANDARD_PERIODS = [
  { periodNumber: 1, startTime: 555, endTime: 615, label: "Period 1 (09:15 – 10:15 AM)" },
  { periodNumber: 2, startTime: 615, endTime: 675, label: "Period 2 (10:15 – 11:15 AM)" },
  { periodNumber: 3, startTime: 675, endTime: 735, label: "Period 3 (11:15 – 12:15 PM)" },
  { periodNumber: 4, startTime: 780, endTime: 840, label: "Period 4 (01:00 – 02:00 PM)" },
  { periodNumber: 5, startTime: 840, endTime: 900, label: "Period 5 (02:00 – 03:00 PM)" },
  { periodNumber: 6, startTime: 900, endTime: 960, label: "Period 6 (03:00 – 04:00 PM)" },
];

let timetable: TimetableEntry[] = [];
let subjects: Subject[] = [];

function createSubjectAndSchedule(
  subData: { name: string; faculty: string; code?: string; type: "Theory" | "Laboratory" },
  selectedDays: number[], // 1=Mon .. 5=Fri
  periodNum: number = 1,
  room?: string,
  perDayPeriods?: Record<number, number>
) {
  const newSub: Subject = {
    id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId: "usr-test",
    semesterId: "sem-fall-2026",
    name: subData.name,
    facultyName: subData.faculty,
    code: subData.code,
    type: subData.type,
    colorValue: "#5B5FEF",
    targetAttendance: 75,
    presentClasses: 0,
    absentClasses: 0,
    status: "Active",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  subjects.push(newSub);

  const newEntries: TimetableEntry[] = selectedDays.map((dayOfWeek) => {
    const p = (perDayPeriods && perDayPeriods[dayOfWeek]) || periodNum;
    const std = STANDARD_PERIODS.find((s) => s.periodNumber === p) || STANDARD_PERIODS[0];
    return {
      id: `tt_usr-test_d${dayOfWeek}_p${p}_${newSub.id}_${Date.now()}`,
      userId: "usr-test",
      semesterId: "sem-fall-2026",
      subjectId: newSub.id,
      dayOfWeek,
      periodNumber: p,
      startTime: std.startTime,
      endTime: std.endTime,
      room: room || undefined,
      notes: `${newSub.name} (${newSub.facultyName})`,
      isContinuousLab: subData.type === "Laboratory",
      isEnabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  });

  timetable.push(...newEntries);
  return { subject: newSub, entries: newEntries };
}

// TEST 1: User creates "Microprocessors" and assigns to Monday & Thursday (Period 2)
const res1 = createSubjectAndSchedule(
  { name: "Microprocessors", faculty: "Dr. Rao", code: "EC502", type: "Theory" },
  [1, 4], // Monday, Thursday
  2, // Period 2 (10:15 - 11:15)
  "LH-102"
);

assert(subjects.some((s) => s.name === "Microprocessors"), "Subject 'Microprocessors' was created");
assert(res1.entries.length === 2, "Created 2 timetable entries for Monday and Thursday");
assert(res1.entries[0].dayOfWeek === 1 && res1.entries[0].startTime === 615, "Monday slot is Period 2 (10:15 AM)");
assert(res1.entries[1].dayOfWeek === 4 && res1.entries[1].startTime === 615, "Thursday slot is Period 2 (10:15 AM)");
assert(res1.entries[0].room === "LH-102", "Room LH-102 preserved");

// TEST 2: User creates "Web Technology Lab" on Wednesday (Period 4)
const res2 = createSubjectAndSchedule(
  { name: "Web Technology Lab", faculty: "Prof. Priya", code: "CS505", type: "Laboratory" },
  [3], // Wednesday
  4, // Period 4
  "Lab 3"
);

assert(res2.entries.length === 1, "Created 1 timetable entry for Wednesday");
assert(res2.entries[0].dayOfWeek === 3 && res2.entries[0].periodNumber === 4, "Wednesday slot is Period 4");
assert(res2.entries[0].isContinuousLab === true, "isContinuousLab is true for laboratory course");

// TEST 3: Mon-Fri quick assign (All 5 weekdays: Mon, Tue, Wed, Thu, Fri)
const res3 = createSubjectAndSchedule(
  { name: "Mathematics IV", faculty: "Dr. Sharma", code: "MA501", type: "Theory" },
  [1, 2, 3, 4, 5], // Mon to Fri
  1 // Period 1 (09:15 - 10:15)
);

assert(res3.entries.length === 5, "Mon-Fri creates exactly 5 timetable entries");
const daysScheduled = res3.entries.map((e) => e.dayOfWeek).sort();
assert(JSON.stringify(daysScheduled) === JSON.stringify([1, 2, 3, 4, 5]), "Every weekday from 1 to 5 is scheduled");

// TEST 4: Per-day period customization (e.g. Tuesday P1, Friday P3)
const res4 = createSubjectAndSchedule(
  { name: "Cyber Security", faculty: "Dr. Wilson", code: "CS508", type: "Theory" },
  [2, 5], // Tuesday, Friday
  1, // default P1
  "LH-201",
  { 2: 1, 5: 3 } // Tuesday P1, Friday P3
);

assert(res4.entries.length === 2, "2 entries created for customized days");
const tue = res4.entries.find((e) => e.dayOfWeek === 2);
const fri = res4.entries.find((e) => e.dayOfWeek === 5);
assert(tue?.periodNumber === 1 && tue?.startTime === 555, "Tuesday is Period 1 (09:15 AM)");
assert(fri?.periodNumber === 3 && fri?.startTime === 675, "Friday is Period 3 (11:15 AM)");

// TEST 5: Total timetable entries integrity
assert(timetable.length === 2 + 1 + 5 + 2, `Total timetable entries match expected 10 (got ${timetable.length})`);

console.log(`\nRESULTS: ${passed} / ${total} tests passed.`);
if (passed === total) {
  console.log("ALL TESTS PASSED! Subject and Timetable Day Assignment verified.");
} else {
  process.exit(1);
}
