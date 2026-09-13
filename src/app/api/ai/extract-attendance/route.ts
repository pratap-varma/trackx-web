import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser, handleAuthError } from "@/lib/serverAuth";
import {
  extractAttendanceFromImage,
  GeminiServiceError,
} from "@/lib/serverGemini";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce Stage 2 Token Authentication
    const authUser = await requireAuthenticatedUser(req);

    // 2. Parse multipart form data
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { error: "Invalid multipart form data" },
        { status: 400 }
      );
    }

    const file = (formData.get("file") || formData.get("image")) as File | null;
    if (!file) {
      return NextResponse.json(
        { error: "No image file provided. Field 'file' or 'image' is required." },
        { status: 400 }
      );
    }

    // 3. Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || "image/png";

    // 4. Run Gemini Vision extraction
    const result = await extractAttendanceFromImage(buffer, mimeType);

    const { logUserActivity } = await import("@/lib/serverDb");
    await logUserActivity({
      userId: authUser.uid,
      userEmail: authUser.email,
      action: "ocr_scan",
      details: {
        type: "attendance_ledger",
        subjectsFound: result.subjects?.length || 0,
        overallPercentage: result.overall?.percentage,
      },
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: unknown) {
    if (err instanceof GeminiServiceError) {
      return NextResponse.json(
        {
          error: err.message,
          message: err.message,
          code: err.code,
          stage: err.stage,
        },
        { status: err.status }
      );
    }
    return handleAuthError(err);
  }
}
