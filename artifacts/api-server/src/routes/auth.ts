import { Router, type IRouter } from "express";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import { and, eq, sql } from "drizzle-orm";
import {
  db,
  usersTable,
} from "@workspace/db";
import {
  GetMeResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  RegisterBody,
  RegisterResponse,
} from "@workspace/api-zod";
import {
  createSessionToken,
  getRequestToken,
  profileDto,
  verifySessionToken,
} from "../lib/healthtrack";
import { requireHealthtrackAuth } from "../middlewares/healthtrack-auth";

const router: IRouter = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many sign-in attempts. Please try again shortly." },
});
const COOKIE_NAME = "healthtrack_session";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

router.post("/v1/auth/register", authLimiter, async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid registration details." });
    return;
  }
  const name = parsed.data.name.trim();
  const email = parsed.data.email.trim().toLowerCase();
  const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (existing.length) {
    res.status(409).json({ error: "An account with that email already exists." });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const [user] = await db
    .insert(usersTable)
    .values({ name, email, passwordHash })
    .returning();
  if (!user) {
    res.status(500).json({ error: "Unable to create your account right now." });
    return;
  }

  res.cookie(COOKIE_NAME, createSessionToken(user.id, user.sessionVersion), COOKIE_OPTIONS);
  res.status(201).json(RegisterResponse.parse({ user: profileDto(user) }));
});

router.post("/v1/auth/login", authLimiter, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid sign-in details." });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  res.cookie(COOKIE_NAME, createSessionToken(user.id, user.sessionVersion), COOKIE_OPTIONS);
  res.json(LoginResponse.parse({ user: profileDto(user) }));
});

router.post("/v1/auth/logout", async (req, res): Promise<void> => {
  const token = getRequestToken(req);
  const claims = token ? verifySessionToken(token) : null;
  if (claims) {
    await db
      .update(usersTable)
      .set({ sessionVersion: sql`${usersTable.sessionVersion} + 1` })
      .where(
        and(
          eq(usersTable.id, claims.userId),
          eq(usersTable.sessionVersion, claims.sessionVersion),
        ),
      );
  }
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  res.json(LogoutResponse.parse({ message: "Signed out." }));
});

router.get("/v1/auth/me", requireHealthtrackAuth, async (req, res): Promise<void> => {
  const userId = (req as typeof req & { healthtrackUserId: string }).healthtrackUserId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }
  res.json(GetMeResponse.parse(profileDto(user)));
});

export default router;
