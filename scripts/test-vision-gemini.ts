import { GoogleGenAI, Schema, Type } from "@google/genai";
import { execSync } from "child_process";

// Simple PNG with text encoded or drawn
async function testAttendanceExtraction() {
  let key = process.env.GEMINI_API_KEY;
  if (!key || key.length <= 10) {
    try {
      key = execSync("powershell -NoProfile -Command \"[System.Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User')\"", { encoding: "utf8" }).trim();
    } catch {}
  }

  const ai = new GoogleGenAI({ apiKey: key });

  // 1x1 test or let's create a small SVG/PNG with attendance data
  // We can convert an SVG with text into PNG using a canvas or send directly if image/png
  // Let's test with a minimal valid PNG
  const samplePngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

  const attendanceResponseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      subjects: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            subjectCode: { type: Type.STRING, nullable: true },
            subjectName: { type: Type.STRING },
            faculty: { type: Type.STRING, nullable: true },
            attended: { type: Type.INTEGER, nullable: true },
            conducted: { type: Type.INTEGER, nullable: true },
            percentage: { type: Type.NUMBER, nullable: true },
          },
          required: ["subjectName"],
        },
      },
      overall: {
        type: Type.OBJECT,
        properties: {
          attended: { type: Type.INTEGER, nullable: true },
          conducted: { type: Type.INTEGER, nullable: true },
          percentage: { type: Type.NUMBER, nullable: true },
        },
      },
      confidence: { type: Type.NUMBER },
      warnings: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
    required: ["subjects", "confidence", "warnings"],
  };

  try {
    const res = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              inlineData: {
                mimeType: "image/png",
                data: samplePngBase64,
              },
            },
            {
              text: "Extract student attendance records. If no text is visible in this blank image, return empty subjects with a warning.",
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: attendanceResponseSchema,
        temperature: 0.1,
      },
    });

    console.log("VISION OCR RESPONSE STATUS: SUCCESS!");
    console.log("Response text:", res.text);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("VISION OCR ERROR:", msg);
  }
}

testAttendanceExtraction();
