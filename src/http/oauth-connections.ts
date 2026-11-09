import type { Hono } from "hono";
import { z } from "zod";
import { createOAuthConnectionService } from "../security/oauth-connections";
import type { Bindings } from "./api";
import { requireBrowserSession } from "./tokens";

const connectionsPath = "/api/oauth-connections";
const clientIdParameter = z.string().min(1).max(2048);

export function registerOAuthConnectionRoutes(app: Hono<{ Bindings: Bindings }>) {
  app.use(connectionsPath, requireBrowserSession);
  app.get(connectionsPath, async (context) => {
    const service = createOAuthConnectionService(context.env.DB, context.env.SESSION_OWNER ?? "");
    return context.json({ connections: await service.list() });
  });
  app.delete(connectionsPath, async (context) => {
    const clientId = clientIdParameter.parse(context.req.query("clientId"));
    const service = createOAuthConnectionService(context.env.DB, context.env.SESSION_OWNER ?? "");
    return context.json({ revoked: await service.revoke(clientId) });
  });
}
