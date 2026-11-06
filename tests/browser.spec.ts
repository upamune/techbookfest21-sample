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
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: `${title}を削除`, exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.getByRole("button", { name: `${title}を削除`, exact: true }).click();
    await page.getByRole("button", { name: "削除する", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await expect(page.getByText(title, { exact: true })).not.toBeVisible();
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
