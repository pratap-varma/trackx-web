import { NextRequest, NextResponse } from "next/server";
import {
  findUserById,
  getUserSubjects,
  getUserTimetable,
  getUserRecords,
  getUserGrades,
  getUserEvents,
  getUserSubstitutes,
  getUserHolidays,
  sanitizeUser,
} from "@/lib/serverDb";
import {
  requireAuthenticatedUser,
  validateResourceOwnership,
  handleAuthError,
} from "@/lib/serverAuth";

export async function GET(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);
    const requestedUserId = req.nextUrl.searchParams.get("userId");
    validateResourceOwnership(uid, requestedUserId);

    const [user, subjects, timetable, records, grades, events, substitutes, holidays] =
      await Promise.all([
        findUserById(uid),
        getUserSubjects(uid),
        getUserTimetable(uid),
        getUserRecords(uid),
        getUserGrades(uid),
        getUserEvents(uid),
        getUserSubstitutes(uid),
        getUserHolidays(uid),
      ]);

    return NextResponse.json({
      user: sanitizeUser(user),
      subjects,
      timetable,
      records,
      grades,
      events,
      substitutes,
      holidays,
    });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
