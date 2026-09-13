import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser, handleAuthError } from "@/lib/serverAuth";
import { clearUserStudentData } from "@/lib/serverDb";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser(req);
    await clearUserStudentData(admin.uid);
    return NextResponse.json({
      success: true,
      message: "Admin student mock/previous data cleared successfully",
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
