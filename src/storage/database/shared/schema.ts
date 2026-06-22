import { pgTable, serial, timestamp, varchar, text, integer, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const predictionFeedback = pgTable(
  "prediction_feedback",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    divination_type: varchar("divination_type", { length: 50 }).notNull(),
    prediction_content: text("prediction_content"),
    feedback_result: varchar("feedback_result", { length: 30 }).notNull(),
    feedback_detail: text("feedback_detail"),
    birth_info: text("birth_info"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("prediction_feedback_type_idx").on(table.divination_type),
    index("prediction_feedback_result_idx").on(table.feedback_result),
    index("prediction_feedback_created_at_idx").on(table.created_at),
  ]
);
