import assert from "assert";
import {
  isAdminEmail,
  ADMIN_EMAILS,
  requireAdminUser,
  AuthError,
} from "../src/lib/serverAuth";
import {
  logUserActivity,
  getRecentActivityLogs,
  getAllUsersAdmin,
  getUserDeepDiveAdmin,
} from "../src/lib/serverDb";

async function runTests() {
  console.log("==================================================");
  console.log("TRACKX ADMIN SECURITY & TELEMETRY TEST SUITE");
  console.log("==================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (e: unknown) {
      console.error(`[FAIL] ${name}:`, e instanceof Error ? e.message : e);
      failed++;
    }
  }

  async function testAsync(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
      passed++;
    } catch (e: unknown) {
      console.error(`[FAIL] ${name}:`, e instanceof Error ? e.message : e);
      failed++;
    }
  }

  // --- 1. Admin Email List & Authority Checks ---
  test("Admin email configuration contains primary administrator", () => {
    assert(ADMIN_EMAILS.includes("pratapvarmauppalapati6@gmail.com"));
  });

  test("isAdminEmail authorizes primary admin exactly", () => {
    assert.strictEqual(isAdminEmail("pratapvarmauppalapati6@gmail.com"), true);
  });

  test("isAdminEmail is case-insensitive and trims whitespace", () => {
    assert.strictEqual(isAdminEmail("  PRATAPVARMAUPPALAPATI6@GMAIL.COM  "), true);
  });

  test("isAdminEmail rejects normal student accounts", () => {
    assert.strictEqual(isAdminEmail("teststudent@trackx.app"), false);
    assert.strictEqual(isAdminEmail("student@university.edu"), false);
    assert.strictEqual(isAdminEmail("random_user@gmail.com"), false);
  });

  test("isAdminEmail rejects empty, null, or undefined values", () => {
    assert.strictEqual(isAdminEmail(""), false);
    assert.strictEqual(isAdminEmail(null), false);
    assert.strictEqual(isAdminEmail(undefined), false);
  });

  // --- 2. requireAdminUser Authorization Guard ---
  await testAsync("requireAdminUser rejects unauthenticated request with 401", async () => {
    const dummyReq = {
      headers: new Headers(),
      cookies: { get: () => undefined },
    } as unknown as import("next/server").NextRequest;

    let rejected = false;
    try {
      await requireAdminUser(dummyReq);
    } catch (e: unknown) {
      if (e instanceof AuthError && e.status === 401) {
        rejected = true;
      }
    }
    assert(rejected, "Must reject unauthenticated request with 401 AuthError");
  });

  await testAsync("requireAdminUser rejects non-admin user with 403 Forbidden", async () => {
    // Session cookie belonging to non-admin or invalid token
    const dummyReq = {
      headers: new Headers(),
      cookies: {
        get: (name: string) => (name === "trackx_session" ? { value: "non-existent-or-student-uid" } : undefined),
      },
    } as unknown as import("next/server").NextRequest;

    let rejectedForbidden = false;
    try {
      await requireAdminUser(dummyReq);
    } catch (e: unknown) {
      if (e instanceof AuthError && e.status === 403) {
        rejectedForbidden = true;
      }
    }
    assert(rejectedForbidden, "Must reject non-admin with 403 Forbidden AuthError");
  });

  // --- 3. Telemetry Log Generation ---
  await testAsync("logUserActivity formats and records telemetry events", async () => {
    const testUserId = `usr-test-${Date.now()}`;
    const log = await logUserActivity({
      userId: testUserId,
      userEmail: "student_unit_test@trackx.app",
      userName: "Unit Test Student",
      action: "attendance_mark",
      details: { subject: "Algorithms", status: "present", periodNumber: 1 },
    });

    assert(log.id && log.id.startsWith("act-"), "Log ID must have 'act-' prefix");
    assert.strictEqual(log.userId, testUserId);
    assert.strictEqual(log.action, "attendance_mark");
    assert.strictEqual(log.details?.status, "present");
    assert(typeof log.timestamp === "number", "Timestamp must be numeric");
  });

  console.log("\n==================================================");
  console.log(`TEST SUMMARY: ${passed} passed, ${failed} failed`);
  console.log("==================================================");

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
