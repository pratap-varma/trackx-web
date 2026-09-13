import sharp from "sharp";
import { GoogleGenAI, Schema, Type } from "@google/genai";
import { execSync } from "child_process";

async function testWithRealRenderedImage() {
  const svgText = `
  <svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="50" y="50" font-family="Arial" font-size="22" font-weight="bold" fill="#111827">UNIVERSITY STUDENT PORTAL — ATTENDANCE LEDGER</text>
    
    <text x="50" y="120" font-family="Arial" font-size="16" font-weight="bold" fill="#374151">Course Code</text>
    <text x="200" y="120" font-family="Arial" font-size="16" font-weight="bold" fill="#374151">Course Title</text>
    <text x="480" y="120" font-family="Arial" font-size="16" font-weight="bold" fill="#374151">Attended / Total</text>
    <text x="680" y="120" font-family="Arial" font-size="16" font-weight="bold" fill="#374151">Percentage</text>
    
    <line x1="50" y1="135" x2="750" y2="135" stroke="#9ca3af" stroke-width="2"/>
    
    <text x="50" y="175" font-family="Arial" font-size="15" fill="#111827">CS501</text>
    <text x="200" y="175" font-family="Arial" font-size="15" fill="#111827">Operating Systems</text>
    <text x="480" y="175" font-family="Arial" font-size="15" fill="#111827">18 / 26</text>
    <text x="680" y="175" font-family="Arial" font-size="15" font-weight="bold" fill="#2563eb">69.23%</text>

    <text x="50" y="225" font-family="Arial" font-size="15" fill="#111827">CS502</text>
    <text x="200" y="225" font-family="Arial" font-size="15" fill="#111827">Computer Networks</text>
    <text x="480" y="225" font-family="Arial" font-size="15" fill="#111827">22 / 25</text>
    <text x="680" y="225" font-family="Arial" font-size="15" font-weight="bold" fill="#2563eb">88.00%</text>

    <line x1="50" y1="260" x2="750" y2="260" stroke="#e5e7eb" stroke-width="1"/>

    <text x="50" y="300" font-family="Arial" font-size="16" font-weight="bold" fill="#111827">Overall Attendance</text>
    <text x="480" y="300" font-family="Arial" font-size="16" font-weight="bold" fill="#111827">40 / 51</text>
    <text x="680" y="300" font-family="Arial" font-size="16" font-weight="bold" fill="#059669">78.43%</text>
  </svg>
  `;

  const imageBuffer = await sharp(Buffer.from(svgText)).png().toBuffer();
  console.log("Generated test PNG screenshot buffer:", imageBuffer.length, "bytes");

  let key = process.env.GEMINI_API_KEY;
  if (!key || key.length <= 10) {
    try {
      key = execSync("powershell -NoProfile -Command \"[System.Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User')\"", { encoding: "utf8" }).trim();
    } catch {}
  }

  const ai = new GoogleGenAI({ apiKey: key });

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

  const res = await ai.models.generateContent({
    model: "gemini-3.6-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: imageBuffer.toString("base64"),
            },
          },
          {
            text: "Extract student attendance records. Strict rule: if attended / conducted counts are visible, extract them exactly as integers. Do not invent counts.",
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

  console.log("LIVE OCR RESULT:\n", JSON.stringify(JSON.parse(res.text!), null, 2));
}

testWithRealRenderedImage().catch(console.error);
