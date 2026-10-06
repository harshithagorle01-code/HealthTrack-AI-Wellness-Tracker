import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import type {
  Goal,
  HealthRecord,
  Reminder,
  UserProfile,
} from "@workspace/api-zod";
import type {
  goalsTable,
  healthRecordsTable,
  remindersTable,
  usersTable,
} from "@workspace/db";

export type UserRow = typeof usersTable.$inferSelect;
export type RecordRow = typeof healthRecordsTable.$inferSelect;
export type GoalRow = typeof goalsTable.$inferSelect;
export type ReminderRow = typeof remindersTable.$inferSelect;

export type AuthRequest = Request & { healthtrackUserId: string };

export function getAuthenticatedUserId(req: Request): string {
  return (req as unknown as AuthRequest).healthtrackUserId;
}

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
  return secret;
}

function base64url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

export function createSessionToken(userId: string, sessionVersion: number): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: userId,
      sv: sessionVersion,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signature = createHmac("sha256", sessionSecret())
    .update(unsigned)
    .digest("base64url");
  return `${unsigned}.${signature}`;
}

export function verifySessionToken(
  token: string,
): { userId: string; sessionVersion: number } | null {
  const [header, payload, signature, extra] = token.split(".");
  if (!header || !payload || !signature || extra) return null;

  const expected = createHmac("sha256", sessionSecret())
    .update(`${header}.${payload}`)
    .digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) {
    return null;
  }
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      sub?: unknown;
      sv?: unknown;
      exp?: unknown;
    };
    if (
      typeof claims.sub !== "string" ||
      typeof claims.sv !== "number" ||
      typeof claims.exp !== "number" ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return { userId: claims.sub, sessionVersion: claims.sv };
  } catch {
    return null;
  }
}

export function getRequestToken(req: Request): string | null {
  const cookieValue = req.cookies?.healthtrack_session;
  if (typeof cookieValue === "string") return cookieValue;
  const auth = req.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  return null;
}

export function profileDto(user: UserRow): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    age: user.age,
    gender: user.gender,
    heightCm: user.heightCm,
    weightKg: user.weightKg,
    activityLevel: user.activityLevel as UserProfile["activityLevel"],
    themePreference: user.themePreference as UserProfile["themePreference"],
    onboardingComplete: user.onboardingComplete,
    goals: {
      waterMl: user.waterGoalMl,
      steps: user.stepsGoal,
      exerciseMinutes: user.exerciseGoalMinutes,
      sleepHours: user.sleepGoalHours,
    },
  };
}

export function recordDto(record: RecordRow): HealthRecord {
  return {
    id: record.id,
    date: record.date,
    waterMl: record.waterMl,
    steps: record.steps,
    exerciseMinutes: record.exerciseMinutes,
    sleepHours: record.sleepHours,
    sleepQuality: record.sleepQuality,
    heartRateBpm: record.heartRateBpm,
    weightKg: record.weightKg,
    caloriesConsumed: record.caloriesConsumed,
    proteinGrams: record.proteinGrams,
    carbsGrams: record.carbsGrams,
    fatGrams: record.fatGrams,
    mood: record.mood as HealthRecord["mood"],
    stressLevel: record.stressLevel as HealthRecord["stressLevel"],
    wellnessScore: record.wellnessScore,
    notes: record.notes,
  };
}

export function goalDto(goal: GoalRow): Goal {
  return {
    id: goal.id,
    goalType: goal.goalType as Goal["goalType"],
    targetValue: goal.targetValue,
    currentValue: goal.currentValue,
    startDate: goal.startDate,
    endDate: goal.endDate,
    status: goal.status as Goal["status"],
  };
}

export function reminderDto(reminder: ReminderRow): Reminder {
  return {
    id: reminder.id,
    title: reminder.title,
    category: reminder.category as Reminder["category"],
    timeOfDay: reminder.timeOfDay,
    frequency: reminder.frequency as Reminder["frequency"],
    isEnabled: reminder.isEnabled,
  };
}

export function calculateWellnessScore(
  record: Pick<
    RecordRow,
    "waterMl" | "exerciseMinutes" | "sleepHours" | "steps" | "mood"
  >,
  user: Pick<
    UserRow,
    "waterGoalMl" | "exerciseGoalMinutes" | "sleepGoalHours" | "stepsGoal"
  >,
): number {
  const progress = (actual: number, target: number) =>
    target > 0 ? Math.min(100, (actual / target) * 100) : 0;
  const moodScores: Record<string, number> = {
    very_sad: 20,
    sad: 40,
    neutral: 60,
    happy: 80,
    very_happy: 100,
  };
  return Math.round(
    progress(record.waterMl, user.waterGoalMl) * 0.2 +
      progress(record.exerciseMinutes, user.exerciseGoalMinutes) * 0.25 +
      progress(record.sleepHours, user.sleepGoalHours) * 0.25 +
      progress(record.steps, user.stepsGoal) * 0.2 +
      (record.mood ? moodScores[record.mood] ?? 60 : 0) * 0.1,
  );
}

export function todayInKolkata(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export const HEALTH_DISCLAIMER =
  "HealthTrack AI is designed exclusively for general wellness tracking and personal habit awareness. It is not a medical device, nor does it provide medical advice, diagnosis, or clinical treatment recommendations. Always seek the advice of a qualified healthcare provider regarding any medical condition.";
