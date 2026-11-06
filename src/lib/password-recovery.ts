import { z } from "zod";
export const recoveryToken = z
  .string()
  .min(20)
  .max(512)
  .regex(/^[a-zA-Z0-9_-]+$/);
export function validPasswordPair(password: string, confirmation: string) {
  return (
    password.length >= 12 && password.length <= 128 && password === confirmation
  );
}
// The provider validates expiry and single use. A token hash is independent of
// the requesting browser's PKCE verifier, and can be verified on a fresh device.
export async function verifyRecovery(
  token: unknown,
  verify: (input: {
    token_hash: string;
    type: "recovery";
  }) => Promise<{ error: unknown }>,
) {
  const parsed = recoveryToken.safeParse(token);
  if (!parsed.success) return false;
  try {
    const { error } = await verify({
      token_hash: parsed.data,
      type: "recovery",
    });
    return !error;
  } catch {
    return false;
  }
}
