import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, goalsTable } from "@workspace/db";
import {
  CreateGoalBody,
  CreateGoalResponse,
  DeleteGoalParams,
  DeleteGoalResponse,
  GetGoalsResponse,
  UpdateGoalBody,
  UpdateGoalParams,
  UpdateGoalResponse,
} from "@workspace/api-zod";
import { getAuthenticatedUserId, goalDto } from "../lib/healthtrack";
import { requireHealthtrackAuth } from "../middlewares/healthtrack-auth";

const router: IRouter = Router();
router.use(requireHealthtrackAuth);

router.get("/v1/goals", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const rows = await db
    .select()
    .from(goalsTable)
    .where(eq(goalsTable.userId, userId))
    .orderBy(desc(goalsTable.createdAt));
  res.json(GetGoalsResponse.parse(rows.map(goalDto)));
});

router.post("/v1/goals", async (req, res): Promise<void> => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check your goal details." });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [goal] = await db
    .insert(goalsTable)
    .values({
      userId,
      goalType: parsed.data.goalType,
      targetValue: parsed.data.targetValue,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate ?? null,
    })
    .returning();
  if (!goal) {
    res.status(500).json({ error: "Unable to create this goal." });
    return;
  }
  res.status(201).json(CreateGoalResponse.parse(goalDto(goal)));
});

router.put("/v1/goals/:id", async (req, res): Promise<void> => {
  const params = UpdateGoalParams.safeParse(req.params);
  const body = UpdateGoalBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Check the goal details and try again." });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [goal] = await db
    .update(goalsTable)
    .set(body.data)
    .where(and(eq(goalsTable.id, params.data.id), eq(goalsTable.userId, userId)))
    .returning();
  if (!goal) {
    req.log.warn(
      { userId, targetId: params.data.id, resource: "goal" },
      "Rejected resource access outside the current account",
    );
    res.status(403).json({ error: "You do not have access to that goal." });
    return;
  }
  res.json(UpdateGoalResponse.parse(goalDto(goal)));
});

router.delete("/v1/goals/:id", async (req, res): Promise<void> => {
  const parsed = DeleteGoalParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid goal ID." });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [deleted] = await db
    .delete(goalsTable)
    .where(and(eq(goalsTable.id, parsed.data.id), eq(goalsTable.userId, userId)))
    .returning({ id: goalsTable.id });
  if (!deleted) {
    req.log.warn(
      { userId, targetId: parsed.data.id, resource: "goal" },
      "Rejected resource access outside the current account",
    );
    res.status(403).json({ error: "You do not have access to that goal." });
    return;
  }
  res.json(DeleteGoalResponse.parse({ message: "Goal deleted." }));
});

export default router;
