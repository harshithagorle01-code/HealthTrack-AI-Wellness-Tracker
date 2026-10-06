import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const usersTable = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  age: integer("age"),
  gender: text("gender").notNull().default("unspecified"),
  heightCm: numeric("height_cm", { precision: 5, scale: 2, mode: "number" }),
  weightKg: numeric("weight_kg", { precision: 5, scale: 2, mode: "number" }),
  activityLevel: text("activity_level").notNull().default("moderate"),
  themePreference: text("theme_preference").notNull().default("light"),
  onboardingComplete: boolean("onboarding_complete").notNull().default(false),
  sessionVersion: integer("session_version").notNull().default(0),
  waterGoalMl: integer("water_goal_ml").notNull().default(2200),
  stepsGoal: integer("steps_goal").notNull().default(8000),
  exerciseGoalMinutes: integer("exercise_goal_minutes").notNull().default(30),
  sleepGoalHours: numeric("sleep_goal_hours", {
    precision: 4,
    scale: 2,
    mode: "number",
  })
    .notNull()
    .default(8),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  check("users_age_check", sql`${table.age} IS NULL OR (${table.age} > 0 AND ${table.age} < 120)`),
  check("users_height_check", sql`${table.heightCm} IS NULL OR ${table.heightCm} > 0`),
  check("users_weight_check", sql`${table.weightKg} IS NULL OR ${table.weightKg} > 0`),
  check("users_water_goal_check", sql`${table.waterGoalMl} > 0`),
  check("users_steps_goal_check", sql`${table.stepsGoal} > 0`),
  check("users_sleep_goal_check", sql`${table.sleepGoalHours} > 0 AND ${table.sleepGoalHours} <= 24`),
  check("users_activity_level_check", sql`${table.activityLevel} IN ('sedentary', 'light', 'moderate', 'active', 'very_active')`),
  check("users_theme_check", sql`${table.themePreference} IN ('light', 'dark')`),
]);

export const healthRecordsTable = pgTable(
  "health_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    waterMl: integer("water_ml").notNull().default(0),
    steps: integer("steps").notNull().default(0),
    exerciseMinutes: integer("exercise_minutes").notNull().default(0),
    sleepHours: numeric("sleep_hours", {
      precision: 4,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    sleepQuality: integer("sleep_quality"),
    heartRateBpm: integer("heart_rate_bpm"),
    weightKg: numeric("weight_kg", { precision: 5, scale: 2, mode: "number" }),
    caloriesConsumed: integer("calories_consumed").notNull().default(0),
    proteinGrams: numeric("protein_grams", {
      precision: 6,
      scale: 1,
      mode: "number",
    }),
    carbsGrams: numeric("carbs_grams", {
      precision: 6,
      scale: 1,
      mode: "number",
    }),
    fatGrams: numeric("fat_grams", {
      precision: 6,
      scale: 1,
      mode: "number",
    }),
    mood: text("mood"),
    stressLevel: text("stress_level"),
    wellnessScore: integer("wellness_score").notNull().default(0),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    unique("health_records_user_date_unique").on(table.userId, table.date),
    check("health_records_water_check", sql`${table.waterMl} >= 0`),
    check("health_records_steps_check", sql`${table.steps} >= 0`),
    check("health_records_exercise_check", sql`${table.exerciseMinutes} >= 0`),
    check("health_records_sleep_check", sql`${table.sleepHours} >= 0 AND ${table.sleepHours} <= 24`),
    check("health_records_sleep_quality_check", sql`${table.sleepQuality} IS NULL OR (${table.sleepQuality} >= 1 AND ${table.sleepQuality} <= 5)`),
    check("health_records_heart_rate_check", sql`${table.heartRateBpm} IS NULL OR (${table.heartRateBpm} > 30 AND ${table.heartRateBpm} < 250)`),
    check("health_records_weight_check", sql`${table.weightKg} IS NULL OR ${table.weightKg} > 0`),
    check("health_records_calories_check", sql`${table.caloriesConsumed} >= 0`),
    check("health_records_wellness_check", sql`${table.wellnessScore} >= 0 AND ${table.wellnessScore} <= 100`),
    check("health_records_mood_check", sql`${table.mood} IS NULL OR ${table.mood} IN ('very_sad', 'sad', 'neutral', 'happy', 'very_happy')`),
    check("health_records_stress_check", sql`${table.stressLevel} IS NULL OR ${table.stressLevel} IN ('low', 'medium', 'high', 'extreme')`),
  ],
);

export const goalsTable = pgTable("goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  goalType: text("goal_type").notNull(),
  targetValue: numeric("target_value", {
    precision: 10,
    scale: 2,
    mode: "number",
  }).notNull(),
  currentValue: numeric("current_value", {
    precision: 10,
    scale: 2,
    mode: "number",
  })
    .notNull()
    .default(0),
  startDate: date("start_date", { mode: "string" }).notNull(),
  endDate: date("end_date", { mode: "string" }),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  check("goals_target_check", sql`${table.targetValue} > 0`),
  check("goals_current_check", sql`${table.currentValue} >= 0`),
  check("goals_status_check", sql`${table.status} IN ('active', 'completed', 'abandoned')`),
  check("goals_type_check", sql`${table.goalType} IN ('water_ml', 'steps', 'exercise_min', 'sleep_hrs', 'weight_kg', 'calories_kcal')`),
]);

export const remindersTable = pgTable("reminders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: text("category").notNull(),
  timeOfDay: text("time_of_day").notNull(),
  frequency: text("frequency").notNull().default("daily"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  check("reminders_category_check", sql`${table.category} IN ('water', 'exercise', 'sleep', 'medication', 'break')`),
  check("reminders_frequency_check", sql`${table.frequency} IN ('daily', 'weekdays', 'weekends')`),
  check("reminders_time_check", sql`${table.timeOfDay} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
]);

export const aiInsightsTable = pgTable(
  "ai_insights",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    insightType: text("insight_type").notNull(),
    insightDate: date("insight_date", { mode: "string" }).notNull(),
    content: jsonb("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("ai_insights_user_type_date_unique").on(
      table.userId,
      table.insightType,
      table.insightDate,
    ),
  ],
);
