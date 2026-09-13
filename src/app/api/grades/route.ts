import { NextRequest, NextResponse } from "next/server";
import { getUserGrades, saveUserGrade, removeUserGrade } from "@/lib/serverDb";
import { CourseGradeItem } from "@/types/trackx";
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

    const grades = await getUserGrades(uid);
    return NextResponse.json({ grades });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);
    const body = await req.json();
    validateResourceOwnership(uid, body.userId);

    const grade: CourseGradeItem = {
      id: body.id || `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: uid,
      name: body.name,
      credits: body.credits || 3,
      grade: body.grade || "O",
      points: body.points !== undefined ? body.points : 10.0,
      updatedAt: Date.now(),
    };

    const saved = await saveUserGrade(uid, grade);
    return NextResponse.json({ success: true, grade: saved });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);
    const requestedUserId = req.nextUrl.searchParams.get("userId");
    validateResourceOwnership(uid, requestedUserId);

    const gradeId = req.nextUrl.searchParams.get("gradeId");
    if (!gradeId) {
      return NextResponse.json({ error: "gradeId required" }, { status: 400 });
    }

    await removeUserGrade(uid, gradeId);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
