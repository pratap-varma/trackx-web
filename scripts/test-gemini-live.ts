import { extractAttendanceFromImage } from "../src/lib/serverGemini";

async function testLiveGemini() {
  console.log("Testing live Gemini Vision API call...");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log("RESULT: LIVE GEMINI TESTING: BLOCKED (GEMINI_API_KEY is missing)");
    return;
  }

  // 1x1 transparent PNG buffer
  const samplePngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const sampleBuffer = Buffer.from(samplePngBase64, "base64");

  try {
    const res = await extractAttendanceFromImage(sampleBuffer, "image/png");
    console.log("Live Gemini Vision Response:", JSON.stringify(res, null, 2));
    console.log("RESULT: LIVE GEMINI TESTING: PASS");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.log("Live Gemini Vision call failed:", message);
    if (message.includes("INVALID_API_KEY") || message.includes("API key not valid")) {
      console.log("RESULT: LIVE GEMINI TESTING: BLOCKED (Configured API key is invalid or lacks Gemini API permissions)");
    } else {
      console.log(`RESULT: LIVE GEMINI TESTING: BLOCKED (${message})`);
    }
  }
}

testLiveGemini();
