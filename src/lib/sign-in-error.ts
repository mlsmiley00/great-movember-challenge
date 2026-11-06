export type SignInFailureKind =
  "captcha" | "credentials" | "unverified" | "rateLimited" | "unavailable";
const codes = new Set([
  "captcha_failed",
  "invalid_credentials",
  "email_not_confirmed",
  "over_request_rate_limit",
  "over_email_send_rate_limit",
  "request_timeout",
]);
export function signInFailure(error: unknown) {
  const value =
    error && typeof error === "object"
      ? (error as { code?: unknown; status?: unknown })
      : {};
  const code =
    typeof value.code === "string" && codes.has(value.code)
      ? value.code
      : "unknown";
  const status =
    typeof value.status === "number" &&
    Number.isInteger(value.status) &&
    value.status >= 100 &&
    value.status <= 599
      ? value.status
      : null;
  const kind: SignInFailureKind =
    code === "captcha_failed"
      ? "captcha"
      : code === "invalid_credentials"
        ? "credentials"
        : code === "email_not_confirmed"
          ? "unverified"
          : status === 429 ||
              code === "over_request_rate_limit" ||
              code === "over_email_send_rate_limit"
            ? "rateLimited"
            : "unavailable";
  return { kind, code, status };
}
