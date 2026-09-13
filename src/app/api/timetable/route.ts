import { NextRequest, NextResponse } from "next/server";
import {
  getUserTimetable,
  saveTimetableEntry,
  batchSaveTimetableEntries,
  replaceUserTimetableEntries,
  removeTimetableEntry,
  clearDayScheduleInDb,
  logUserActivity,
} from "@/lib/serverDb";
import { TimetableEntry } from "@/types/trackx";
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

    const timetable = await getUserTimetable(uid);
    return NextResponse.json({ timetable });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);
    const body = await req.json();
    validateResourceOwnership(uid, body.userId);

    if (Array.isArray(body.entries)) {
      // Deduplicate deterministically by slot key
      const dedupeMap = new Map<string, TimetableEntry>();
      for (const e of body.entries) {
        const normSub = (e.subjectId || e.notes || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const slotKey = `tt_${e.dayOfWeek}_${e.startTime}_${e.endTime}_${normSub}`;
        const id = e.id || `tt_${uid}_d${e.dayOfWeek}_${e.startTime}_${e.endTime}_${normSub}`;
        dedupeMap.set(slotKey, {
          ...e,
          id,
          userId: uid,
          semesterId: e.semesterId || `sem-${uid}`,
          updatedAt: Date.now(),
        } as TimetableEntry);
      }
      const sanitizedEntries = Array.from(dedupeMap.values());

      if (body.replace === true) {
        await replaceUserTimetableEntries(uid, sanitizedEntries);
      } else {
        await batchSaveTimetableEntries(uid, sanitizedEntries);
      }

      await logUserActivity({
        userId: uid,
        action: "timetable_update",
        details: { count: sanitizedEntries.length, replace: body.replace === true },
      });

      return NextResponse.json({ success: true, count: sanitizedEntries.length });
    }

    const entry: TimetableEntry = {
      id: body.id || `tt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: uid,
      semesterId: body.semesterId || `sem-${uid}`,
      subjectId: body.subjectId,
      dayOfWeek: body.dayOfWeek,
      periodNumber: body.periodNumber,
      startTime: body.startTime,
      endTime: body.endTime,
      room: body.room,
      notes: body.notes,
      isContinuousLab: body.isContinuousLab,
      isEnabled: body.isEnabled !== undefined ? body.isEnabled : true,
      createdAt: body.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    const saved = await saveTimetableEntry(entry);
    await logUserActivity({
      userId: uid,
      action: "timetable_update",
      details: {
        entryId: saved.id,
        dayOfWeek: saved.dayOfWeek,
        periodNumber: saved.periodNumber,
        subjectId: saved.subjectId,
      },
    });

    return NextResponse.json({ success: true, entry: saved });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);
    const requestedUserId = req.nextUrl.searchParams.get("userId");
    validateResourceOwnership(uid, requestedUserId);

    const entryId = req.nextUrl.searchParams.get("entryId");
    const dayOfWeek = req.nextUrl.searchParams.get("dayOfWeek");

    if (dayOfWeek !== null && dayOfWeek !== undefined) {
      await clearDayScheduleInDb(uid, parseInt(dayOfWeek));
      await logUserActivity({
        userId: uid,
        action: "timetable_update",
        details: { action: "clear_day", dayOfWeek: parseInt(dayOfWeek) },
      });
      return NextResponse.json({ success: true });
    }

    if (entryId) {
      await removeTimetableEntry(uid, entryId);
      await logUserActivity({
        userId: uid,
        action: "timetable_update",
        details: { action: "delete_slot", entryId },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "entryId or dayOfWeek required" }, { status: 400 });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
