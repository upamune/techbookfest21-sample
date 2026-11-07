import { boolean, defineEnv, string } from "void/env";

export default defineEnv({
  TASK_ALLOWED_GOOGLE_SUBS: string().default("[]"),
  AUTH_GOOGLE_CLIENT_ID: string().optional(),
  AUTH_GOOGLE_CLIENT_SECRET: string().optional(),
  TASK_ALLOWED_GITHUB_IDS: string().default("[]"),
  TASK_AUTH_ENABLED: boolean().default(false),
  BETTER_AUTH_SECRET: string().optional(),
  AUTH_GITHUB_CLIENT_ID: string().optional(),
  AUTH_GITHUB_CLIENT_SECRET: string().optional(),
});
