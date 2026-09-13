import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser, handleAuthError } from "@/lib/serverAuth";
import { getAllUsersAdmin } from "@/lib/serverDb";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    await requireAdminUser(req);
    const users = await getAllUsersAdmin();

    return NextResponse.json({
      success: true,
      users,
    });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
