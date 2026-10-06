import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profileRouter from "./profile";
import recordsRouter from "./records";
import goalsRouter from "./goals";
import remindersRouter from "./reminders";
import analyticsRouter from "./analytics";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profileRouter);
router.use(recordsRouter);
router.use(goalsRouter);
router.use(remindersRouter);
router.use(analyticsRouter);
router.use(aiRouter);

export default router;
