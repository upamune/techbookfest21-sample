import { defineEnv, string } from "void/env";

export default defineEnv({
  POCKET_AI_PROVIDER: string().default("workers-ai"),
  POCKET_AI_MODEL: string().optional(),
  POCKET_AI_BASE_URL: string().optional(),
  POCKET_AI_API_KEY: string().optional(),
  OLLAMA_API_KEY: string().optional(),
  OPENCODE_API_KEY: string().optional(),
  POCKET_ALLOWED_GOOGLE_SUBS: string().default("[]"),
  AUTH_GOOGLE_CLIENT_ID: string().optional(),
  AUTH_GOOGLE_CLIENT_SECRET: string().optional(),
  POCKET_ALLOWED_GITHUB_IDS: string().default("[]"),
  POCKET_CIMD_ALLOWED_HOSTS: string().optional(),
  BETTER_AUTH_SECRET: string().optional(),
  AUTH_GITHUB_CLIENT_ID: string().optional(),
  AUTH_GITHUB_CLIENT_SECRET: string().optional(),
});
