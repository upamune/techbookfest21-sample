import { expect, test } from "@playwright/test";
import { tasksResponse } from "../src/tasks/contracts";

test("create, reload, complete, dismiss and confirm deletion", async ({ page, request }) => {
  const title = `ブラウザー ${crypto.randomUUID()}`;
  try {
    await page.goto("/");
    await expect(page.getByRole("textbox", { name: "新しいタスク" })).toBeEnabled();
    await page.getByRole("textbox", { name: "新しいタスク" }).fill(title);
    await page.getByRole("button", { name: "追加", exact: true }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page.reload();
    const checkbox = page.getByRole("checkbox", { name: `${title}を完了`, exact: true });
    await expect(checkbox).toBeVisible();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await page.getByRole("button", { name: `${title}を削除`, exact: true }).click();
    await page.getByRole("button", { name: "キャンセル", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: `${title}を削除`, exact: true })).toBeFocused();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: `${title}を削除`, exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByRole("button", { name: `${title}を削除`, exact: true })).toBeFocused();
    await page.getByRole("button", { name: `${title}を削除`, exact: true }).click();
    await page.getByRole("button", { name: "削除する", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText(title, { exact: true })).not.toBeVisible();
    await expect(page.getByRole("textbox", { name: "新しいタスク" })).toBeFocused();
  } finally {
    const { tasks } = tasksResponse.parse(await (await request.get("/api/tasks")).json());
    for (const task of tasks.filter((item) => item.title === title))
      await request.delete(`/api/tasks/${task.id}`);
  }
});

test("request failure preserves input and retry remains available", async ({ page }) => {
  await page.route("**/api/tasks", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Temporary failure" }),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Temporary failure");
  await page.unroute("**/api/tasks");
  await page.getByRole("button", { name: "再試行", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "新しいタスク" })).toBeEnabled();
});

test("rapid submit does not duplicate a task and failed create preserves input", async ({
  page,
  request,
}) => {
  const title = `連打 ${crypto.randomUUID()}`;
  try {
    await page.goto("/");
    const input = page.getByRole("textbox", { name: "新しいタスク" });
    await expect(input).toBeEnabled();
    await input.fill(title);
    await page.route("**/api/tasks", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Create failed" }),
        });
      } else await route.continue();
    });
    await page.getByRole("button", { name: "追加", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Create failed");
    await expect(input).toHaveValue(title);
    await page.unroute("**/api/tasks");
    await page.locator("form").evaluate((form) => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    const { tasks } = tasksResponse.parse(await (await request.get("/api/tasks")).json());
    expect(tasks.filter((item) => item.title === title)).toHaveLength(1);
  } finally {
    const { tasks } = tasksResponse.parse(await (await request.get("/api/tasks")).json());
    for (const task of tasks.filter((item) => item.title === title))
      await request.delete(`/api/tasks/${task.id}`);
  }
});

test("failed deletion is announced inside the dialog and can be retried", async ({
  page,
  request,
}) => {
  const title = `削除失敗 ${crypto.randomUUID()}`;
  const created = await request.post("/api/tasks", { data: { title } });
  const { tasks } = tasksResponse.parse(await (await request.get("/api/tasks")).json());
  const task = tasks.find((item) => item.title === title);
  expect(created.status()).toBe(201);
  if (!task) throw new Error("Created task not found");
  try {
    await page.goto("/");
    await page.getByRole("button", { name: `${title}を削除`, exact: true }).click();
    await page.route(`**/api/tasks/${task.id}`, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Delete failed" }),
      }),
    );
    await page.getByRole("button", { name: "削除する", exact: true }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Delete failed");
    await page.unroute(`**/api/tasks/${task.id}`);
    await page.getByRole("button", { name: "削除する", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText(title, { exact: true })).not.toBeVisible();
  } finally {
    await request.delete(`/api/tasks/${task.id}`);
  }
});

for (const count of [0, 1, 100]) {
  test(`worst-case titles remain usable at 320px with ${count} tasks`, async ({ page }) => {
    const titles = [
      "仕様の上限を確認する".repeat(30).slice(0, 200),
      "https://example.com/" + "project-review-".repeat(12),
      "👩🏽‍💻 公開前の確認 — Đặng Thị Ngọc Hân",
      "J",
      "<script>alert(1)</script>",
    ];
    const tasks = Array.from({ length: count }, (_, index) => ({
      id: crypto.randomUUID(),
      title: titles[index % titles.length] ?? "確認",
      completed: index % 3 === 0,
      createdAt: "2026-11-06T00:00:00.000Z",
    }));
    await page.route("**/api/tasks", (route) => route.fulfill({ json: { tasks } }));
    await page.setViewportSize({ width: 320, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.getByRole("textbox", { name: "新しいタスク" })).toBeEnabled();
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    if (count > 0) {
      const remove = page.getByRole("button", { name: /を削除$/ }).first();
      await remove.scrollIntoViewIfNeeded();
      await expect(remove).toBeInViewport();
      await remove.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
  });
}

function heldResponse() {
  let release: () => void = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { released, release };
}

test("initial load shows task-shaped skeleton rows without shifting the layout", async ({
  page,
}) => {
  const tasks = Array.from({ length: 3 }, (_, index) => ({
    id: crypto.randomUUID(),
    title: `読み込み確認 ${index + 1}`,
    completed: index === 0,
    createdAt: "2026-11-06T00:00:00.000Z",
  }));
  const response = heldResponse();
  await page.route("**/api/tasks", async (route) => {
    await response.released;
    await route.fulfill({ json: { tasks } });
  });
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
  await page.goto("/");
  const skeletonRows = page.locator('.task-list[aria-hidden="true"] .task-row');
  await expect(skeletonRows).toHaveCount(3);
  await expect(page.getByRole("status")).toHaveText("読み込み中…");
  const skeletonHeights = await skeletonRows.evaluateAll((rows) =>
    rows.map((row) => row.getBoundingClientRect().height),
  );
  response.release();
  const rows = page.getByRole("listitem");
  await expect(rows).toHaveCount(3);
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  const rowHeights = await rows.evaluateAll((items) =>
    items.map((item) => item.getBoundingClientRect().height),
  );
  expect(rowHeights).toEqual(skeletonHeights);
  expect(
    await page.evaluate(() => Number(document.documentElement.dataset.layoutShift ?? "0")),
  ).toBe(0);
});

test("refresh keeps loaded tasks in place instead of returning to skeletons", async ({ page }) => {
  const task = {
    id: crypto.randomUUID(),
    title: "更新中も残る行",
    completed: false,
    createdAt: "2026-11-06T00:00:00.000Z",
  };
  const response = heldResponse();
  let hold = false;
  await page.route("**/api/tasks", async (route) => {
    if (hold) await response.released;
    await route.fulfill({ json: { tasks: [task] } });
  });
  await page.goto("/");
  const checkbox = page.getByRole("checkbox", { name: `${task.title}を完了`, exact: true });
  await expect(checkbox).toBeEnabled();
  hold = true;
  await page.getByRole("button", { name: "更新", exact: true }).click();
  await expect(checkbox).toBeDisabled();
  await expect(page.getByText(task.title, { exact: true })).toBeVisible();
  await expect(page.locator('[data-slot="skeleton"]')).toHaveCount(0);
  response.release();
  await expect(checkbox).toBeEnabled();
});

test("stalled deletion times out without retry and releases the dialog", async ({ page }) => {
  const task = {
    id: crypto.randomUUID(),
    title: "通信が戻らない場合の確認",
    completed: false,
    createdAt: "2026-11-06T00:00:00.000Z",
  };
  let attempts = 0;
  await page.route("**/api/tasks", (route) => route.fulfill({ json: { tasks: [task] } }));
  await page.route(`**/api/tasks/${task.id}`, () => {
    attempts += 1;
  });
  await page.goto("/");
  const remove = page.getByRole("button", { name: `${task.title}を削除`, exact: true });
  await remove.click();
  await page.getByRole("button", { name: "削除する", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("タイムアウト", {
    timeout: 15_000,
  });
  expect(attempts).toBe(1);
  await page.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(remove).toBeFocused();
});
