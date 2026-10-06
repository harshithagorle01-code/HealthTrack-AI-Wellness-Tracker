import { and, asc, eq, gte } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, healthRecordsTable, usersTable } from "@workspace/db";
import {
  GetAnalyticsSummaryQueryParams,
  GetAnalyticsSummaryResponse,
} from "@workspace/api-zod";
import { getAuthenticatedUserId, recordDto } from "../lib/healthtrack";
import { requireHealthtrackAuth } from "../middlewares/healthtrack-auth";

const router: IRouter = Router();
router.use(requireHealthtrackAuth);

router.get("/v1/analytics/summary", async (req, res): Promise<void> => {
  const parsed = GetAnalyticsSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a 7, 30, or 90 day range." });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const range = parsed.data.range ?? "7d";
  const days = Number.parseInt(range, 10);
  const startDate = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const rows = await db
    .select()
    .from(healthRecordsTable)
    .where(and(eq(healthRecordsTable.userId, userId), gte(healthRecordsTable.date, startDate)))
    .orderBy(asc(healthRecordsTable.date));
  const count = rows.length || 1;
  const average = (getter: (record: (typeof rows)[number]) => number) =>
    Math.round((rows.reduce((sum, record) => sum + getter(record), 0) / count) * 10) / 10;
  const averageCompletion = user
    ? average(
        (r) =>
          (Math.min(100, (r.waterMl / user.waterGoalMl) * 100) +
            Math.min(100, (r.steps / user.stepsGoal) * 100) +
            Math.min(100, (r.exerciseMinutes / Math.max(1, user.exerciseGoalMinutes)) * 100) +
            Math.min(100, (r.sleepHours / user.sleepGoalHours) * 100)) /
          4,
      )
    : 0;
  const result = {
    range,
    records: rows.map(recordDto),
    averages: {
      waterMl: Math.round(average((r) => r.waterMl)),
      steps: Math.round(average((r) => r.steps)),
      exerciseMinutes: Math.round(average((r) => r.exerciseMinutes)),
      sleepHours: average((r) => r.sleepHours),
    },
    wellnessAverage: average((r) => r.wellnessScore),
    completionRate: averageCompletion,
  };
  res.json(GetAnalyticsSummaryResponse.parse(result));
});

export default router;
