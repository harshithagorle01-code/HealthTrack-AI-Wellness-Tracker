import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { verifySessionToken, getRequestToken } from "../lib/healthtrack";

export async function requireHealthtrackAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getRequestToken(req);
  const claims = token ? verifySessionToken(token) : null;
  if (!claims) {
    res.status(401).json({ error: "Please sign in to continue." });
    return;
  }
  const [user] = await db
    .select({ id: usersTable.id, sessionVersion: usersTable.sessionVersion })
    .from(usersTable)
    .where(eq(usersTable.id, claims.userId))
    .limit(1);
  if (!user || user.sessionVersion !== claims.sessionVersion) {
    res.status(401).json({ error: "Your session has expired. Please sign in again." });
    return;
  }
  (req as Request & { healthtrackUserId: string }).healthtrackUserId = claims.userId;
  next();
}
