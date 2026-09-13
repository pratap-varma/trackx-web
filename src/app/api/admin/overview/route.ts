import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser, handleAuthError } from "@/lib/serverAuth";
import { getAllUsersAdmin, getRecentActivityLogs } from "@/lib/serverDb";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    const [users, activities] = await Promise.all([
      getAllUsersAdmin(),
      getRecentActivityLogs(60),
    ]);

    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const activeToday = users.filter((u) => (u.lastActiveTimestamp || 0) > oneDayAgo).length;
    const totalAttendanceRecords = users.reduce((acc, u) => acc + (u.attendanceCount || 0), 0);
    const totalSubjects = users.reduce((acc, u) => acc + (u.subjectsCount || 0), 0);

    return NextResponse.json({
      success: true,
      adminEmail: admin.email,
      metrics: {
        totalUsers: users.length,
        activeToday,
        totalAttendanceRecords,
        totalSubjects,
      },
      recentActivities: activities,
    });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
