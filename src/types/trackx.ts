/**
 * TrackX Entity Types & Schemas
 * Standardized across Web and Mobile Firestore parity
 */

export type RiskStatus = 'healthy' | 'attention' | 'critical';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
export type FirestoreConnectionStatus = 'loading' | 'connected' | 'unavailable' | 'permission-denied' | 'error';
export type ProfileStatus = 'loading' | 'loaded' | 'missing';
export type OnboardingStatus = 'loading' | 'incomplete' | 'complete';

export interface OnboardingState {
  profileCompleted: boolean;
  attendanceBaselineCompleted: boolean;
  timetableCompleted: boolean;
  completed: boolean;
  currentStep?: 'profile' | 'attendance' | 'timetable' | 'complete';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  branch: string;
  semester: number;
  globalTarget: number; // default 75.0
  themeMode: 'dark' | 'light' | 'system';
  themeColorPack?: string;
  collegeName?: string;
  registrationNumber?: string;
  programmeName?: string;
  joiningYear?: number;
  expectedGraduationYear?: number;
  currentSemesterId?: string;
  onboardingCompleted: boolean;
  onboardingState?: OnboardingState;
  createdTimestamp: number;
  updatedTimestamp: number;
}

export type SubjectType =
  | 'Theory'
  | 'Laboratory'
  | 'Project'
  | 'Elective'
  | 'Internship'
  | 'Seminar'
  | 'Workshop'
  | 'Custom';

export interface Subject {
  id: string;
  userId: string;
  semesterId: string;
  name: string;
  code?: string;
  facultyName: string;
  colorValue: string; // hex color or preset key
  type: SubjectType;
  credits?: number;
  weeklyPeriods?: number;
  targetAttendance: number; // e.g. 75
  presentClasses: number;
  absentClasses: number;
  baselinePercentage?: number | null;
  countsUnavailable?: boolean;
  status: 'Active' | 'Completed' | 'Archived';
  expectedDifficulty?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  semesterId?: string;
  subjectId: string;
  date: string; // ISO String (YYYY-MM-DD or full timestamp)
  periodNumber?: number; // 1 to 6
  status: 'present' | 'absent';
  source?: 'manual' | 'scanner' | 'timetable';
  isProxySubstitute?: boolean;
  durationHours?: number;
  notes?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface TimetableEntry {
  id: string;
  userId: string;
  semesterId: string;
  subjectId: string;
  dayOfWeek: number; // 1 = Monday, 2 = Tuesday ... 6 = Saturday, 7 = Sunday
  periodNumber: number; // 1 to 6
  startTime: number; // Minutes from midnight (e.g. 540 for 9:00 AM)
  endTime: number; // Minutes from midnight (e.g. 600 for 10:00 AM)
  room?: string;
  notes?: string;
  isContinuousLab?: boolean; // For 2-hour or merged periods
  isContinuous?: boolean;
  durationMinutes?: number;
  requiresReview?: boolean;
  reviewReason?: string;
  faculty?: string;
  subjectName?: string;
  subjectCode?: string;
  classType?: string;
  isEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Semester {
  id: string;
  userId: string;
  name: string;
  semesterNumber: number;
  academicYear: string;
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Upcoming' | 'Completed' | 'Archived';
  attendanceTarget: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AcademicEvent {
  id: string;
  title: string;
  date: string;
  type: 'holiday' | 'exam' | 'working_day' | 'event';
  description?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: number;
  type: 'warning' | 'reminder' | 'achievement' | 'info';
  isRead: boolean;
  actionUrl?: string;
}

export interface CourseGradeItem {
  id: string;
  userId?: string;
  name: string;
  credits: number;
  grade: string;
  points: number;
  updatedAt?: number;
}

export interface AcademicEventItem {
  id: string;
  userId?: string;
  dateKey: string;
  title: string;
  type: 'working' | 'holiday' | 'exam' | 'attendance_due';
  updatedAt?: number;
}
