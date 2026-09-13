import { NextRequest, NextResponse } from "next/server";
import {
  getUserEvents,
  saveUserEvent,
  removeUserEvent,
  getUserHolidays,
  toggleUserHoliday,
  resetUserHoliday,
  getUserSubstitutes,
  setUserSubstitute,
  removeUserSubstitute,
} from "@/lib/serverDb";
import { AcademicEventItem } from "@/types/trackx";
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

    const [events, holidays, substitutes] = await Promise.all([
      getUserEvents(uid),
      getUserHolidays(uid),
      getUserSubstitutes(uid),
    ]);

    return NextResponse.json({ events, holidays, substitutes });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);
    const body = await req.json();
    validateResourceOwnership(uid, body.userId);

    const { type: actionType } = body;

    // 1. Toggle Holiday
    if (actionType === "toggle_holiday") {
      const { dateKey, explicitValue } = body;
      if (!dateKey) return NextResponse.json({ error: "dateKey required" }, { status: 400 });
      const updatedHolidays = await toggleUserHoliday(uid, dateKey, explicitValue);
      return NextResponse.json({ success: true, holidays: updatedHolidays });
    }

    if (actionType === "reset_holiday") {
      const { dateKey } = body;
      if (!dateKey) return NextResponse.json({ error: "dateKey required" }, { status: 400 });
      const updatedHolidays = await resetUserHoliday(uid, dateKey);
      return NextResponse.json({ success: true, holidays: updatedHolidays });
    }

    // 2. Set Substitute
    if (actionType === "set_substitute") {
      const { swapKey, subjectId } = body;
      if (!swapKey || !subjectId) return NextResponse.json({ error: "swapKey and subjectId required" }, { status: 400 });
      await setUserSubstitute(uid, swapKey, subjectId);
      return NextResponse.json({ success: true });
    }

    // 3. Save Academic Event
    const event: AcademicEventItem = {
      id: body.id || `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: uid,
      dateKey: body.dateKey,
      title: body.title,
      type: body.type || "exam",
      updatedAt: Date.now(),
    };

    const saved = await saveUserEvent(uid, event);
    return NextResponse.json({ success: true, event: saved });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);
    const requestedUserId = req.nextUrl.searchParams.get("userId");
    validateResourceOwnership(uid, requestedUserId);

    const eventId = req.nextUrl.searchParams.get("eventId");
    const swapKey = req.nextUrl.searchParams.get("swapKey");

    if (swapKey) {
      await removeUserSubstitute(uid, swapKey);
      return NextResponse.json({ success: true });
    }

    if (eventId) {
      await removeUserEvent(uid, eventId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "eventId or swapKey required" }, { status: 400 });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
