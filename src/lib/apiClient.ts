import {
  UserProfile,
  Subject,
  TimetableEntry,
  AttendanceRecord,
  CourseGradeItem,
  AcademicEventItem,
  OnboardingState,
} from "@/types/trackx";
import { auth } from "@/lib/firebase";

async function getAuthHeaders(extraHeaders?: HeadersInit, skipAuth = false): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(extraHeaders as Record<string, string>),
  };

  if (!skipAuth && typeof window !== "undefined") {
    try {
      if (!auth.currentUser) {
        await auth.authStateReady();
      }
      const currentUser = auth.currentUser;
      if (currentUser) {
        const token = await currentUser.getIdToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      }
    } catch (err) {
      console.warn("Could not retrieve Firebase ID token:", err);
    }
  }

  return headers;
}

export const apiClient = {
  async register(params: {
    email: string;
    password: string;
    name?: string;
    branch?: string;
    semester?: number;
    userId?: string;
  }): Promise<{ success: boolean; user: UserProfile }> {
    const headers = await getAuthHeaders(undefined, true); // user not yet authenticated
    const res = await fetch("/api/auth", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "register", ...params }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");
    return data;
  },

  async login(params: {
    email: string;
    password: string;
  }): Promise<{ success: boolean; user: UserProfile }> {
    const headers = await getAuthHeaders(undefined, true); // user not yet authenticated
    const res = await fetch("/api/auth", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "login", ...params }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    return data;
  },

  async syncFirebaseUser(params: {
    userId: string;
    email: string;
    name?: string;
    onboardingCompleted?: boolean;
    onboardingState?: OnboardingState;
  }): Promise<{ success: boolean; user: UserProfile }> {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/auth", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "sync_firebase", ...params }),
    });
    return res.json();
  },

  async logout(): Promise<void> {
    const headers = await getAuthHeaders();
    await fetch("/api/auth", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "logout" }),
    });
  },

  async getSession(userId?: string): Promise<UserProfile | null> {
    const headers = await getAuthHeaders();
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const res = await fetch(`/api/auth${query}`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user || null;
  },

  async updateProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/profile", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, ...updates }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update profile");
    return data.user;
  },

  // Subjects
  async getSubjects(userId: string): Promise<Subject[]> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/subjects?userId=${encodeURIComponent(userId)}`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.subjects || [];
  },

  async saveSubject(userId: string, subject: Partial<Subject>): Promise<Subject> {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/subjects", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, ...subject }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save subject");
    return data.subject;
  },

  async deleteSubject(userId: string, subjectId: string): Promise<void> {
    const headers = await getAuthHeaders();
    await fetch(`/api/subjects?userId=${encodeURIComponent(userId)}&subjectId=${encodeURIComponent(subjectId)}`, {
      method: "DELETE",
      headers,
    });
  },

  // Timetable
  async getTimetable(userId: string): Promise<TimetableEntry[]> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/timetable?userId=${encodeURIComponent(userId)}`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.timetable || [];
  },

  async saveTimetableEntry(userId: string, entry: Partial<TimetableEntry>): Promise<TimetableEntry> {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/timetable", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, ...entry }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to save timetable slot");
    return data.entry;
  },

  async batchSaveTimetable(userId: string, entries: TimetableEntry[], replace: boolean = false): Promise<void> {
    const headers = await getAuthHeaders();
    await fetch("/api/timetable", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, entries, replace }),
    });
  },

  async deleteTimetableEntry(userId: string, entryId: string): Promise<void> {
    const headers = await getAuthHeaders();
    await fetch(`/api/timetable?userId=${encodeURIComponent(userId)}&entryId=${encodeURIComponent(entryId)}`, {
      method: "DELETE",
      headers,
    });
  },

  async clearDaySchedule(userId: string, dayOfWeek: number): Promise<void> {
    const headers = await getAuthHeaders();
    await fetch(`/api/timetable?userId=${encodeURIComponent(userId)}&dayOfWeek=${dayOfWeek}`, {
      method: "DELETE",
      headers,
    });
  },

  // Attendance Records
  async getRecords(userId: string): Promise<AttendanceRecord[]> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/records?userId=${encodeURIComponent(userId)}`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.records || [];
  },

  async markAttendance(userId: string, record: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/records", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, ...record }),
    });
    const data = await res.json();
    return data.record;
  },

  async unmarkAttendance(
    userId: string,
    subjectId: string,
    date: string,
    periodNumber?: number,
    durationHours: number = 1
  ): Promise<void> {
    const headers = await getAuthHeaders();
    await fetch("/api/records", {
      method: "DELETE",
      headers,
      body: JSON.stringify({ userId, subjectId, date, periodNumber, durationHours }),
    });
  },

  // CGPA Grades
  async getGrades(userId: string): Promise<CourseGradeItem[]> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/grades?userId=${encodeURIComponent(userId)}`, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return data.grades || [];
  },

  async saveGrade(userId: string, grade: Partial<CourseGradeItem>): Promise<CourseGradeItem> {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/grades", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, ...grade }),
    });
    const data = await res.json();
    return data.grade;
  },

  async deleteGrade(userId: string, gradeId: string): Promise<void> {
    const headers = await getAuthHeaders();
    await fetch(`/api/grades?userId=${encodeURIComponent(userId)}&gradeId=${encodeURIComponent(gradeId)}`, {
      method: "DELETE",
      headers,
    });
  },

  // Calendar Events, Holidays, Substitutes
  async getEventsAndOverrides(
    userId: string
  ): Promise<{
    events: AcademicEventItem[];
    holidays: Record<string, boolean>;
    substitutes: Record<string, string>;
  }> {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/events?userId=${encodeURIComponent(userId)}`, { headers });
    if (!res.ok) return { events: [], holidays: {}, substitutes: {} };
    return res.json();
  },

  async saveEvent(userId: string, event: Partial<AcademicEventItem>): Promise<AcademicEventItem> {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/events", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, ...event }),
    });
    const data = await res.json();
    return data.event;
  },

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    const headers = await getAuthHeaders();
    await fetch(`/api/events?userId=${encodeURIComponent(userId)}&eventId=${encodeURIComponent(eventId)}`, {
      method: "DELETE",
      headers,
    });
  },

  async toggleHoliday(userId: string, dateKey: string, explicitValue?: boolean): Promise<Record<string, boolean>> {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/events", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, type: "toggle_holiday", dateKey, explicitValue }),
    });
    const data = await res.json();
    return data.holidays || {};
  },

  async resetHoliday(userId: string, dateKey: string): Promise<Record<string, boolean>> {
    const headers = await getAuthHeaders();
    const res = await fetch("/api/events", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, type: "reset_holiday", dateKey }),
    });
    const data = await res.json();
    return data.holidays || {};
  },


  async setSubstitute(userId: string, swapKey: string, subjectId: string): Promise<void> {
    const headers = await getAuthHeaders();
    await fetch("/api/events", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, type: "set_substitute", swapKey, subjectId }),
    });
  },

  async removeSubstitute(userId: string, swapKey: string): Promise<void> {
    const headers = await getAuthHeaders();
    await fetch(`/api/events?userId=${encodeURIComponent(userId)}&swapKey=${encodeURIComponent(swapKey)}`, {
      method: "DELETE",
      headers,
    });
  },

  // Unified Full Sync
  async fullSync(userId: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/sync?userId=${encodeURIComponent(userId)}`, { headers });
    if (!res.ok) return null;
    return res.json();
  },

  // AI OCR Extraction
  async extractAttendance(file: File): Promise<{
    subjects: Array<{
      subjectCode: string | null;
      subjectName: string;
      faculty?: string | null;
      attended: number | null;
      conducted: number | null;
      percentage: number | null;
    }>;
    overall: {
      attended: number | null;
      conducted: number | null;
      percentage: number | null;
    };
    confidence: number;
    warnings: string[];
  }> {
    let authHeader = "";
    if (typeof window !== "undefined") {
      if (!auth.currentUser) await auth.authStateReady();
      const token = await auth.currentUser?.getIdToken();
      if (token) authHeader = `Bearer ${token}`;
    }

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/ai/extract-attendance", {
      method: "POST",
      headers: authHeader ? { Authorization: authHeader } : {},
      body: formData,
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || "Failed to extract attendance data");
    }
    return json.data;
  },

  async extractTimetable(file: File): Promise<{
    entries: Array<{
      day: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      startTimeMinutes: number;
      endTimeMinutes: number;
      durationMinutes: number;
      isContinuous: boolean;
      isContinuousLab?: boolean;
      subjectCode: string | null;
      subjectName: string;
      displayName?: string;
      faculty: string | null;
      location: string | null;
      classType: "lecture" | "lab" | "activity" | "training" | "other";
      type?: "lecture" | "lab" | "break" | "lunch" | "free" | "activity" | "other";
      confidence: number;
      warnings: string[];
      requiresReview: boolean;
      possibleSubjects?: string[];
      sourceText?: string;
    }>;
    mappings?: Array<{
      abbreviation: string;
      fullName: string;
      faculty: string | null;
      location: string | null;
    }>;
    warnings: string[];
  }> {
    let authHeader = "";
    if (typeof window !== "undefined") {
      if (!auth.currentUser) await auth.authStateReady();
      const token = await auth.currentUser?.getIdToken();
      if (token) authHeader = `Bearer ${token}`;
    }

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/ai/extract-timetable", {
      method: "POST",
      headers: authHeader ? { Authorization: authHeader } : {},
      body: formData,
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || "Failed to extract timetable data");
    }
    return json.data;
  },
};
