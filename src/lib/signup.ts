import { z } from "zod";
export const publicSignup = z.object({
  email: z.email(),
  password: z.string().min(12).max(128),
  name: z.string().trim().min(2).max(60),
  captchaToken: z.string().min(1).max(2048),
});
export function captchaToken(form: FormData) {
  const result = z
    .string()
    .min(1)
    .max(2048)
    .safeParse(form.get("captcha_token"));
  return result.success ? result.data : undefined;
}
