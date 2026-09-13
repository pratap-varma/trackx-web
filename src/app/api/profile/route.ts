import { NextRequest, NextResponse } from "next/server";
import { findUserById, upsertUser, sanitizeUser } from "@/lib/serverDb";
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

    const user = await findUserById(uid);
    return NextResponse.json({ user: sanitizeUser(user) });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { uid } = await requireAuthenticatedUser(req);
    const body = await req.json();
    validateResourceOwnership(uid, body.userId);

    // Prevent client from injecting or overwriting passwordHash, salt, or user ID
    const safeUpdates = { ...body };
    delete safeUpdates.passwordHash;
    delete safeUpdates.salt;
    delete safeUpdates.id;
    delete safeUpdates.userId;

    const existing = await findUserById(uid);
    const updated = await upsertUser({
      ...(existing || {
        id: uid,
        name: body.name || "Student",
        email: body.email || "",
        branch: "Computer Science & Engineering",
        semester: 1,
        globalTarget: 75.0,
        themeMode: "dark",
        onboardingCompleted: false,
        onboardingState: {
          profileCompleted: false,
          attendanceBaselineCompleted: false,
          timetableCompleted: false,
          completed: false,
          currentStep: "profile",
        },
        createdTimestamp: Date.now(),
        updatedTimestamp: Date.now(),
      }),
      ...safeUpdates,
      id: uid,
      updatedTimestamp: Date.now(),
    });

    return NextResponse.json({ success: true, user: sanitizeUser(updated) });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
