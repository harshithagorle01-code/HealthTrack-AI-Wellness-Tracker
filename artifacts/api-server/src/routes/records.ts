import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  db,
  goalsTable,
  healthRecordsTable,
  usersTable,
} from "@workspace/db";
import {
  DeleteRecordParams,
  DeleteRecordResponse,
  GetRecordsQueryParams,
  GetRecordsResponse,
  GetTodayRecordResponse,
  IncrementRecordBody,
  IncrementRecordResponse,
  SaveRecordBody,
  SaveRecordResponse,
} from "@workspace/api-zod";
import {
  calculateWellnessScore,
  getAuthenticatedUserId,
  recordDto,
  todayInKolkata,
  type RecordRow,
} from "../lib/healthtrack";
import { requireHealthtrackAuth } from "../middlewares/healthtrack-auth";
import xss from "xss";

const router: IRouter = Router();
router.use(requireHealthtrackAuth);

async function recalculateGoalProgress(userId: string, record: RecordRow): Promise<void> {
  const currentValues: Record<string, number> = {
    water_ml: record.waterMl,
    steps: record.steps,
    exercise_min: record.exerciseMinutes,
    sleep_hrs: record.sleepHours,
    weight_kg: record.weightKg ?? 0,
    calories_kcal: record.caloriesConsumed,
  };
  const activeGoals = await db
    .select()
    .from(goalsTable)
    .where(and(eq(goalsTable.userId, userId), eq(goalsTable.status, "active")));
  await Promise.all(
    activeGoals.map((goal) => {
      const currentValue = currentValues[goal.goalType];
      if (currentValue === undefined) return Promise.resolve();
      return db
        .update(goalsTable)
        .set({
          currentValue,
          ...(currentValue >= goal.targetValue ? { status: "completed" } : {}),
        })
        .where(and(eq(goalsTable.id, goal.id), eq(goalsTable.userId, userId)));
    }),
  );
}

router.get("/v1/records", async (req, res): Promise<void> => {
  const parsed = GetRecordsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid date range." });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const filters = [eq(healthRecordsTable.userId, userId)];
  if (parsed.data.startDate) filters.push(gte(healthRecordsTable.date, parsed.data.startDate));
  if (parsed.data.endDate) filters.push(lte(healthRecordsTable.date, parsed.data.endDate));
  const rows = await db
    .select()
    .from(healthRecordsTable)
    .where(and(...filters))
    .orderBy(desc(healthRecordsTable.date))
    .limit(parsed.data.limit ?? 30);
  res.json(GetRecordsResponse.parse(rows.map(recordDto)));
});

router.get("/v1/records/today", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const date = todayInKolkata();
  await db
    .insert(healthRecordsTable)
    .values({ userId, date })
    .onConflictDoNothing({
      target: [healthRecordsTable.userId, healthRecordsTable.date],
    });
  const [record] = await db
    .select()
    .from(healthRecordsTable)
    .where(and(eq(healthRecordsTable.userId, userId), eq(healthRecordsTable.date, date)))
    .limit(1);
  if (!record) {
    res.status(500).json({ error: "Unable to load today's record." });
    return;
  }
  res.json(GetTodayRecordResponse.parse(recordDto(record)));
});

router.post("/v1/records", async (req, res): Promise<void> => {
  const parsed = SaveRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check your daily log." });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  const input = parsed.data;
  const values = {
    date: input.date,
    waterMl: input.waterMl,
    steps: input.steps,
    exerciseMinutes: input.exerciseMinutes,
    sleepHours: input.sleepHours,
    sleepQuality: input.sleepQuality ?? null,
    heartRateBpm: input.heartRateBpm ?? null,
    weightKg: input.weightKg ?? null,
    caloriesConsumed: input.caloriesConsumed,
    proteinGrams: input.proteinGrams ?? null,
    carbsGrams: input.carbsGrams ?? null,
    fatGrams: input.fatGrams ?? null,
    mood: input.mood ?? null,
    stressLevel: input.stressLevel ?? null,
    notes: input.notes == null ? null : xss(input.notes).slice(0, 500),
  };
  const [saved] = await db
    .insert(healthRecordsTable)
    .values({ userId, ...values })
    .onConflictDoUpdate({
      target: [healthRecordsTable.userId, healthRecordsTable.date],
      set: { ...values, updatedAt: new Date() },
    })
    .returning();
  if (!saved) {
    res.status(500).json({ error: "Unable to save your daily log." });
    return;
  }
  const wellnessScore = calculateWellnessScore(saved, user);
  const [record] = await db
    .update(healthRecordsTable)
    .set({ wellnessScore })
    .where(and(eq(healthRecordsTable.id, saved.id), eq(healthRecordsTable.userId, userId)))
    .returning();
  if (!record) {
    res.status(500).json({ error: "Unable to calculate your wellness score." });
    return;
  }
  await recalculateGoalProgress(userId, record);
  res.json(SaveRecordResponse.parse(recordDto(record)));
});

router.patch("/v1/records/increment", async (req, res): Promise<void> => {
  const parsed = IncrementRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid quick log." });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) {
    res.status(404).json({ error: "Profile not found." });
    return;
  }
  const date = todayInKolkata();
  await db
    .insert(healthRecordsTable)
    .values({ userId, date })
    .onConflictDoNothing({
      target: [healthRecordsTable.userId, healthRecordsTable.date],
    });
  const column = {
    waterMl: healthRecordsTable.waterMl,
    steps: healthRecordsTable.steps,
    exerciseMinutes: healthRecordsTable.exerciseMinutes,
  }[parsed.data.metric];
  const [updated] = await db
    .update(healthRecordsTable)
    .set({ [parsed.data.metric]: sql`${column} + ${parsed.data.delta}`, updatedAt: new Date() })
    .where(and(eq(healthRecordsTable.userId, userId), eq(healthRecordsTable.date, date)))
    .returning();
  if (!updated) {
    res.status(500).json({ error: "Unable to update today's log." });
    return;
  }
  const wellnessScore = calculateWellnessScore(updated, user);
  const [record] = await db
    .update(healthRecordsTable)
    .set({ wellnessScore })
    .where(and(eq(healthRecordsTable.id, updated.id), eq(healthRecordsTable.userId, userId)))
    .returning();
  if (!record) {
    res.status(500).json({ error: "Unable to update today's score." });
    return;
  }
  await recalculateGoalProgress(userId, record);
  res.json(IncrementRecordResponse.parse(recordDto(record)));
});

router.delete("/v1/records/:id", async (req, res): Promise<void> => {
  const parsed = DeleteRecordParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid record ID." });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [deleted] = await db
    .delete(healthRecordsTable)
    .where(and(eq(healthRecordsTable.id, parsed.data.id), eq(healthRecordsTable.userId, userId)))
    .returning({ id: healthRecordsTable.id });
  if (!deleted) {
    req.log.warn(
      { userId, targetId: parsed.data.id, resource: "health_record" },
      "Rejected resource access outside the current account",
    );
    res.status(403).json({ error: "You do not have access to that record." });
    return;
  }
  res.json(DeleteRecordResponse.parse({ message: "Record deleted." }));
});

export default router;
