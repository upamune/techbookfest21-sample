import { z } from "zod";

const taskIdSchema = z.uuid().brand<"TaskId">();
const taskTitleSchema = z.string().trim().min(1).max(200);
export const taskSchema = z.strictObject({
  id: taskIdSchema,
  title: taskTitleSchema,
  completed: z.boolean(),
  createdAt: z.iso.datetime(),
});
export const createTaskInput = z.strictObject({ title: taskTitleSchema });
export const completionInput = z.strictObject({ completed: z.boolean() });
export const taskIdInput = z.strictObject({ id: taskIdSchema });
export const setCompletedInput = taskIdInput.extend(completionInput.shape);
export const taskResponse = z.strictObject({ task: taskSchema });
export const tasksResponse = z.strictObject({ tasks: z.array(taskSchema) });
export const deletionResponse = z.strictObject({ deleted: z.boolean() });
export const errorResponse = z.strictObject({ error: z.string() });
export type Task = z.infer<typeof taskSchema>;
