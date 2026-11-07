import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
export { accessTokens } from "./tokens";

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("local"),
    title: text("title").notNull(),
    completed: integer("completed", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    check("task_title_length", sql`length(trim(${table.title})) BETWEEN 1 AND 200`),
    check("task_completed_boolean", sql`${table.completed} IN (0, 1)`),
  ],
);
