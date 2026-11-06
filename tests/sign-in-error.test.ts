import { test } from "node:test";
import assert from "node:assert/strict";
import { signInFailure } from "../src/lib/sign-in-error";
test("sign-in distinguishes CAPTCHA failure from incorrect credentials", () => {
  assert.equal(
    signInFailure({ code: "captcha_failed", status: 400 }).kind,
    "captcha",
  );
  assert.equal(
    signInFailure({ code: "invalid_credentials", status: 400 }).kind,
    "credentials",
  );
  assert.equal(
    signInFailure({ code: "email_not_confirmed", status: 400 }).kind,
    "unverified",
  );
  assert.equal(
    signInFailure({ code: "over_request_rate_limit", status: 429 }).kind,
    "rateLimited",
  );
});
test("sign-in diagnostics never retain raw errors or account information", () => {
  assert.deepEqual(
    signInFailure({
      code: "secret@example.test",
      status: 500,
      message: "token=secret",
      password: "secret",
    }),
    { kind: "unavailable", code: "unknown", status: 500 },
  );
  assert.deepEqual(signInFailure(null), {
    kind: "unavailable",
    code: "unknown",
    status: null,
  });
});
