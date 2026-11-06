import { test } from "node:test";
import assert from "node:assert/strict";
import { publicSignup, captchaToken } from "../src/lib/signup";
const valid = {
  email: "new@example.test",
  password: "A valid password 123!",
  name: "New member",
  captchaToken: "synthetic-challenge-token",
};
test("public signup does not require invitation data but does require a challenge token", () => {
  assert.equal(publicSignup.safeParse(valid).success, true);
  for (const token of [undefined, "", "x".repeat(2049)])
    assert.equal(
      publicSignup.safeParse({ ...valid, captchaToken: token }).success,
      false,
    );
});
test("public signup validates names and passwords and reads only string challenge tokens", () => {
  for (const name of [" ", "A", "x".repeat(61)])
    assert.equal(publicSignup.safeParse({ ...valid, name }).success, false);
  for (const password of ["short", "x".repeat(129)])
    assert.equal(publicSignup.safeParse({ ...valid, password }).success, false);
  const form = new FormData();
  assert.equal(captchaToken(form), undefined);
  form.set("captcha_token", "synthetic-token");
  assert.equal(captchaToken(form), "synthetic-token");
  form.set("captcha_token", new Blob(["not-a-token"]));
  assert.equal(captchaToken(form), undefined);
});
