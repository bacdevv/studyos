import { test, expect } from "@playwright/test";
test("protected workspace requires sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/(login|setup)/);
  await expect(
    page
      .getByRole("heading", { level: 1 })
      .or(page.getByRole("heading", { level: 2 }))
      .first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("authentication form is keyboard accessible", async ({ page }) => {
  await page.goto("/login");
  test.skip(
    page.url().endsWith("/setup"),
    "Supabase environment is not configured",
  );
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByLabel("Password", { exact: true }).fill("sample-password");
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await expect(
    page.getByRole("button", { name: "Send reset link" }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveCount(0);
});
test("authenticated habit and session lifecycle", async ({ page }) => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    "Requires a confirmed test account and migrated database",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");
  const name = `E2E habit ${Date.now()}`;
  await page
    .getByRole("button", { name: "New habit", exact: true })
    .first()
    .click();
  await page.getByLabel("Habit name").fill(name);
  await page.getByRole("button", { name: "Save habit" }).click();
  await page.goto("/habits");
  await page
    .getByRole("button", { name: `Complete ${name}`, exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: `Uncheck ${name}`, exact: true }),
  ).toBeVisible();
  await page.goto("/study");
  await page.getByRole("button", { name: "Start focus" }).click();
  await expect(
    page.getByRole("button", { name: "Pause", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.reload();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Start focus" })).toBeVisible();
  await page.goto("/habits");
  await page.getByLabel(`Actions for ${name}`).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete record" }).click();
  await expect(page.getByText(name, { exact: true })).toHaveCount(0);
  await page.getByLabel("Account menu").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/login");
});

test("sidebar navigation reuses workspace data without fetching everything", async ({ page }) => {
  test.skip(
    !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD,
    "Requires a confirmed test account and migrated database",
  );
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password", { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("/dashboard");
  await expect(page.getByText("All changes saved")).toBeVisible();
  let fetched = 0;
  page.on("request", (request) => {
    if (request.method() === "GET" && new URL(request.url()).pathname === "/api/data") fetched++;
  });
  await page.getByRole("link", { name: "Habit tracker" }).click();
  await expect(page).toHaveURL("/habits");
  await expect(page.getByRole("heading", { name: "Consistency starts small." })).toBeVisible();
  await page.getByRole("link", { name: "Study sessions" }).click();
  await expect(page).toHaveURL("/study");
  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page).toHaveURL("/dashboard");
  expect(fetched).toBe(0);
});
