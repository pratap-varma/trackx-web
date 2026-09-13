import { NextRequest, NextResponse } from "next/server";
import { getUserRecords, addAttendanceRecord, removeAttendanceRecord } from "@/lib/serverDb";
import { AttendanceRecord } from "@/types/trackx";
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

    const records = await getUserRecords(uid);
    return NextResponse.json({ records });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);
    const body = await req.json();
    validateResourceOwnership(uid, body.userId);

    const record: AttendanceRecord = {
      id: body.id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: uid,
      semesterId: body.semesterId || `sem-${uid}`,
      subjectId: body.subjectId,
      date: body.date || new Date().toISOString(),
      periodNumber: body.periodNumber,
      status: body.status || "present",
      source: body.source || "manual",
      isProxySubstitute: body.isProxySubstitute,
      durationHours: body.durationHours || 1,
      createdAt: body.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    await addAttendanceRecord(record);
    return NextResponse.json({ success: true, record });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);
    const body = await req.json().catch(() => ({}));
    const requestedUserId = body.userId || req.nextUrl.searchParams.get("userId");
    validateResourceOwnership(uid, requestedUserId);

    const subjectId = body.subjectId || req.nextUrl.searchParams.get("subjectId");
    const date = body.date || req.nextUrl.searchParams.get("date");
    const periodNumber =
      body.periodNumber !== undefined ? body.periodNumber : req.nextUrl.searchParams.get("periodNumber");
    const durationHours = body.durationHours || 1;

    if (!subjectId || !date) {
      return NextResponse.json({ error: "subjectId and date required" }, { status: 400 });
    }

    await removeAttendanceRecord(
      uid,
      subjectId,
      date,
      periodNumber !== null && periodNumber !== undefined ? Number(periodNumber) : undefined,
      durationHours
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
