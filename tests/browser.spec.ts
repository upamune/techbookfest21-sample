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
