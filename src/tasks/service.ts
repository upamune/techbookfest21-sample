import { and, desc, eq, getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { z } from "zod";
import { tasks } from "../../db/schema";
import { createTaskInput, setCompletedInput, taskIdInput, taskSchema } from "./contracts";

export function createTaskService(binding: D1Database, ownerId: string) {
  const database = drizzle(binding);
  const { ownerId: _ownerId, ...columns } = getTableColumns(tasks);
  return {
    async list() {
      const rows = await database
        .select(columns)
        .from(tasks)
        .where(eq(tasks.ownerId, ownerId))
        .orderBy(desc(tasks.createdAt), desc(tasks.id))
        .limit(100);
      return z.array(taskSchema).parse(rows);
    },
    async create(input: z.infer<typeof createTaskInput>) {
      const task = taskSchema.parse({
        id: crypto.randomUUID(),
        title: input.title,
        completed: false,
        createdAt: new Date().toISOString(),
      });
      await database.insert(tasks).values({ ...task, ownerId });
      return task;
    },
    async setCompleted(input: z.infer<typeof setCompletedInput>) {
      const [row] = await database
        .update(tasks)
        .set({ completed: input.completed })
        .where(and(eq(tasks.id, input.id), eq(tasks.ownerId, ownerId)))
        .returning(columns);
      return row === undefined ? null : taskSchema.parse(row);
    },
    async remove(input: z.infer<typeof taskIdInput>) {
      const rows = await database
        .delete(tasks)
        .where(and(eq(tasks.id, input.id), eq(tasks.ownerId, ownerId)))
        .returning({ id: tasks.id });
      return rows.length > 0;
    },
  };
}
export type TaskService = ReturnType<typeof createTaskService>;
