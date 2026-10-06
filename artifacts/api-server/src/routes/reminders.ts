import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { db, remindersTable } from "@workspace/db";
import {
  CreateReminderBody,
  CreateReminderResponse,
  DeleteReminderParams,
  DeleteReminderResponse,
  GetRemindersResponse,
  UpdateReminderBody,
  UpdateReminderParams,
  UpdateReminderResponse,
} from "@workspace/api-zod";
import { getAuthenticatedUserId, reminderDto } from "../lib/healthtrack";
import { requireHealthtrackAuth } from "../middlewares/healthtrack-auth";

const router: IRouter = Router();
router.use(requireHealthtrackAuth);

router.get("/v1/reminders", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const rows = await db
    .select()
    .from(remindersTable)
    .where(eq(remindersTable.userId, userId))
    .orderBy(desc(remindersTable.createdAt));
  res.json(GetRemindersResponse.parse(rows.map(reminderDto)));
});

router.post("/v1/reminders", async (req, res): Promise<void> => {
  const parsed = CreateReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Check your reminder details." });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [reminder] = await db
    .insert(remindersTable)
    .values({ userId, ...parsed.data })
    .returning();
  if (!reminder) {
    res.status(500).json({ error: "Unable to create this reminder." });
    return;
  }
  res.status(201).json(CreateReminderResponse.parse(reminderDto(reminder)));
});

router.put("/v1/reminders/:id", async (req, res): Promise<void> => {
  const params = UpdateReminderParams.safeParse(req.params);
  const body = UpdateReminderBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Check the reminder details and try again." });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [reminder] = await db
    .update(remindersTable)
    .set(body.data)
    .where(and(eq(remindersTable.id, params.data.id), eq(remindersTable.userId, userId)))
    .returning();
  if (!reminder) {
    req.log.warn(
      { userId, targetId: params.data.id, resource: "reminder" },
      "Rejected resource access outside the current account",
    );
    res.status(403).json({ error: "You do not have access to that reminder." });
    return;
  }
  res.json(UpdateReminderResponse.parse(reminderDto(reminder)));
});

router.delete("/v1/reminders/:id", async (req, res): Promise<void> => {
  const params = DeleteReminderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid reminder ID." });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const [deleted] = await db
    .delete(remindersTable)
    .where(and(eq(remindersTable.id, params.data.id), eq(remindersTable.userId, userId)))
    .returning({ id: remindersTable.id });
  if (!deleted) {
    req.log.warn(
      { userId, targetId: params.data.id, resource: "reminder" },
      "Rejected resource access outside the current account",
    );
    res.status(403).json({ error: "You do not have access to that reminder." });
    return;
  }
  res.json(DeleteReminderResponse.parse({ message: "Reminder deleted." }));
});

export default router;
