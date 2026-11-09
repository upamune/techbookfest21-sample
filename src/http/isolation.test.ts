import { readFile, readdir } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { describe, expect, it } from "vite-plus/test";
import { createApi } from "./api";
import { createTokenService, resolveAccessToken } from "../security/access-tokens";
import { allowedOwner } from "../security/allowed-owner";
import {
  archiveOutput,
  recentActivityOutput,
  replyOutput,
  threadDetailOutput,
  threadListOutput,
  threadOutput,
} from "@pocket/forum/contracts";
import { itemListOutput, itemOutput, photoOutput } from "@pocket/things/contracts";

describe("real D1 owner isolation", () => {
  it("isolates app reads and writes and revokes owner-scoped tokens", async () => {
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
            env: {
              DB: { type: "d1", id: "isolation-test" },
              STORAGE: { type: "r2", name: "isolation-test" },
            },
          },
        },
      ],
    });
    try {
      const DB = await runtime.getD1Database("DB");
      const STORAGE = await runtime.getR2Bucket("STORAGE");
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
      const owner = { DB, STORAGE, POCKET_AUTH_ENABLED: true, OWNER: "user:a" };
      const other = { ...owner, OWNER: "user:b" };
      const call = (name: string, input: object, environment: typeof owner) =>
        app.request(
          `https://pocket.example/api/tools/${name}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(input),
          },
          environment,
        );
      const requestId = crypto.randomUUID();
      const threadInput = { requestId, authorName: "自分", title: "private", body: "本文" };
      const created = await call("forum_create_thread", threadInput, owner);
      expect(created.status).toBe(200);
      const { thread } = threadOutput.parse(await created.json());
      expect(thread.authorKind).toBe("human");
      const replayed = await call("forum_create_thread", threadInput, owner);
      expect(threadOutput.parse(await replayed.json()).thread).toEqual(thread);
      const listFor = async (environment: typeof owner) =>
        threadListOutput.parse(await (await call("forum_list_threads", {}, environment)).json())
          .threads;
      expect(await listFor(owner)).toHaveLength(1);
      expect(await listFor(other)).toEqual([]);
      expect((await call("forum_get_thread", { id: thread.id }, other)).status).toBe(404);
      const otherReply = {
        requestId: crypto.randomUUID(),
        threadId: thread.id,
        authorName: "他人",
        body: "割り込み",
      };
      expect((await call("forum_add_reply", otherReply, other)).status).toBe(404);
      expect(
        (await call("forum_set_thread_archived", { id: thread.id, archived: true }, other)).status,
      ).toBe(404);
      const replyInput = { ...otherReply, authorName: "自分", body: "返信" };
      for (let attempt = 0; attempt < 2; attempt += 1)
        expect((await call("forum_add_reply", replyInput, owner)).status).toBe(200);
      const detail = threadDetailOutput.parse(
        await (await call("forum_get_thread", { id: thread.id }, owner)).json(),
      );
      expect(detail.replies).toHaveLength(1);
      expect((await listFor(owner))[0]?.replyCount).toBe(1);
      const archiving = await call(
        "forum_set_thread_archived",
        { id: thread.id, archived: true },
        owner,
      );
      expect(archiveOutput.parse(await archiving.json()).archived).toBe(true);
      expect(await listFor(owner)).toEqual([]);
      const archivedDetail = threadDetailOutput.parse(
        await (await call("forum_get_thread", { id: thread.id }, owner)).json(),
      );
      expect(archivedDetail.thread.archivedAt).not.toBeNull();
      const lateReply = { ...replyInput, requestId: crypto.randomUUID() };
      expect((await call("forum_add_reply", lateReply, owner)).status).toBe(409);
      const archivedList = threadListOutput.parse(
        await (await call("forum_list_threads", { archived: true }, owner)).json(),
      ).threads;
      expect(archivedList.map((item) => item.id)).toEqual([thread.id]);
      await call("forum_set_thread_archived", { id: thread.id, archived: false }, owner);
      expect(await listFor(owner)).toHaveLength(1);

      const activityFor = async (input: object, environment: typeof owner = owner) =>
        recentActivityOutput.parse(
          await (await call("forum_list_recent_activity", input, environment)).json(),
        );
      const latest = await activityFor({});
      expect(latest.activities.map((activity) => [activity.kind, activity.number])).toEqual([
        ["thread", 1],
        ["reply", 2],
      ]);
      expect(latest.hasMore).toBe(false);
      expect((await activityFor({}, other)).activities).toEqual([]);
      const start = String(latest.nextCursor);
      expect((await activityFor({ after: start })).activities).toEqual([]);
      const postReply = async (body: string) =>
        replyOutput.parse(
          await (
            await call(
              "forum_add_reply",
              { requestId: crypto.randomUUID(), threadId: thread.id, authorName: "自分", body },
              owner,
            )
          ).json(),
        ).reply;
      const second = await postReply("二件目");
      await postReply("三件目");
      const firstPage = await activityFor({ after: start, limit: 1 });
      expect(firstPage.activities.map((activity) => activity.body)).toEqual(["二件目"]);
      expect(firstPage.activities.map((activity) => activity.number)).toEqual([3]);
      expect(firstPage.hasMore).toBe(true);
      const secondPage = await activityFor({ after: firstPage.nextCursor, limit: 1 });
      expect(secondPage.activities.map((activity) => activity.body)).toEqual(["三件目"]);
      expect(secondPage.hasMore).toBe(false);
      await call("forum_set_reply_deleted", { id: second.id, deleted: true }, owner);
      expect((await activityFor({ after: start })).activities.map((item) => item.body)).toEqual([
        "三件目",
      ]);
      await call("forum_set_thread_archived", { id: thread.id, archived: true }, owner);
      expect((await activityFor({ after: start })).activities).toEqual([]);
      await call("forum_set_thread_archived", { id: thread.id, archived: false }, owner);

      const itemInput = { requestId: crypto.randomUUID(), name: "100%の傘", location: "玄関" };
      const { item } = itemOutput.parse(
        await (await call("things_add_item", itemInput, owner)).json(),
      );
      await call("things_add_item", itemInput, owner);
      const search = async (query: string, environment: typeof owner) =>
        itemListOutput.parse(
          await (await call("things_search_items", { query }, environment)).json(),
        ).items;
      expect(await search("", owner)).toEqual([item]);
      expect(await search("", other)).toEqual([]);
      expect(await search("玄関 100%", owner)).toEqual([item]);
      expect(await search("%", other)).toEqual([]);
      expect(await search("50%", owner)).toEqual([]);
      expect((await call("things_update_item", { id: item.id, name: "傘" }, other)).status).toBe(
        404,
      );
      const updated = itemOutput.parse(
        await (await call("things_update_item", { id: item.id, quantity: 2 }, owner)).json(),
      );
      expect(updated.item).toMatchObject({ name: "100%の傘", location: "玄関", quantity: 2 });
      await call("things_set_item_deleted", { id: item.id, deleted: true }, owner);
      expect(await search("", owner)).toEqual([]);
      await call("things_set_item_deleted", { id: item.id, deleted: false }, owner);
      expect(await search("", owner)).toHaveLength(1);
      const photoForm = (itemId: string, firstByte: number) => {
        const jpeg = new Uint8Array([firstByte, 0xd8, 0xff, 0xe0]);
        const form = new FormData();
        form.set("photoId", crypto.randomUUID());
        form.set("itemId", itemId);
        form.set("width", "640");
        form.set("height", "480");
        form.set("full", new File([jpeg], "full.jpg", { type: "image/jpeg" }));
        form.set("thumb", new File([jpeg], "thumb.jpg", { type: "image/jpeg" }));
        return form;
      };
      const upload = (form: FormData, environment: typeof owner) =>
        app.request(
          "https://pocket.example/api/things/photos",
          { method: "POST", body: form },
          environment,
        );
      const photos = "https://pocket.example/api/things/photos";
      expect((await upload(photoForm(item.id, 0xff), other)).status).toBe(404);
      expect((await upload(photoForm(item.id, 0x00), owner)).status).toBe(422);
      const form = photoForm(item.id, 0xff);
      const uploaded = await upload(form, owner);
      expect(uploaded.status).toBe(201);
      const { photo } = photoOutput.parse(await uploaded.json());
      expect((await upload(form, owner)).status).toBe(201);
      const withPhoto = await search("", owner);
      expect(withPhoto[0]?.photos).toEqual([photo]);
      const image = await app.request(`${photos}/${photo.id}/thumb`, {}, owner);
      expect(image.status).toBe(200);
      expect(image.headers.get("content-type")).toBe("image/jpeg");
      expect(image.headers.get("x-content-type-options")).toBe("nosniff");
      expect(new Uint8Array(await image.arrayBuffer())[1]).toBe(0xd8);
      expect((await app.request(`${photos}/${photo.id}/thumb`, {}, other)).status).toBe(404);
      expect((await app.request(`${photos}/${photo.id}/other`, {}, owner)).status).toBe(400);
      expect(
        (await call("things_set_photo_deleted", { id: photo.id, deleted: true }, other)).status,
      ).toBe(404);
      await call("things_set_photo_deleted", { id: photo.id, deleted: true }, owner);
      expect((await app.request(`${photos}/${photo.id}/thumb`, {}, owner)).status).toBe(404);
      expect((await search("", owner))[0]?.photos).toEqual([]);

      const tokens = createTokenService(DB, "user:a");
      const issued = await tokens.issue({ name: "test" });
      const request = new Request("https://pocket.example/mcp", {
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
          new Request("https://pocket.example/mcp", {
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
          new Request("https://pocket.example/mcp", {
            headers: { authorization: `Bearer ${finalToken.secret}` },
          }),
        ),
      ).toBeNull();
    } finally {
      await runtime.dispose();
    }
  });
});
