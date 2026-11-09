import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { replyOutput, threadDetailOutput, threadOutput } from "@pocket/forum/contracts";
import { itemOutput } from "@pocket/things/contracts";

const now = "2026-11-08T00:00:00.000Z";
const threadPattern = "**/api/tools/forum_list_threads";
const detailPattern = "**/api/tools/forum_get_thread";
const itemsPattern = "**/api/tools/things_search_items";

function callTool(request: APIRequestContext, name: string, input: object) {
  return request.post(`/api/tools/${name}`, { data: input });
}

async function createThread(request: APIRequestContext, title: string) {
  const response = await callTool(request, "forum_create_thread", {
    requestId: crypto.randomUUID(),
    authorName: "自分",
    title,
    body: "本文",
  });
  return threadOutput.parse(await response.json()).thread;
}

async function createItem(request: APIRequestContext, name: string) {
  const response = await callTool(request, "things_add_item", {
    requestId: crypto.randomUUID(),
    name,
    location: "玄関",
  });
  return itemOutput.parse(await response.json()).item;
}

function threadFixture(index: number, title = `スレッド ${index}`) {
  return {
    id: crypto.randomUUID(),
    authorKind: index % 2 === 0 ? "human" : "agent",
    authorName: index % 2 === 0 ? "自分" : "Claude",
    title,
    body: "本文の例です。",
    createdAt: now,
    archivedAt: null,
    replyCount: index,
    lastActivityAt: now,
  };
}

function itemFixture(index: number, name = `持ち物 ${index}`) {
  return {
    id: crypto.randomUUID(),
    name,
    location: "玄関の棚",
    category: "日用品",
    quantity: index + 1,
    note: "",
    createdAt: now,
    updatedAt: now,
    photos: [],
  };
}

function heldResponse() {
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { released, release };
}

async function gotoReady(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("main")).toHaveAttribute("aria-busy", "false");
}

async function observeLayoutShift(page: Page) {
  await page.addInitScript(() => {
    let total = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if ("hadRecentInput" in entry && entry.hadRecentInput === true) continue;
        if ("value" in entry && typeof entry.value === "number") total += entry.value;
      }
      document.documentElement.dataset.layoutShift = String(total);
    }).observe({ type: "layout-shift", buffered: true });
  });
}

const layoutShift = (page: Page) =>
  page.evaluate(() => Number(document.documentElement.dataset.layoutShift ?? "0"));

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

async function expectTouchFriendly(page: Page) {
  const undersized = await page
    .locator(
      'a:visible, button:visible, input:visible:not([aria-hidden="true"]), textarea:visible, [role="checkbox"]:visible',
    )
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const box = element.getBoundingClientRect();
          return box.width < 44 || box.height < 44;
        })
        .map((element) => element.outerHTML.slice(0, 120)),
    );
  expect(undersized).toEqual([]);
  const smallFields = await page
    .locator('input:visible:not([type="file"]), textarea:visible')
    .evaluateAll((elements) =>
      elements
        .filter((element) => Number.parseFloat(getComputedStyle(element).fontSize) < 16)
        .map((element) => element.outerHTML.slice(0, 120)),
    );
  expect(smallFields).toEqual([]);
}

test("portal lists apps and the bottom navigation switches between them", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("list", { name: "アプリ一覧" }).getByRole("link")).toHaveCount(2);
  await expectTouchFriendly(page);
  const nav = page.getByRole("navigation", { name: "アプリ" });
  await nav.getByRole("link", { name: "Things" }).tap();
  await expect(page).toHaveURL(/\/things$/);
  await expect(page.getByRole("heading", { name: "Things" })).toBeVisible();
  await nav.getByRole("link", { name: "Forum" }).tap();
  await expect(page).toHaveURL(/\/forum$/);
  await expect(page.getByRole("heading", { name: "Forum" })).toBeVisible();
  await nav.getByRole("link", { name: "ホーム" }).tap();
  await expect(page).toHaveURL(/\/$/);
});

test("create a thread, reply, undo a reply removal, archive and restore", async ({ page }) => {
  const title = `モバイル ${crypto.randomUUID()}`;
  const reply = `返信 ${crypto.randomUUID()}`;
  await gotoReady(page, "/forum");
  await page.getByRole("button", { name: "スレッドを作成" }).tap();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("textbox", { name: "タイトル" })).toBeFocused();
  await expectTouchFriendly(page);
  await sheet.getByRole("textbox", { name: "タイトル" }).fill(title);
  await sheet.getByRole("textbox", { name: "本文" }).fill("スマホから投稿");
  await sheet.getByRole("button", { name: "書き込む" }).tap();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page).toHaveURL(/\/forum\/[0-9a-f-]+$/);
  await expect(page.getByRole("navigation", { name: "アプリ" })).toHaveCount(0);

  const composer = page.getByRole("textbox", { name: "返信" });
  await expect(composer).toBeEnabled();
  await expect(composer).toBeInViewport();
  await composer.fill(reply);
  await page.getByRole("button", { name: "書き込む" }).tap();
  await expect(page.getByText(reply, { exact: true })).toBeVisible();
  await expect(composer).toHaveValue("");
  await page.reload();
  await expect(page.getByText(reply, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "2番の返信を削除" }).tap();
  await expect(page.getByText(reply, { exact: true })).not.toBeVisible();
  await expect(page.locator("#res-2")).toContainText("このレスは削除されました");
  await page.getByRole("button", { name: "元に戻す" }).tap();
  await expect(page.getByText(reply, { exact: true })).toBeVisible();

  const archive = page.getByRole("button", { name: "スレッドをアーカイブ" });
  const archivedNotice = page.getByText("アーカイブ済みのスレッドです");
  await archive.tap();
  await expect(archivedNotice).toBeVisible();
  await expect(composer).toHaveCount(0);
  await expect(page.getByRole("button", { name: "2番の返信を削除" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "2番にレス" })).toHaveCount(0);
  await expectTouchFriendly(page);

  await page.getByRole("link", { name: "Forumに戻る" }).tap();
  await expect(page).toHaveURL(/\/forum$/);
  await expect(page.getByText(title, { exact: true })).not.toBeVisible();
  await page.getByRole("link", { name: "アーカイブを見る" }).tap();
  await expect(page).toHaveURL(/\/forum\/archive$/);
  await page.getByText(title, { exact: true }).tap();
  await expect(archivedNotice).toBeVisible();
  await page.getByRole("button", { name: "元に戻す" }).tap();
  await expect(composer).toBeVisible();
  await archive.tap();
  await expect(archivedNotice).toBeVisible();
});

test("a thread reads like a numbered bulletin board", async ({ page, request }) => {
  const thread = await createThread(request, `番号 ${crypto.randomUUID()}`);
  const addReply = (body: string) =>
    callTool(request, "forum_add_reply", {
      requestId: crypto.randomUUID(),
      threadId: thread.id,
      authorName: "通りすがり",
      body,
    });
  try {
    const first = replyOutput.parse(await (await addReply("最初のレス")).json()).reply;
    expect(first.number).toBe(2);
    await addReply(">>2 への返事と >>99 は存在しない");
    await callTool(request, "forum_set_reply_deleted", { id: first.id, deleted: true });

    await gotoReady(page, `/forum/${thread.id}`);
    await expect(page.locator("#res-2")).toContainText("このレスは削除されました");
    const third = page.locator("#res-3");
    await expect(third).toContainText("通りすがり");
    await expect(third.getByRole("link", { name: ">>2" })).toHaveAttribute("href", "#res-2");
    await expect(third.getByRole("link", { name: ">>99" })).toHaveCount(0);
    await expectTouchFriendly(page);

    await page.getByRole("button", { name: "3番にレス" }).tap();
    const composer = page.getByRole("textbox", { name: "返信" });
    await expect(composer).toBeFocused();
    await expect(composer).toHaveValue(">>3\n");
    await composer.fill(">>3 名前付きレス");
    await expect(page.getByRole("textbox", { name: "名前" })).toHaveCount(0);
    await page.getByRole("button", { name: "書き込む" }).tap();
    await expect(page.locator("#res-4")).toContainText("人間");
    await expect(page.getByRole("button", { name: "4番の返信を削除" })).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
  } finally {
    await callTool(request, "forum_set_thread_archived", { id: thread.id, archived: true });
  }
});

test("command enter sends a reply and control enter creates a thread", async ({
  page,
  request,
}) => {
  const thread = await createThread(request, `ショートカット ${crypto.randomUUID()}`);
  let sentReplies = 0;
  page.on("request", (sent) => {
    if (sent.url().endsWith("/api/tools/forum_add_reply")) sentReplies += 1;
  });
  try {
    await gotoReady(page, `/forum/${thread.id}`);
    const composer = page.getByRole("textbox", { name: "返信" });
    await expect(composer).toBeEnabled();
    await composer.press("Meta+Enter");
    await composer.fill("Command で送る");
    await composer.press("Enter");
    await expect(composer).toHaveValue("Command で送る\n");
    expect(sentReplies).toBe(0);
    await composer.press("Meta+Enter");
    await expect(page.getByText("Command で送る", { exact: true })).toBeVisible();
    await expect(composer).toHaveValue("");
    expect(sentReplies).toBe(1);

    const title = `Control ${crypto.randomUUID()}`;
    await gotoReady(page, "/forum");
    await page.getByRole("button", { name: "スレッドを作成" }).tap();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("textbox", { name: "タイトル" }).fill(title);
    const body = sheet.getByRole("textbox", { name: "本文" });
    await body.fill("Control で作る");
    await body.press("Control+Enter");
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await callTool(request, "forum_set_thread_archived", {
      id: page.url().split("/").at(-1),
      archived: true,
    });
  } finally {
    await callTool(request, "forum_set_thread_archived", { id: thread.id, archived: true });
  }
});

async function repliesOf(request: APIRequestContext, id: string) {
  const response = await callTool(request, "forum_get_thread", { id });
  return threadDetailOutput.parse(await response.json()).replies;
}

test("Ask AI reads the open thread and writes only after approval", async ({ page, request }) => {
  const thread = await createThread(request, `AI ${crypto.randomUUID()}`);
  try {
    await gotoReady(page, `/forum/${thread.id}`);
    await page.getByRole("button", { name: "AIに聞く" }).tap();
    const sheet = page.getByRole("dialog");
    const question = sheet.getByRole("textbox", { name: "AIへの質問" });
    await expect(question).toBeFocused();
    await expectTouchFriendly(page);
    await question.fill("要点は？");
    await sheet.getByRole("button", { name: "送信" }).tap();
    await expect(sheet).toContainText(`見ている画面: ${thread.title}`);

    await question.fill("返信して");
    await question.press("Meta+Enter");
    await expect(sheet.getByText("この操作を実行しますか？")).toBeVisible();
    await expect(sheet).toContainText("AIからの返信です");
    expect(await repliesOf(request, thread.id)).toHaveLength(0);
    await expectTouchFriendly(page);
    await sheet.getByRole("button", { name: "やめる" }).tap();
    await expect(sheet.getByText("この操作を実行しますか？")).toHaveCount(0);
    await expect(sheet).toContainText("ツールの結果を確認しました。");
    expect(await repliesOf(request, thread.id)).toHaveLength(0);

    await question.fill("返信して");
    await question.press("Meta+Enter");
    await sheet.getByRole("button", { name: "実行する" }).tap();
    await expect.poll(async () => (await repliesOf(request, thread.id)).length).toBe(1);
    const [reply] = await repliesOf(request, thread.id);
    expect(reply).toMatchObject({
      kind: "posted",
      authorKind: "agent",
      authorName: "Pocket AI",
      body: "AIからの返信です",
    });
  } finally {
    await callTool(request, "forum_set_thread_archived", { id: thread.id, archived: true });
  }
});

test("Ask AI renders Markdown tables without loading remote images", async ({ page }) => {
  await gotoReady(page, "/things");
  await page.getByRole("button", { name: "AIに聞く" }).tap();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "持ち物を場所ごとに表でまとめて" }).tap();
  const table = sheet.getByRole("table");
  await expect(table.getByRole("columnheader", { name: "場所" })).toBeVisible();
  await expect(table.getByRole("cell", { name: "本棚" })).toBeVisible();
  await expect(sheet.locator("strong", { hasText: "合計" })).toBeVisible();
  await expect(sheet).not.toContainText("|---|");
  await expect(sheet.locator("img")).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);
  await expectTouchFriendly(page);

  await sheet.getByRole("button", { name: "新しい会話" }).tap();
  await expect(sheet.getByRole("table")).toHaveCount(0);
  await expect(sheet.getByRole("button", { name: "玄関にある物は？" })).toBeVisible();
});

test("Ask AI reports a connection failure in the sheet", async ({ page }) => {
  await page.route("**/api/ai/chat", (route) =>
    route.fulfill({ status: 503, json: { error: "OLLAMA_API_KEY が設定されていません。" } }),
  );
  await gotoReady(page, "/things");
  await page.getByRole("button", { name: "AIに聞く" }).tap();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("textbox", { name: "AIへの質問" }).fill("持ち物は？");
  await sheet.getByRole("button", { name: "送信" }).tap();
  await expect(sheet.getByRole("alert")).toContainText("OLLAMA_API_KEY");
});

test("a failed reply keeps the draft and retries with the same request id", async ({
  page,
  request,
}) => {
  const thread = await createThread(request, `再送 ${crypto.randomUUID()}`);
  const requestIds: unknown[] = [];
  try {
    await page.route("**/api/tools/forum_add_reply", async (route) => {
      const body: unknown = route.request().postDataJSON();
      requestIds.push(
        typeof body === "object" && body !== null && "requestId" in body && body.requestId,
      );
      if (requestIds.length === 1)
        await route.fulfill({ status: 503, json: { error: "Temporary failure" } });
      else await route.continue();
    });
    await page.goto(`/forum/${thread.id}`);
    const composer = page.getByRole("textbox", { name: "返信" });
    await expect(composer).toBeEnabled();
    await composer.fill("届くまで送る");
    await page.getByRole("button", { name: "書き込む" }).tap();
    await expect(page.getByRole("alert")).toContainText("Temporary failure");
    await expect(composer).toHaveValue("届くまで送る");
    await page.getByRole("button", { name: "書き込む" }).tap();
    await expect(page.getByText("届くまで送る", { exact: true })).toBeVisible();
    expect(requestIds).toHaveLength(2);
    expect(requestIds[1]).toBe(requestIds[0]);
  } finally {
    await callTool(request, "forum_set_thread_archived", { id: thread.id, archived: true });
  }
});

test("add, search, edit, delete and restore an item", async ({ page }) => {
  const name = `充電器 ${crypto.randomUUID()}`;
  await gotoReady(page, "/things");
  await page.getByRole("button", { name: "持ち物を追加" }).tap();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("textbox", { name: "名前" })).toBeFocused();
  await expectTouchFriendly(page);
  await sheet.getByRole("textbox", { name: "名前" }).fill(name);
  const place = sheet.getByRole("combobox", { name: "しまった場所" });
  await place.fill("引き出し");
  await page.getByRole("option", { name: "「引き出し」を追加" }).tap();
  await expect(place).toHaveValue("引き出し");
  await sheet.getByRole("button", { name: "保存" }).tap();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  const row = page.getByRole("button", { name: new RegExp(name) });
  await expect(row).toBeVisible();

  const search = page.getByRole("searchbox", { name: "持ち物を検索" });
  await search.fill(name);
  await expect(page.locator("button.thing-card")).toHaveCount(1);
  await search.fill(`${name} 存在しない語`);
  await expect(page.getByText("見つかりませんでした")).toBeVisible();
  await search.fill(name);
  await expect(row).toBeVisible();

  await row.tap();
  await expect(sheet.getByRole("textbox", { name: "名前" })).toHaveValue(name);
  await sheet.getByRole("spinbutton", { name: "個数" }).fill("3");
  await sheet.getByRole("button", { name: "保存" }).tap();
  await expect(row).toContainText("×3");

  await row.tap();
  await sheet.getByRole("button", { name: "削除" }).tap();
  await expect(row).not.toBeVisible();
  await page.getByRole("button", { name: "元に戻す" }).tap();
  await expect(row).toBeVisible();
  await row.tap();
  await sheet.getByRole("button", { name: "削除" }).tap();
  await expect(row).not.toBeVisible();
});

test("location and category are chosen from used values or added once", async ({
  page,
  request,
}) => {
  const location = `棚 ${crypto.randomUUID()}`;
  const name = `単一選択 ${crypto.randomUUID()}`;
  const seed = await callTool(request, "things_add_item", {
    requestId: crypto.randomUUID(),
    name: `既存 ${crypto.randomUUID()}`,
    location,
  });
  const { item: seeded } = itemOutput.parse(await seed.json());
  try {
    await gotoReady(page, "/things");
    await page.getByRole("button", { name: "持ち物を追加" }).tap();
    const sheet = page.getByRole("dialog");
    await sheet.getByRole("textbox", { name: "名前" }).fill(name);
    const select = sheet.getByRole("combobox", { name: "しまった場所" });
    await select.tap();
    const existing = page.getByRole("option", { name: location, exact: true });
    await expect(existing).toHaveCount(1);
    await expectTouchFriendly(page);
    await select.fill(location.slice(0, 4));
    await expect(existing).toBeVisible();
    await existing.tap();
    await expect(select).toHaveValue(location);
    await expect(existing).toHaveCount(0);

    const category = sheet.getByRole("combobox", { name: "カテゴリ" });
    await category.fill("単一選択テスト");
    await expect(page.getByRole("option", { name: "「単一選択テスト」を追加" })).toBeVisible();
    await category.press("Enter");
    await expect(category).toHaveValue("単一選択テスト");
    await sheet.getByRole("button", { name: "カテゴリを消去" }).tap();
    await expect(category).toHaveValue("");
    await category.fill("単一選択テスト");
    await sheet.getByRole("button", { name: "保存", includeHidden: true }).tap();
    await expect(sheet).not.toBeVisible();

    const card = page.getByRole("button", { name: new RegExp(name) });
    await card.tap();
    await expect(sheet.getByRole("combobox", { name: "しまった場所" })).toHaveValue(location);
    await expect(sheet.getByRole("combobox", { name: "カテゴリ" })).toHaveValue("単一選択テスト");
    await sheet.getByRole("button", { name: "削除" }).tap();
    await expect(card).not.toBeVisible();
  } finally {
    await callTool(request, "things_set_item_deleted", { id: seeded.id, deleted: true });
  }
});

test("photos appear in the grid after saving and can be removed", async ({ page, request }) => {
  const item = await createItem(request, `写真 ${crypto.randomUUID()}`);
  try {
    await gotoReady(page, "/things");
    const jpeg = Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const context = canvas.getContext("2d");
        if (context === null) throw new Error("Canvas is unavailable");
        context.fillStyle = "#c2703d";
        context.fillRect(0, 0, 640, 480);
        return canvas.toDataURL("image/jpeg").split(",")[1] ?? "";
      }),
      "base64",
    );
    const card = page.getByRole("button", { name: new RegExp(item.name) });
    await expect(card.locator(".thing-letter")).toBeVisible();
    await card.tap();
    const sheet = page.getByRole("dialog");
    await sheet
      .locator('input[type="file"]')
      .setInputFiles([{ name: "photo.jpg", mimeType: "image/jpeg", buffer: jpeg }]);
    await expect(sheet.getByRole("img", { name: "追加する写真 1" })).toBeVisible();
    await expectTouchFriendly(page);
    await sheet.getByRole("button", { name: "保存" }).tap();
    await expect(sheet).not.toBeVisible();
    const cover = card.locator("img");
    await expect(cover).toBeVisible();
    await expect
      .poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth))
      .toBeGreaterThan(0);
    await card.tap();
    await sheet.getByRole("button", { name: "写真 1を削除" }).tap();
    await sheet.getByRole("button", { name: "保存" }).tap();
    await expect(sheet).not.toBeVisible();
    await expect(card.locator(".thing-letter")).toBeVisible();
  } finally {
    await callTool(request, "things_set_item_deleted", { id: item.id, deleted: true });
  }
});

test("the photo grid uses two columns on a phone", async ({ page }) => {
  const items = Array.from({ length: 4 }, (_, index) => itemFixture(index));
  await page.route(itemsPattern, (route) => route.fulfill({ json: { items } }));
  await gotoReady(page, "/things");
  const boxes = await page
    .locator("button.thing-card")
    .evaluateAll((cards) => cards.map((card) => card.getBoundingClientRect()));
  expect(boxes[1]?.top).toBe(boxes[0]?.top);
  expect(boxes[2]?.top).toBeGreaterThan(boxes[0]?.bottom ?? 0);
});

test("clickable things show the pointer cursor", async ({ page }) => {
  await page.route(itemsPattern, (route) => route.fulfill({ json: { items: [itemFixture(0)] } }));
  await gotoReady(page, "/things");
  const card = page.locator("button.thing-card");
  await expect(card).toHaveCSS("cursor", "pointer");
  await expect(page.getByRole("button", { name: "持ち物を追加" })).toHaveCSS("cursor", "pointer");
  await card.tap();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("button", { name: "カテゴリを消去" })).toHaveCSS(
    "cursor",
    "pointer",
  );
  await sheet.getByRole("combobox", { name: "カテゴリ" }).tap();
  await expect(page.getByRole("option", { name: "日用品" })).toHaveCSS("cursor", "pointer");
  await expect(sheet.getByLabel("写真を追加")).toHaveCSS("cursor", "pointer");
});

test("the last row stays reachable above the bottom navigation", async ({ page }) => {
  const items = Array.from({ length: 30 }, (_, index) => itemFixture(index));
  await page.route(itemsPattern, (route) => route.fulfill({ json: { items } }));
  await page.goto("/things");
  const last = page.locator("button.thing-card").last();
  await last.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  const rowBottom = await last.evaluate((row) => row.getBoundingClientRect().bottom);
  const navTop = await page
    .locator(".bottom-nav")
    .evaluate((nav) => nav.getBoundingClientRect().top);
  const fabTop = await page.locator(".fab").evaluate((fab) => fab.getBoundingClientRect().top);
  const askAi = await page.locator(".ai-fab").evaluate((fab) => fab.getBoundingClientRect());
  expect(rowBottom).toBeLessThanOrEqual(navTop);
  expect(askAi.bottom).toBeLessThanOrEqual(fabTop);
  expect(rowBottom).toBeLessThanOrEqual(askAi.top);
});

test("a long thread keeps the composer on screen", async ({ page }) => {
  const thread = threadFixture(0);
  const replies = Array.from({ length: 40 }, (_, index) => ({
    kind: "posted",
    number: index + 2,
    id: crypto.randomUUID(),
    threadId: thread.id,
    authorKind: "agent",
    authorName: "Claude",
    body: `返信 ${index}`,
    createdAt: now,
  }));
  const { replyCount: _count, lastActivityAt: _last, ...detail } = thread;
  await page.route(detailPattern, (route) => route.fulfill({ json: { thread: detail, replies } }));
  await page.goto(`/forum/${thread.id}`);
  const composer = page.getByRole("textbox", { name: "返信" });
  await expect(composer).toBeEnabled();
  await expect(composer).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(composer).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(composer).toBeInViewport();
  await expect(
    page
      .getByRole("button", { name: "Forumに戻る" })
      .or(page.getByRole("link", { name: "Forumに戻る" })),
  ).toBeInViewport();
});

const worstCaseText = [
  "仕様の上限を確認する".repeat(12).slice(0, 120),
  "https://example.com/" + "project-review-".repeat(6),
  "👩🏽‍💻 公開前の確認 — Đặng Thị Ngọc Hân",
  "J",
  "<script>alert(1)</script>",
];

for (const count of [0, 1, 100]) {
  test(`worst-case content stays usable at 320px with ${count} rows`, async ({ page }) => {
    const threads = Array.from({ length: count }, (_, index) =>
      threadFixture(index, worstCaseText[index % worstCaseText.length]),
    );
    const items = Array.from({ length: count }, (_, index) =>
      itemFixture(index, worstCaseText[index % worstCaseText.length]),
    );
    await page.route(threadPattern, (route) => route.fulfill({ json: { threads } }));
    await page.route(itemsPattern, (route) => route.fulfill({ json: { items } }));
    await page.setViewportSize({ width: 320, height: 640 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await gotoReady(page, "/forum");
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.getByRole("button", { name: "スレッドを作成" }).tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    await expect(page.getByRole("button", { name: "書き込む" })).toBeAttached();
    await page.keyboard.press("Escape");
    await page.goto("/things");
    await expect(page.getByRole("searchbox", { name: "持ち物を検索" })).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(await noHorizontalScroll(page)).toBe(true);
  });
}

test("worst-case thread content wraps without horizontal scrolling at 320px", async ({ page }) => {
  const thread = threadFixture(0, worstCaseText[0]);
  const { replyCount: _count, lastActivityAt: _last, ...detail } = thread;
  const replies = worstCaseText.map((body, index) => ({
    kind: "posted",
    number: index + 2,
    id: crypto.randomUUID(),
    threadId: thread.id,
    authorKind: "agent",
    authorName: "とても長い表示名のエージェントです".slice(0, 40),
    body,
    createdAt: now,
  }));
  await page.route(detailPattern, (route) =>
    route.fulfill({ json: { thread: { ...detail, body: worstCaseText[1] }, replies } }),
  );
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto(`/forum/${thread.id}`);
  await expect(page.getByRole("textbox", { name: "返信" })).toBeEnabled();
  expect(await noHorizontalScroll(page)).toBe(true);
  await expect(page.getByText("<script>alert(1)</script>", { exact: true })).toBeVisible();
});

test("forum list skeleton matches rows without shifting the layout", async ({ page }) => {
  const threads = Array.from({ length: 4 }, (_, index) => threadFixture(index));
  const response = heldResponse();
  await page.route(threadPattern, async (route) => {
    await response.released;
    await route.fulfill({ json: { threads } });
  });
  await observeLayoutShift(page);
  await page.goto("/forum");
  const skeletonRows = page.locator('.thread-list[aria-hidden="true"] .thread-row');
  await expect(skeletonRows).toHaveCount(4);
  await expect(page.getByRole("status")).toHaveText("読み込み中…");
  const skeletonHeights = await skeletonRows.evaluateAll((rows) =>
    rows.map((row) => row.getBoundingClientRect().height),
  );
  response.release();
  const rows = page.locator("a.thread-row");
  await expect(rows).toHaveCount(4);
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  expect(
    await rows.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height)),
  ).toEqual(skeletonHeights);
  expect(await layoutShift(page)).toBe(0);
});

test("thread skeleton matches the heading block without shifting the layout", async ({ page }) => {
  const thread = threadFixture(0);
  const { replyCount: _count, lastActivityAt: _last, ...detail } = thread;
  const response = heldResponse();
  await page.route(detailPattern, async (route) => {
    await response.released;
    await route.fulfill({ json: { thread: detail, replies: [] } });
  });
  await observeLayoutShift(page);
  await page.goto(`/forum/${thread.id}`);
  const head = page.locator(".thread-head");
  await expect(head.locator('[data-slot="skeleton"]')).toHaveCount(4);
  const skeletonHeight = await head.evaluate((element) => element.getBoundingClientRect().height);
  response.release();
  await expect(head.getByRole("heading", { name: thread.title })).toBeVisible();
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  expect(await head.evaluate((element) => element.getBoundingClientRect().height)).toBe(
    skeletonHeight,
  );
  expect(await layoutShift(page)).toBe(0);
});

test("item list skeleton matches rows without shifting the layout", async ({ page }) => {
  const items = Array.from({ length: 6 }, (_, index) => itemFixture(index));
  const response = heldResponse();
  await page.route(itemsPattern, async (route) => {
    await response.released;
    await route.fulfill({ json: { items } });
  });
  await observeLayoutShift(page);
  await page.goto("/things");
  const skeletonRows = page.locator('.thing-grid[aria-hidden="true"] .thing-card');
  await expect(skeletonRows).toHaveCount(6);
  const skeletonHeights = await skeletonRows.evaluateAll((rows) =>
    rows.map((row) => row.getBoundingClientRect().height),
  );
  response.release();
  const rows = page.locator("button.thing-card");
  await expect(rows).toHaveCount(6);
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  expect(
    await rows.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().height),
    ),
  ).toEqual(skeletonHeights);
  expect(await layoutShift(page)).toBe(0);
});

test("a skeleton stays for at least 300ms even when data arrives at once", async ({ page }) => {
  const threads = [threadFixture(0)];
  await page.route(threadPattern, (route) => route.fulfill({ json: { threads } }));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    const frames: { at: number; skeleton: boolean }[] = [];
    Object.assign(window, { skeletonFrames: frames });
    const sample = (at: number) => {
      frames.push({ at, skeleton: document.querySelector('[data-slot="skeleton"]') !== null });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.getByRole("navigation", { name: "アプリ" }).getByRole("link", { name: "Forum" }).tap();
  await expect(page.locator("a.thread-row")).toBeVisible();
  const visible = await page.evaluate(() => {
    const frames = "skeletonFrames" in window ? window.skeletonFrames : [];
    return Array.isArray(frames)
      ? frames.filter((frame) => frame.skeleton).map((frame) => frame.at)
      : [];
  });
  expect(visible.length).toBeGreaterThan(0);
  expect((visible.at(-1) ?? 0) - (visible[0] ?? 0)).toBeGreaterThanOrEqual(250);
});

test("the skeleton crossfades into the empty state only on the first load", async ({ page }) => {
  await page.route(threadPattern, (route) => route.fulfill({ json: { threads: [] } }));
  await page.addInitScript(() => {
    const original = document.startViewTransition.bind(document);
    let count = 0;
    document.startViewTransition = (update) => {
      count += 1;
      document.documentElement.dataset.transitions = String(count);
      return original(update);
    };
  });
  const transitions = () =>
    page.evaluate(() => Number(document.documentElement.dataset.transitions ?? "0"));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const nav = page.getByRole("navigation", { name: "アプリ" });
  await nav.getByRole("link", { name: "Forum" }).tap();
  await expect(page.getByText("まだスレッドはありません")).toBeVisible();
  expect(await transitions()).toBe(1);
  await nav.getByRole("link", { name: "ホーム" }).tap();
  await expect(page).toHaveURL(/\/$/);
  await nav.getByRole("link", { name: "Forum" }).tap();
  await expect(page.getByRole("main")).toHaveAttribute("aria-busy", "false");
  expect(await transitions()).toBe(1);
});

test("returning to a tab shows loaded rows instead of skeletons", async ({ page }) => {
  const items = [itemFixture(0, "戻っても残る行")];
  const threads = [threadFixture(0)];
  const response = heldResponse();
  let hold = false;
  await page.route(itemsPattern, async (route) => {
    if (hold) await response.released;
    await route.fulfill({ json: { items } });
  });
  await page.route(threadPattern, (route) => route.fulfill({ json: { threads } }));
  await gotoReady(page, "/things");
  const nav = page.getByRole("navigation", { name: "アプリ" });
  await nav.getByRole("link", { name: "Forum" }).tap();
  await expect(page.locator("a.thread-row")).toBeVisible();
  hold = true;
  await nav.getByRole("link", { name: "Things" }).tap();
  await expect(page).toHaveURL(/\/things$/);
  await expect(page.locator("button.thing-card")).toBeVisible();
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  await expect(page.getByRole("main")).toHaveAttribute("aria-busy", "true");
  response.release();
  await expect(page.getByRole("main")).toHaveAttribute("aria-busy", "false");
});

test("search keeps earlier results in place while the next query loads", async ({ page }) => {
  const items = [itemFixture(0, "検索中も残る行")];
  const response = heldResponse();
  let hold = false;
  await page.route(itemsPattern, async (route) => {
    if (hold) await response.released;
    await route.fulfill({ json: { items } });
  });
  await page.goto("/things");
  const row = page.locator("button.thing-card");
  await expect(row).toBeVisible();
  hold = true;
  await page.getByRole("searchbox", { name: "持ち物を検索" }).fill("検索");
  await expect(page.getByRole("main")).toHaveAttribute("aria-busy", "true");
  await expect(row).toBeVisible();
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  response.release();
  await expect(page.getByRole("main")).toHaveAttribute("aria-busy", "false");
});

test("a failed first load offers retry and a failed return keeps the rows", async ({ page }) => {
  let fail = true;
  await page.route(threadPattern, (route) => route.fulfill({ json: { threads: [] } }));
  await page.route(itemsPattern, async (route) => {
    if (fail) await route.fulfill({ status: 503, json: { error: "Temporary failure" } });
    else await route.fulfill({ json: { items: [itemFixture(0, "残る持ち物")] } });
  });
  await page.goto("/things");
  await expect(page.getByRole("alert")).toContainText("Temporary failure");
  fail = false;
  await page.getByRole("button", { name: "再試行" }).tap();
  const row = page.locator("button.thing-card");
  await expect(row).toBeVisible();
  fail = true;
  const nav = page.getByRole("navigation", { name: "アプリ" });
  await nav.getByRole("link", { name: "Forum" }).tap();
  await expect(page).toHaveURL(/\/forum$/);
  await expect(page.getByRole("main")).toHaveAttribute("aria-busy", "false");
  await nav.getByRole("link", { name: "Things" }).tap();
  await expect(page.getByRole("alert")).toContainText("Temporary failure");
  await expect(row).toBeVisible();
});

test("phones get bottom navigation and a back link without breadcrumbs", async ({ page }) => {
  const thread = threadFixture(0);
  const { replyCount: _count, lastActivityAt: _last, ...detail } = thread;
  await page.route(detailPattern, (route) =>
    route.fulfill({ json: { thread: detail, replies: [] } }),
  );
  await gotoReady(page, "/forum");
  await expect(page.getByRole("navigation", { name: "アプリ" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "パンくずリスト" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "更新", exact: true })).toHaveCount(0);
  await gotoReady(page, `/forum/${thread.id}`);
  await expect(page.getByRole("link", { name: "Forumに戻る" })).toBeVisible();
});

test("wider screens get a collapsible sidebar that remembers its state", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoReady(page, "/forum");
  const sidebar = page.locator(".app-sidebar");
  await expect(sidebar).toBeVisible();
  await expect(page.locator(".bottom-nav")).toBeHidden();
  await expect(sidebar.getByRole("link", { name: "Forum" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const widthOf = () => sidebar.evaluate((element) => element.getBoundingClientRect().width);
  const expanded = await widthOf();
  await sidebar.getByRole("button", { name: "サイドバーを閉じる" }).click();
  await expect.poll(widthOf).toBeLessThan(expanded);
  await expect(sidebar.getByRole("button", { name: "サイドバーを開く" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(sidebar.getByRole("link", { name: "Things" })).toBeVisible();
  await observeLayoutShift(page);
  await gotoReady(page, "/forum");
  await expect.poll(widthOf).toBeLessThan(expanded);
  expect(await layoutShift(page)).toBe(0);
  await sidebar.getByRole("link", { name: "Things" }).click();
  await expect(page).toHaveURL(/\/things$/);
  await sidebar.getByRole("button", { name: "サイドバーを開く" }).click();
  await expect.poll(widthOf).toBe(expanded);
});

test("phones do not show the sidebar", async ({ page }) => {
  await gotoReady(page, "/forum");
  await expect(page.locator(".app-sidebar")).toBeHidden();
});

test("wider screens use breadcrumbs instead of bottom navigation", async ({ page }) => {
  const thread = threadFixture(0);
  const { replyCount: _count, lastActivityAt: _last, ...detail } = thread;
  await page.route(detailPattern, (route) =>
    route.fulfill({ json: { thread: detail, replies: [] } }),
  );
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoReady(page, `/forum/${thread.id}`);
  const crumbs = page.getByRole("navigation", { name: "パンくずリスト" });
  await expect(crumbs.getByRole("listitem")).toHaveCount(3);
  await expect(crumbs.getByText("スレッド", { exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("link", { name: "Forumに戻る" })).toHaveCount(0);
  await expect(page.locator(".bottom-nav")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "スレッド" })).toBeAttached();
  const edges = (selector: string) =>
    page.locator(selector).evaluate((element) => {
      const { left, right } = element.getBoundingClientRect();
      return { left, right };
    });
  expect(await edges(".reply-composer-row")).toEqual(await edges(".thread-head"));
  await crumbs.getByRole("link", { name: "Forum", exact: true }).click();
  await expect(page).toHaveURL(/\/forum$/);
  await expect(crumbs.getByRole("listitem")).toHaveCount(2);
  await crumbs.getByRole("link", { name: "Pocket", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(crumbs.getByRole("link")).toHaveCount(0);
  await expect(crumbs.getByRole("img", { name: "Pocket" })).toBeVisible();
});

test("an unknown thread reports not found and offers the way back", async ({ page }) => {
  await page.goto(`/forum/${crypto.randomUUID()}`);
  await expect(page.getByRole("alert")).toContainText("スレッドが見つかりません");
  await expect(page.getByRole("link", { name: "Forumに戻る" })).toBeVisible();
});

test("a stalled write times out without an automatic retry", async ({ page, request }) => {
  const item = await createItem(request, `通信確認 ${crypto.randomUUID()}`);
  let attempts = 0;
  try {
    await page.route("**/api/tools/things_update_item", () => {
      attempts += 1;
    });
    await gotoReady(page, "/things");
    await page.getByRole("button", { name: new RegExp(item.name) }).tap();
    await page.getByRole("dialog").getByRole("button", { name: "保存" }).tap();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("タイムアウト", {
      timeout: 15_000,
    });
    expect(attempts).toBe(1);
  } finally {
    await callTool(request, "things_set_item_deleted", { id: item.id, deleted: true });
  }
});
