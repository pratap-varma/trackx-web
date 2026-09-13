import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

function setupEnv() {
  const envPath = path.join(__dirname, "../.env.local");
  const content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

  let key = process.env.GEMINI_API_KEY;
  if (!key || key.length <= 10) {
    try {
      key = execSync(
        "powershell -NoProfile -Command \"[System.Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User')\"",
        { encoding: "utf8" }
      ).trim();
    } catch {}
  }

  if (key && key.length > 10) {
    // Remove any existing GEMINI_API_KEY line
    const lines = content.split(/\r?\n/).filter((l) => !l.startsWith("GEMINI_API_KEY="));
    lines.push(`GEMINI_API_KEY=${key.trim()}`);
    fs.writeFileSync(envPath, lines.join("\n") + "\n", "utf8");
    console.log("Successfully configured GEMINI_API_KEY in .env.local (length:", key.length, ")");
  } else {
    console.log("No valid user-level GEMINI_API_KEY found to sync.");
  }
}

setupEnv();
