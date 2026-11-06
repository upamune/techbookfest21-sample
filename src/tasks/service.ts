import { desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { z } from "zod";
import { tasks } from "../../db/schema";
import { createTaskInput, setCompletedInput, taskIdInput, taskSchema } from "./contracts";

export function createTaskService(binding: D1Database) {
  const database = drizzle(binding);
  return {
    async list() {
      const rows = await database
        .select()
        .from(tasks)
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
      await database.insert(tasks).values(task);
      return task;
    },
    async setCompleted(input: z.infer<typeof setCompletedInput>) {
      const [row] = await database
        .update(tasks)
        .set({ completed: input.completed })
        .where(eq(tasks.id, input.id))
        .returning();
      return row === undefined ? null : taskSchema.parse(row);
    },
    async remove(input: z.infer<typeof taskIdInput>) {
      const rows = await database
        .delete(tasks)
        .where(eq(tasks.id, input.id))
        .returning({ id: tasks.id });
      return rows.length > 0;
    },
  };
}
export type TaskService = ReturnType<typeof createTaskService>;
