import { GoogleGenAI } from "@google/genai";
import { and, desc, eq, gte } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { Router, type IRouter } from "express";
import {
  db,
  aiInsightsTable,
  healthRecordsTable,
  usersTable,
} from "@workspace/db";
import {
  GetDailyInsightResponse,
  GetWeeklyDigestResponse,
  SendAiChatBody,
  SendAiChatResponse,
} from "@workspace/api-zod";
import {
  HEALTH_DISCLAIMER,
  getAuthenticatedUserId,
  recordDto,
} from "../lib/healthtrack";
import { requireHealthtrackAuth } from "../middlewares/healthtrack-auth";

const router: IRouter = Router();
router.use(requireHealthtrackAuth);
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Wellness coaching is temporarily rate-limited. Please try again later." },
});

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Gemini is not configured.");
  return new GoogleGenAI({ apiKey });
}

const safetyInstructions = `You are HealthTrack Coach, an empathetic personal wellness guide. Provide general lifestyle and habit coaching using only the user's supplied HealthTrack data. You are not a doctor and must not diagnose, clinically evaluate, prescribe, or recommend changing medication. If a user reports emergency symptoms such as chest pain, severe shortness of breath, sudden numbness, or an extreme resting heart rate, direct them to local emergency services immediately. Be supportive, clear, non-judgmental, and careful not to invent missing health data. ${HEALTH_DISCLAIMER}`;

async function generateJson<T>(prompt: string, schema: { parse(value: unknown): T }): Promise<T> {
  const response = await getAiClient().models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      systemInstruction: safetyInstructions,
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Gemini returned an empty response.");
  const jsonText = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return schema.parse(JSON.parse(jsonText) as unknown);
}

function todayDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function weekStart(date: string): string {
  const value = new Date(`${date}T12:00:00Z`);
  const day = value.getUTCDay();
  value.setUTCDate(value.getUTCDate() - ((day + 6) % 7));
  return value.toISOString().slice(0, 10);
}

async function readCache(userId: string, type: string, date: string): Promise<unknown | null> {
  const [cached] = await db
    .select({ content: aiInsightsTable.content })
    .from(aiInsightsTable)
    .where(
      and(
        eq(aiInsightsTable.userId, userId),
        eq(aiInsightsTable.insightType, type),
        eq(aiInsightsTable.insightDate, date),
      ),
    )
    .limit(1);
  return cached?.content ?? null;
}

async function writeCache(
  userId: string,
  type: string,
  date: string,
  content: unknown,
): Promise<void> {
  await db
    .insert(aiInsightsTable)
    .values({ userId, insightType: type, insightDate: date, content })
    .onConflictDoUpdate({
      target: [
        aiInsightsTable.userId,
        aiInsightsTable.insightType,
        aiInsightsTable.insightDate,
      ],
      set: { content, createdAt: new Date() },
    });
}

function dateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

router.get("/v1/ai/daily-insight", aiLimiter, async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const date = todayDate();
  try {
    const cached = await readCache(userId, "daily_summary", date);
    if (cached) {
      res.json(GetDailyInsightResponse.parse(cached));
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "Profile not found." });
      return;
    }
    const records = await db
      .select()
      .from(healthRecordsTable)
      .where(and(eq(healthRecordsTable.userId, userId), gte(healthRecordsTable.date, dateDaysAgo(7))))
      .orderBy(desc(healthRecordsTable.date));
    const today = records.find((record) => record.date === date) ?? null;
    const previous = records.filter((record) => record.date !== date);
    const mean = (values: number[]) =>
      values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
    const result = await generateJson(
      `Create a short, non-medical daily wellness insight using only this user's data.\nUser: ${JSON.stringify({
        age: user.age,
        activityLevel: user.activityLevel,
        goals: {
          waterMl: user.waterGoalMl,
          steps: user.stepsGoal,
          exerciseMinutes: user.exerciseGoalMinutes,
          sleepHours: user.sleepGoalHours,
        },
      })}\nToday's record (null means no log yet): ${JSON.stringify(today ? recordDto(today) : null)}\nPrevious 7-day averages: ${JSON.stringify({
        waterMl: mean(previous.map((record) => record.waterMl)),
        steps: mean(previous.map((record) => record.steps)),
        sleepHours: mean(previous.map((record) => record.sleepHours)),
      })}\nReturn JSON with headline (one supportive sentence), wellnessStatus (Needs Attention, On Track, or Exceeding Goals), exactly 3 insights with metric, analysis, microAction, and encouragement. Do not diagnose or infer unsupported facts.`,
      GetDailyInsightResponse,
    );
    await writeCache(userId, "daily_summary", date, result);
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "Failed to generate daily wellness insight");
    res.status(503).json({ error: "The wellness insight is unavailable right now. Please try again later." });
  }
});

router.post("/v1/ai/chat", aiLimiter, async (req, res): Promise<void> => {
  const parsed = SendAiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Enter a question to continue." });
    return;
  }
  const userId = getAuthenticatedUserId(req);
  const question = parsed.data.message.trim();
  const emergencyTerms =
    /\b(chest pain|can't breathe|cannot breathe|severe shortness of breath|sudden numbness|face drooping|resting heart rate.{0,20}(18\d|19\d|2\d\d))\b/i;
  if (emergencyTerms.test(question)) {
    res.json(
      SendAiChatResponse.parse({
        answer: `Your symptoms could need urgent attention. Please contact your local emergency services now (such as 112 in India or 911 in the US). I can't assess or treat emergencies. ${HEALTH_DISCLAIMER}`,
      }),
    );
    return;
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const records = await db
      .select()
      .from(healthRecordsTable)
      .where(and(eq(healthRecordsTable.userId, userId), gte(healthRecordsTable.date, dateDaysAgo(14))))
      .orderBy(desc(healthRecordsTable.date));
    const response = await getAiClient().models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Use only this profile and recent records as personal context. If the data does not answer the question, say so plainly and provide general, non-diagnostic habit guidance only. User profile: ${JSON.stringify(
        user
          ? {
              age: user.age,
              activityLevel: user.activityLevel,
              goals: {
                waterMl: user.waterGoalMl,
                steps: user.stepsGoal,
                exerciseMinutes: user.exerciseGoalMinutes,
                sleepHours: user.sleepGoalHours,
              },
            }
          : null,
      )}\nRecent 14-day records: ${JSON.stringify(records.map(recordDto))}\nQuestion: ${question}`,
      config: { systemInstruction: safetyInstructions, maxOutputTokens: 8192 },
    });
    const answer = response.text?.trim();
    if (!answer) throw new Error("Gemini returned an empty response.");
    res.json(SendAiChatResponse.parse({ answer: `${answer}\n\n${HEALTH_DISCLAIMER}` }));
  } catch (error) {
    req.log.error({ err: error }, "Failed to generate wellness chat response");
    res.status(503).json({ error: "The wellness assistant is unavailable right now. Please try again later." });
  }
});

router.get("/v1/ai/weekly-digest", aiLimiter, async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  const today = todayDate();
  const startDate = weekStart(today);
  try {
    const cached = await readCache(userId, "weekly_digest", startDate);
    if (cached) {
      res.json(GetWeeklyDigestResponse.parse(cached));
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const records = await db
      .select()
      .from(healthRecordsTable)
      .where(
        and(
          eq(healthRecordsTable.userId, userId),
          gte(healthRecordsTable.date, startDate),
        ),
      )
      .orderBy(desc(healthRecordsTable.date));
    const result = await generateJson(
      `Summarize this user's logged wellness habits for the current week. Use only supplied facts; acknowledge limited data if few days are logged. Return JSON with summary, wins (array of strings), focusAreas (array), and microAdjustments (array). Keep this general wellness coaching, not medical advice.\nProfile: ${JSON.stringify(
        user
          ? {
              activityLevel: user.activityLevel,
              goals: {
                waterMl: user.waterGoalMl,
                steps: user.stepsGoal,
                exerciseMinutes: user.exerciseGoalMinutes,
                sleepHours: user.sleepGoalHours,
              },
            }
          : null,
      )}\nRecords from ${startDate} to ${today}: ${JSON.stringify(records.map(recordDto))}`,
      GetWeeklyDigestResponse,
    );
    await writeCache(userId, "weekly_digest", startDate, result);
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "Failed to generate weekly wellness digest");
    res.status(503).json({ error: "The weekly digest is unavailable right now. Please try again later." });
  }
});

export default router;
