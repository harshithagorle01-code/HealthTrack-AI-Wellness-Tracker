import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  goalsTable,
  healthRecordsTable,
  remindersTable,
  usersTable,
} from "@workspace/db";
import {
  DeleteAccountResponse,
  ExportUserDataResponse,
  GetProfileResponse,
  UpdateProfileBody,
  UpdateProfileResponse,
} from "@workspace/api-zod";
import {
  getAuthenticatedUserId,
  goalDto,
  profileDto,
  recordDto,
  reminderDto,
} from "../lib/healthtrack";
import { requireHealthtrackAuth } from "../middlewares/healthtrack-auth";

const router: IRouter = Router();
router.use(requireHealthtrackAuth);

router.get("/v1/profile", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  res.json(GetProfileResponse.parse(profileDto(user)));
});

router.put("/v1/profile", async (req, res): Promise<void> => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check your profile details." });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const input = parsed.data;
  const [user] = await db
    .update(usersTable)
    .set({
      name: input.name.trim(),
      age: input.age,
      gender: input.gender,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      activityLevel: input.activityLevel,
      themePreference: input.themePreference,
      waterGoalMl: input.waterGoalMl,
      stepsGoal: input.stepsGoal,
      exerciseGoalMinutes: input.exerciseGoalMinutes,
      sleepGoalHours: input.sleepGoalHours,
      onboardingComplete: true,
    })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!user) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  res.json(UpdateProfileResponse.parse(profileDto(user)));
});

router.get("/v1/export", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  const [records, goals, reminders] = await Promise.all([
    db.select().from(healthRecordsTable).where(eq(healthRecordsTable.userId, userId)).orderBy(desc(healthRecordsTable.date)),
    db.select().from(goalsTable).where(eq(goalsTable.userId, userId)).orderBy(desc(goalsTable.createdAt)),
    db.select().from(remindersTable).where(eq(remindersTable.userId, userId)).orderBy(desc(remindersTable.createdAt)),
  ]);
  res.json(ExportUserDataResponse.parse({
    profile: profileDto(user),
    records: records.map(recordDto),
    goals: goals.map(goalDto),
    reminders: reminders.map(reminderDto),
  }));
});

router.delete("/v1/account", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  await db.delete(usersTable).where(eq(usersTable.id, userId));
  res.clearCookie("healthtrack_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
  res.json(DeleteAccountResponse.parse({ message: "Your account and associated data were deleted." }));
});

export default router;
