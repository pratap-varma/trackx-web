import { NextRequest, NextResponse } from "next/server";
import { getUserSubjects, saveSubject, removeSubject } from "@/lib/serverDb";
import { Subject } from "@/types/trackx";
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

    const subjects = await getUserSubjects(uid);
    return NextResponse.json({ subjects });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);
    const body = await req.json();
    validateResourceOwnership(uid, body.userId);

    const subject: Subject = {
      id: body.id || `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: uid,
      semesterId: body.semesterId || `sem-${uid}`,
      name: body.name,
      code: body.code,
      facultyName: body.facultyName || "Faculty",
      colorValue: body.colorValue || "#5B5FEF",
      type: body.type || "Theory",
      credits: body.credits || 3,
      weeklyPeriods: body.weeklyPeriods || 3,
      targetAttendance: body.targetAttendance || 75,
      presentClasses: body.presentClasses || 0,
      absentClasses: body.absentClasses || 0,
      status: body.status || "Active",
      createdAt: body.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    const saved = await saveSubject(subject);
    return NextResponse.json({ success: true, subject: saved });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);
    const requestedUserId = req.nextUrl.searchParams.get("userId");
    validateResourceOwnership(uid, requestedUserId);

    const subjectId = req.nextUrl.searchParams.get("subjectId");
    if (!subjectId) {
      return NextResponse.json({ error: "subjectId is required" }, { status: 400 });
    }

    await removeSubject(uid, subjectId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
