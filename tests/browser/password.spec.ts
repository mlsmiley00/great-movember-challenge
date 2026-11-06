import { test, expect } from "@playwright/test";

test("login and registration password visibility preserves typed values", async ({
  page,
}) => {
  await page.goto("/login");
  const login = page
    .locator("form")
    .filter({ has: page.locator('input[autocomplete="current-password"]') });
  const password = login.locator("input[name=password]");
  await password.fill("Example password 123!");
  const toggle = login.getByRole("button", {
    name: "Show password",
    exact: true,
  });
  await toggle.click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("Example password 123!");
  await expect(
    login.getByRole("button", { name: "Hide password", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await login
    .getByRole("button", { name: "Hide password", exact: true })
    .click();
  await expect(password).toHaveAttribute("type", "password");
  await page
    .locator("summary")
    .filter({ hasText: "Join the challenge" })
    .click();
  const signup = page
    .locator("form")
    .filter({ has: page.locator('input[autocomplete="new-password"]') });
  await signup.locator("input[name=password]").fill("Signup password 123!");
  await signup
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(signup.locator("input[name=password]")).toHaveValue(
    "Signup password 123!",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("Spanish password visibility labels are accessible", async ({ page }) => {
  await page
    .context()
    .addCookies([
      { name: "locale", value: "es", url: "http://127.0.0.1:3000" },
    ]);
  await page.goto("/login");
  const login = page
    .locator("form")
    .filter({ has: page.locator('input[autocomplete="current-password"]') });
  await login
    .getByRole("button", { name: "Mostrar contraseña", exact: true })
    .click();
  await expect(login.locator("input[name=password]")).toHaveAttribute(
    "type",
    "text",
  );
  await login
    .getByRole("button", { name: "Ocultar contraseña", exact: true })
    .click();
  await expect(login.locator("input[name=password]")).toHaveAttribute(
    "type",
    "password",
  );
});

test("opening a reset email landing page never verifies or consumes the token", async ({
  page,
  request,
}) => {
  // This is a synthetic token. The landing page must render without contacting
  // the auth provider and without requiring a preexisting session/PKCE cookie.
  await page.goto(`/auth/confirm?token_hash=${"a".repeat(64)}&type=recovery`);
  await expect(
    page.getByRole("heading", { name: "Update password" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue to reset password" }),
  ).toBeVisible();
  await expect(page.locator("input[name=token_hash]")).toHaveValue(
    "a".repeat(64),
  );
  const response = await request.get(
    `/auth/confirm?token_hash=${"a".repeat(64)}&type=recovery`,
  );
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
});

test("invalid reset links offer a path back to request another email", async ({
  page,
}) => {
  for (const query of [
    "",
    "?token_hash=short&type=recovery",
    `?token_hash=${"a".repeat(64)}&type=signup`,
  ]) {
    await page.goto("/auth/confirm" + query);
    await expect(page.locator("p[role=alert]")).toContainText("invalid");
    await expect(
      page.getByRole("button", { name: "Continue to reset password" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Sign in", exact: true }),
    ).toBeVisible();
  }
});
