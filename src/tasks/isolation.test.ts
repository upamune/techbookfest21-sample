import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { describe, expect, it } from "vite-plus/test";
import { createApi } from "../http/api";
import { createTokenService, resolveAccessToken } from "../security/access-tokens";
import { allowedOwner } from "../security/allowed-owner";
import { taskResponse, tasksResponse } from "./contracts";

describe("real D1 owner isolation", () => {
  it("isolates task reads and writes and revokes owner-scoped tokens", async () => {
    const runtime = new Miniflare({
      enableDevRegistry: false,
      workers: [
        {
          dev: { unsafeRegisterWorker: false },
          config: {
            name: "isolation-test",
            compatibilityDate: "2026-11-06",
            manifest: {
              mainModule: "worker.js",
              modulesRoot: process.cwd(),
              modules: {
                "worker.js": {
                  type: "esm",
                  contents: "export default { fetch() { return new Response('ok'); } }",
                },
              },
            },
            env: { DB: { type: "d1", id: "isolation-test" } },
          },
        },
      ],
    });
    try {
      const DB = await runtime.getD1Database("DB");
      for (const file of (await readdir("db/migrations"))
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        const sql = await readFile(`db/migrations/${file}`, "utf8");
        for (const statement of sql.split("--> statement-breakpoint").filter((part) => part.trim()))
          await DB.prepare(statement).run();
      }
      await DB.prepare(
        "INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt) VALUES ('a','Alice','alice@example.test',0,0,0)",
      ).run();
      await DB.prepare(
        "INSERT INTO account (id,accountId,providerId,userId,createdAt,updatedAt) VALUES ('github-a','123','github','a',0,0)",
      ).run();
      expect(
        await allowedOwner({ binding: DB, owner: "user:a", githubIds: "[]", googleSubs: "[]" }),
      ).toBeUndefined();
      expect(
        await allowedOwner({
          binding: DB,
          owner: "user:a",
          githubIds: '["123"]',
          googleSubs: "[]",
        }),
      ).toBe("user:a");
      expect(
        await allowedOwner({
          binding: DB,
          owner: "user:a",
          githubIds: '["124"]',
          googleSubs: "[]",
        }),
      ).toBeUndefined();
      const app = createApi(false);
      await DB.prepare(
        "INSERT INTO user (id,name,email,emailVerified,createdAt,updatedAt) VALUES ('b','Bob','bob@example.test',1,0,0)",
      ).run();
      await DB.prepare(
        "INSERT INTO account (id,accountId,providerId,userId,createdAt,updatedAt) VALUES ('google-b','123','google','b',0,0)",
      ).run();
      expect(
        await allowedOwner({
          binding: DB,
          owner: "user:b",
          githubIds: '["123"]',
          googleSubs: "[]",
        }),
      ).toBeUndefined();
      expect(
        await allowedOwner({
          binding: DB,
          owner: "user:a",
          githubIds: "[]",
          googleSubs: '["123"]',
        }),
      ).toBeUndefined();
      expect(
        await allowedOwner({
          binding: DB,
          owner: "user:b",
          githubIds: "[]",
          googleSubs: '["123"]',
        }),
      ).toBe("user:b");
      const owner = { DB, TASK_AUTH_ENABLED: true, TASK_OWNER: "user:a" };
      const other = { ...owner, TASK_OWNER: "user:b" };
      const created = await app.request(
        "https://tasks.example/api/tasks",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "private" }),
        },
        owner,
      );
      expect(created.status).toBe(201);
      const { task } = taskResponse.parse(await created.json());
      const list = await app.request("https://tasks.example/api/tasks", {}, other);
      expect(tasksResponse.parse(await list.json()).tasks).toEqual([]);
      const path = `https://tasks.example/api/tasks/${task.id}`;
      expect(
        (
          await app.request(
            path,
            {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ completed: true }),
            },
            other,
          )
        ).status,
      ).toBe(404);
      expect(await (await app.request(path, { method: "DELETE" }, other)).json()).toEqual({
        deleted: false,
      });
      expect(
        tasksResponse.parse(
          await (await app.request("https://tasks.example/api/tasks", {}, owner)).json(),
        ).tasks,
      ).toEqual([task]);
      const tokens = createTokenService(DB, "user:a");
      const issued = await tokens.issue({ name: "test" });
      const request = new Request("https://tasks.example/mcp", {
        headers: { authorization: `Bearer ${issued.secret}` },
      });
      expect(await resolveAccessToken(DB, request)).toBe("user:a");
      const bearerOwner = await resolveAccessToken(DB, request);
      expect(
        await allowedOwner({
          binding: DB,
          owner: bearerOwner ?? undefined,
          githubIds: '["123"]',
          googleSubs: "[]",
        }),
      ).toBe("user:a");
      expect(
        await allowedOwner({
          binding: DB,
          owner: bearerOwner ?? undefined,
          githubIds: "[]",
          googleSubs: "[]",
        }),
      ).toBeUndefined();
      expect(await createTokenService(DB, "user:b").list()).toEqual([]);
      expect(await createTokenService(DB, "user:b").revoke(issued.id)).toBe(false);
      expect(await tokens.revoke(issued.id)).toBe(true);
      expect(await resolveAccessToken(DB, request)).toBeNull();
      expect(await tokens.list()).toEqual([]);
      const expired = await tokens.issue({ name: "expired" });
      await DB.prepare(
        "UPDATE access_tokens SET expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?",
      )
        .bind(expired.id)
        .run();
      expect(
        await resolveAccessToken(
          DB,
          new Request("https://tasks.example/mcp", {
            headers: { authorization: `Bearer ${expired.secret}` },
          }),
        ),
      ).toBeNull();
      expect(await tokens.list()).toEqual([]);
      await DB.batch(
        Array.from({ length: 100 }, (_, index) =>
          DB.prepare(
            "INSERT INTO access_tokens (id,owner_id,name,token_hash,created_at,expires_at) VALUES (?, 'user:a', 'fixture', ?, '2026-01-01T00:00:00.000Z', '2999-01-01T00:00:00.000Z')",
          ).bind(`fixture-${index}`, `hash-${index}`),
        ),
      );
      expect(await tokens.list()).toHaveLength(100);
      await expect(tokens.issue({ name: "over limit" })).rejects.toThrow();
      await tokens.revoke("fixture-0");
      const finalToken = await tokens.issue({ name: "replacement" });
      expect(await tokens.list()).toHaveLength(100);
      await DB.prepare("DELETE FROM user WHERE id = 'a'").run();
      expect(
        await resolveAccessToken(
          DB,
          new Request("https://tasks.example/mcp", {
            headers: { authorization: `Bearer ${finalToken.secret}` },
          }),
        ),
      ).toBeNull();
    } finally {
      await runtime.dispose();
    }
  });
});
