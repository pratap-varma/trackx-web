import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser, handleAuthError } from "@/lib/serverAuth";
import { getUserDeepDiveAdmin, updateUserAdmin, deleteUserAdmin } from "@/lib/serverDb";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminUser(req);
    const { id } = await params;

    const data = await getUserDeepDiveAdmin(id);
    if (!data.user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminUser(req);
    const { id } = await params;
    const body = await req.json();

    const updated = await updateUserAdmin(id, body);
    return NextResponse.json({ success: true, user: updated });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminUser(req);
    const { id } = await params;

    await deleteUserAdmin(id);
    return NextResponse.json({ success: true, message: `User ${id} and all related records deleted.` });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
