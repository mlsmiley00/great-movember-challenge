import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export function configured() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return false;
  try {
    const api = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (!["http:", "https:"].includes(api.protocol)) return false;
    if (process.env.NODE_ENV === "production") {
      const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL || "");
      if (
        origin.protocol !== "https:" &&
        !["localhost", "127.0.0.1"].includes(origin.hostname)
      )
        return false;
    }
    return true;
  } catch {
    return false;
  }
}
export async function supabase() {
  if (!configured())
    throw new Error("Supabase is not configured. Follow README.md.");
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll(values) {
          try {
            values.forEach(({ name, value, options }) =>
              jar.set(name, value, options),
            );
          } catch {
            /* Server Components cannot set cookies; proxy refreshes them. */
          }
        },
      },
    },
  );
}
