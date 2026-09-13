import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

export function getFirebaseAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "trackx-3ffbf";

  let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require("path");
      const saPath = path.resolve(process.cwd(), "firebase-service-account.json");
      if (fs.existsSync(saPath)) {
        const sa = JSON.parse(fs.readFileSync(saPath, "utf-8"));
        if (sa.client_email && sa.private_key) {
          clientEmail = sa.client_email;
          privateKey = sa.private_key.replace(/\\n/g, "\n");
        }
      }
    } catch {
      // ignore
    }
  }

  if (clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  return initializeApp({
    projectId,
  });
}

export function getAdminFirestore(): Firestore {
  const app = getFirebaseAdminApp();
  return getFirestore(app);
}

import crypto from "crypto";

let cachedGoogleCerts: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGooglePublicCerts(): Promise<Record<string, string>> {
  if (cachedGoogleCerts && Date.now() < cachedGoogleCerts.expiresAt) {
    return cachedGoogleCerts.certs;
  }
  try {
    const res = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`Google certs fetch failed: ${res.statusText}`);
    const cacheControl = res.headers.get("cache-control");
    const maxAgeMatch = cacheControl?.match(/max-age=(\d+)/);
    const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) * 1000 : 3600 * 1000;
    const certs = (await res.json()) as Record<string, string>;
    cachedGoogleCerts = { certs, expiresAt: Date.now() + maxAge };
    return certs;
  } catch (err) {
    if (cachedGoogleCerts) return cachedGoogleCerts.certs;
    throw err;
  }
}

/**
 * Verifies a Firebase ID token using native Node crypto and Google's public certificates.
 * Fully compatible with serverless runtimes without ESM/CJS bundling issues.
 */
async function decodeAndVerifyToken(token: string): Promise<{ uid: string; email?: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new AuthError("Unauthorized: Malformed JWT token", 401);
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: { alg?: string; kid?: string };
  let payload: { aud?: string; iss?: string; exp?: number; iat?: number; sub?: string; email?: string };

  try {
    header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf-8"));
    payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
  } catch {
    throw new AuthError("Unauthorized: Failed to parse token", 401);
  }

  if (header.alg !== "RS256" || !header.kid) {
    throw new AuthError("Unauthorized: Unsupported token algorithm or missing key ID", 401);
  }

  const now = Math.floor(Date.now() / 1000);
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "trackx-3ffbf";

  if (payload.aud !== projectId) {
    throw new AuthError(`Unauthorized: Token audience mismatch (expected ${projectId})`, 401);
  }

  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new AuthError("Unauthorized: Token issuer mismatch", 401);
  }

  if (payload.exp && payload.exp < now) {
    throw new AuthError("Unauthorized: Token expired", 401);
  }

  if (payload.iat && payload.iat > now + 300) {
    throw new AuthError("Unauthorized: Token issued in the future", 401);
  }

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new AuthError("Unauthorized: Missing subject in token", 401);
  }

  const certs = await getGooglePublicCerts();
  const cert = certs[header.kid];
  if (!cert) {
    throw new AuthError("Unauthorized: Unknown token signing key", 401);
  }

  const verifier = crypto.createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  const isValid = verifier.verify(cert, signatureB64, "base64url");
  if (!isValid) {
    throw new AuthError("Unauthorized: Invalid token signature", 401);
  }

  return {
    uid: payload.sub,
    email: payload.email,
  };
}

/**
 * Verifies the Firebase ID token from the Authorization header:
 * Expects "Authorization: Bearer <token>"
 * Returns verified { uid, email } or null if absent/invalid.
 */
export async function verifyAuthToken(req: NextRequest): Promise<{ uid: string; email?: string } | null> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.trim().split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer" || !parts[1]) {
    return null;
  }

  const token = parts[1];
  try {
    return await decodeAndVerifyToken(token);
  } catch (err: unknown) {
    console.warn("Firebase ID token verification notice:", err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Enforces authenticated access using verified Firebase ID token.
 * Throws an AuthError (401) if missing, malformed, or invalid.
 */
export async function requireAuthenticatedUser(req: NextRequest): Promise<{ uid: string; email?: string }> {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) {
    throw new AuthError("Unauthorized: Missing Authorization header", 401);
  }

  const parts = authHeader.trim().split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer" || !parts[1]) {
    throw new AuthError("Unauthorized: Malformed Authorization header. Expected 'Bearer <token>'", 401);
  }

  const token = parts[1];
  return await decodeAndVerifyToken(token);
}

/**
 * Validates that any requested userId explicitly matches the authenticated UID.
 * Prevents IDOR / impersonation attacks.
 */
export function validateResourceOwnership(authenticatedUid: string, requestedUserId?: string | null): void {
  if (requestedUserId && requestedUserId !== authenticatedUid) {
    throw new AuthError("Forbidden: Cannot access another user's resources", 403);
  }
}

/**
 * Standardized API error handler for authentication and authorization errors.
 */
export function handleAuthError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("API handler unexpected error:", err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
