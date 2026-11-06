import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validPasswordPair,
  verifyRecovery,
} from "../src/lib/password-recovery";

test("a fresh browser can verify a recovery token without a PKCE verifier", async () => {
  let calls = 0;
  const token = "a".repeat(64);
  assert.equal(
    await verifyRecovery(token, async (input) => {
      calls++;
      assert.deepEqual(input, { token_hash: token, type: "recovery" });
      return { error: null };
    }),
    true,
  );
  assert.equal(calls, 1);
});
test("expired or reused recovery tokens fail without creating a valid session", async () => {
  let used = false;
  const verify = async () => {
    if (used) return { error: { message: "used" } };
    used = true;
    return { error: null };
  };
  assert.equal(await verifyRecovery("a".repeat(64), verify), true);
  assert.equal(await verifyRecovery("a".repeat(64), verify), false);
  assert.equal(
    await verifyRecovery("b".repeat(64), async () => ({
      error: { message: "expired" },
    })),
    false,
  );
});
test("malformed recovery tokens never reach the provider", async () => {
  let calls = 0;
  for (const token of [
    undefined,
    null,
    [],
    "short",
    " ".repeat(64),
    "https://evil.example/token",
    "x".repeat(513),
  ]) {
    assert.equal(
      await verifyRecovery(token, async () => {
        calls++;
        return { error: null };
      }),
      false,
    );
  }
  assert.equal(calls, 0);
});
test("network errors during verification produce a recoverable failure", async () => {
  assert.equal(
    await verifyRecovery("a".repeat(64), async () => {
      throw new Error("network");
    }),
    false,
  );
});
test("password confirmation preserves exact characters and rejects mismatches and invalid lengths", () => {
  assert.equal(
    validPasswordPair("a secure password!", "a secure password!"),
    true,
  );
  assert.equal(
    validPasswordPair(" a secure password! ", " a secure password! "),
    true,
  );
  assert.equal(
    validPasswordPair("a secure password!", "a secure password?"),
    false,
  );
  assert.equal(validPasswordPair("a secure password!", ""), false);
  assert.equal(validPasswordPair("x".repeat(11), "x".repeat(11)), false);
  assert.equal(validPasswordPair("x".repeat(129), "x".repeat(129)), false);
});
