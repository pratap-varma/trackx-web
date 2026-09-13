import { NextRequest, NextResponse } from "next/server";
import {
  findUserByEmail,
  findUserById,
  upsertUser,
  hashPassword,
  verifyPassword,
  sanitizeUser,
  UserDbEntry,
} from "@/lib/serverDb";
import {
  requireAuthenticatedUser,
  verifyAuthToken,
  validateResourceOwnership,
  handleAuthError,
  AuthError,
} from "@/lib/serverAuth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, email, password, name, branch, semester, globalTarget, userId, onboardingCompleted, onboardingState } = body;

    if (action === "register") {
      if (!email || !password) {
        return NextResponse.json({ error: "Email and password required" }, { status: 400 });
      }

      const existing = await findUserByEmail(email);
      if (existing) {
        return NextResponse.json({ error: "User already exists with this email" }, { status: 409 });
      }

      // If client supplied a Bearer token (e.g. from Firebase createUserWithEmailAndPassword), verify it
      const verified = await verifyAuthToken(req);
      if (verified && userId) {
        validateResourceOwnership(verified.uid, userId);
      }

      const { hash, salt } = hashPassword(password);
      const newUserId = verified ? verified.uid : (userId || `usr-${Date.now()}`);

      const newUser: UserDbEntry = {
        id: newUserId,
        name: name || email.split("@")[0] || "Student",
        email: email.toLowerCase(),
        branch: branch || "Computer Science & Engineering",
        semester: semester || 1,
        globalTarget: globalTarget || 75.0,
        themeMode: "dark",
        collegeName: "University",
        registrationNumber: "",
        programmeName: "B.Tech",
        onboardingCompleted: false,
        onboardingState: {
          profileCompleted: false,
          attendanceBaselineCompleted: false,
          timetableCompleted: false,
          completed: false,
          currentStep: "profile",
        },
        createdTimestamp: Date.now(),
        updatedTimestamp: Date.now(),
        passwordHash: hash,
        salt,
      };

      const saved = await upsertUser(newUser);
      const res = NextResponse.json({ success: true, user: sanitizeUser(saved) });
      res.cookies.set("trackx_session", saved.id, {
        httpOnly: true,
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
        sameSite: "lax",
      });
      return res;
    }

    if (action === "login") {
      if (!email || !password) {
        return NextResponse.json({ error: "Email and password required" }, { status: 400 });
      }

      const user = await findUserByEmail(email);
      if (!user) {
        return NextResponse.json({ error: "No account found with this email" }, { status: 404 });
      }

      if (user.passwordHash && user.salt) {
        const isValid = verifyPassword(password, user.passwordHash, user.salt);
        if (!isValid) {
          return NextResponse.json({ error: "Invalid password" }, { status: 401 });
        }
      }

      const res = NextResponse.json({ success: true, user: sanitizeUser(user) });
      res.cookies.set("trackx_session", user.id, {
        httpOnly: true,
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
        sameSite: "lax",
      });
      return res;
    }

    if (action === "sync_firebase") {
      // Must have verified Firebase ID token
      const authUser = await requireAuthenticatedUser(req);
      const targetUserId = authUser.uid;

      if (userId) {
        validateResourceOwnership(targetUserId, userId);
      }

      const syncEmail = (email || authUser.email || "").toLowerCase();
      if (!syncEmail) {
        return NextResponse.json({ error: "Email required for account sync" }, { status: 400 });
      }

      let user = await findUserById(targetUserId);
      if (!user) {
        user = await findUserByEmail(syncEmail);
      }

      if (user) {
        user = await upsertUser({
          ...user,
          id: targetUserId,
          name: name || user.name,
          email: syncEmail,
          onboardingCompleted: onboardingCompleted !== undefined ? Boolean(onboardingCompleted) : user.onboardingCompleted,
          onboardingState: onboardingState || user.onboardingState,
          updatedTimestamp: Date.now(),
        });
      } else {
        user = await upsertUser({
          id: targetUserId,
          name: name || syncEmail.split("@")[0] || "Student",
          email: syncEmail,
          branch: branch || "Computer Science & Engineering",
          semester: semester || 1,
          globalTarget: globalTarget || 75.0,
          themeMode: "dark",
          collegeName: "University",
          registrationNumber: "",
          programmeName: "B.Tech",
          onboardingCompleted: onboardingCompleted !== undefined ? Boolean(onboardingCompleted) : false,
          onboardingState: onboardingState || {
            profileCompleted: false,
            attendanceBaselineCompleted: false,
            timetableCompleted: false,
            completed: false,
            currentStep: "profile",
          },
          createdTimestamp: Date.now(),
          updatedTimestamp: Date.now(),
        });
      }

      const res = NextResponse.json({ success: true, user: sanitizeUser(user) });
      res.cookies.set("trackx_session", user.id, {
        httpOnly: true,
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
        sameSite: "lax",
      });
      return res;
    }

    if (action === "logout") {
      const res = NextResponse.json({ success: true });
      res.cookies.delete("trackx_session");
      return res;
    }

    return NextResponse.json({ error: "Unknown auth action" }, { status: 400 });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const requestedUserId = req.nextUrl.searchParams.get("userId");
    const verified = await verifyAuthToken(req);

    if (verified) {
      if (requestedUserId) {
        validateResourceOwnership(verified.uid, requestedUserId);
      }
      const user = await findUserById(verified.uid);
      return NextResponse.json({ user: sanitizeUser(user) });
    }

    // Fallback check: session cookie
    const sessionCookie = req.cookies.get("trackx_session")?.value;
    if (sessionCookie) {
      if (requestedUserId) {
        validateResourceOwnership(sessionCookie, requestedUserId);
      }
      const user = await findUserById(sessionCookie);
      return NextResponse.json({ user: sanitizeUser(user) });
    }

    // If unauthenticated, cannot look up arbitrary user IDs
    if (requestedUserId) {
      throw new AuthError("Unauthorized: Token required to view user profile", 401);
    }

    return NextResponse.json({ user: null });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
