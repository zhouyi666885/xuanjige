import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  timestamp,
  index,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

// 系统表（不要删除）
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).defaultNow(),
});

// 预测反馈表（已有）
export const predictionFeedback = pgTable(
  "prediction_feedback",
  {
    id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
    divinationType: varchar("divination_type", { length: 50 }).notNull(),
    predictionContent: text("prediction_content"),
    feedbackResult: varchar("feedback_result", { length: 20 }).notNull(),
    feedbackDetail: text("feedback_detail"),
    birthInfo: text("birth_info"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    index("prediction_feedback_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
    index("prediction_feedback_result_idx").using("btree", table.feedbackResult.asc().nullsLast().op("text_ops")),
    index("prediction_feedback_type_idx").using("btree", table.divinationType.asc().nullsLast().op("text_ops")),
  ],
);

// 书籍主表：存全文 + 元数据
export const books = pgTable(
  "books",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`).notNull(),
    name: varchar("name", { length: 255 }).notNull().unique(),
    category: varchar("category", { length: 64 }).notNull().default("其他"),
    content: text("content").notNull(),
    char_count: integer("char_count").notNull().default(0),
    total_chapters: integer("total_chapters").notNull().default(0),
    chapter_structure: text("chapter_structure"),
    source: text("source"),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("books_name_idx").on(table.name),
    index("books_category_idx").on(table.category),
    index("books_created_at_idx").on(table.created_at),
  ],
);

// 书籍任务表：录入进度 + AI 学习进度
export const book_tasks = pgTable(
  "book_tasks",
  {
    id: varchar("id", { length: 64 }).primaryKey().notNull(),
    book_name: varchar("book_name", { length: 255 }).notNull(),
    // 录入状态
    status: varchar("status", { length: 32 }).notNull().default("pending"), // pending/searching/downloading/translating/saving/done/failed
    progress: integer("progress").notNull().default(0),
    message: text("message"),
    chars: integer("chars").notNull().default(0),
    current_chapter: integer("current_chapter").notNull().default(0),
    total_chapters: integer("total_chapters").notNull().default(0),
    chapter_structure: text("chapter_structure"),
    source: text("source"),
    is_local_book: boolean("is_local_book").notNull().default(false),
    // AI 学习状态
    learning_status: varchar("learning_status", { length: 32 }).notNull().default("pending"), // pending/learning/done/failed
    learning_progress: integer("learning_progress").notNull().default(0),
    learning_current_chunk: integer("learning_current_chunk").notNull().default(0),
    learning_total_chunks: integer("learning_total_chunks").notNull().default(0),
    learning_message: text("learning_message"),
    learning_layers_done: jsonb("learning_layers_done"), // string[]
    learning_started_at: timestamp("learning_started_at", { withTimezone: true }),
    learning_completed_at: timestamp("learning_completed_at", { withTimezone: true }),
    // 日志和时间戳
    logs: jsonb("logs"), // {time, level, message}[]
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
    completed_at: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("book_tasks_book_name_idx").on(table.book_name),
    index("book_tasks_status_idx").on(table.status),
    index("book_tasks_learning_status_idx").on(table.learning_status),
    index("book_tasks_created_at_idx").on(table.created_at),
  ],
);

// 任务墓碑表：避免被自动复活
export const book_task_tombstones = pgTable(
  "book_task_tombstones",
  {
    id: serial("id").primaryKey().notNull(),
    kind: varchar("kind", { length: 16 }).notNull(), // 'id' | 'name'
    value: varchar("value", { length: 255 }).notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("book_task_tombstones_kind_value_idx").on(table.kind, table.value),
  ],
);
