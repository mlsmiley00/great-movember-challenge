import { test, expect } from "@playwright/test";
test("unconfigured sign-in is honest and stays within the viewport", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome to the club" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Sign in/ })).toBeDisabled();
  await expect(
    page.getByText("Set up Supabase to open the club.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/login-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test("English and Spanish switch the document and registration form", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "ES", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(
    page.getByRole("heading", { name: "Bienvenido al club" }),
  ).toBeVisible();
  await page.locator("summary").filter({ hasText: "Únete al reto" }).click();
  await expect(page.getByLabel("Código de invitación")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Crear cuenta" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
test("every private route sends anonymous visitors to sign-in", async ({
  page,
}) => {
  for (const path of [
    "/",
    "/goals",
    "/goals?view=members",
    "/log",
    "/leaderboard",
    "/teams",
    "/community",
    "/admin",
    "/profile",
    "/join",
    "/evidence/10000000-0000-4000-8000-000000000001",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { name: "Welcome to the club" }),
    ).toBeVisible();
  }
});
test("private responses are not cacheable and framing is denied", async ({
  request,
}) => {
  const r = await request.get("/login");
  expect(r.status()).toBe(200);
  expect(r.headers()["cache-control"]).toContain("no-store");
  expect(r.headers()["x-frame-options"]).toBe("DENY");
  expect(r.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
});
test("manifest supports installation without private offline caching", async ({
  request,
}) => {
  const r = await request.get("/manifest.webmanifest");
  expect(r.status()).toBe(200);
  const manifest = await r.json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.name).toContain("2026");
  expect((await request.get("/sw.js")).status()).toBe(404);
});
