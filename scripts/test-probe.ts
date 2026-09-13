import { GoogleGenAI } from "@google/genai";
import { execSync } from "child_process";

async function probeModels() {
  let key = process.env.GEMINI_API_KEY;
  if (!key || key.length <= 1) {
    try {
      key = execSync("powershell -NoProfile -Command \"[System.Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User')\"", { encoding: "utf8" }).trim();
    } catch {}
  }

  const ai = new GoogleGenAI({ apiKey: key });

  const modelsToTry = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-2.0-flash-exp",
    "gemini-3.6-flash",
  ];

  for (const model of modelsToTry) {
    console.log(`Testing model: ${model}...`);
    try {
      const res = await ai.models.generateContent({
        model,
        contents: "Respond with 'SUCCESS' if active.",
      });
      console.log(`  -> ${model}: SUCCESS! Text:`, res.text?.trim());
      break;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  -> ${model} FAILED:`, msg.slice(0, 120));
    }
  }
}

probeModels();
