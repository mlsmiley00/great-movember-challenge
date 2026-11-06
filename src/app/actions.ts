"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { supabase, configured } from "@/lib/supabase/server";
import { admin, member, COMPETITION } from "@/lib/auth";
import { translations } from "@/lib/i18n";
import { publicSignup, captchaToken } from "@/lib/signup";
import { signInFailure } from "@/lib/sign-in-error";
import { verifyRecovery, validPasswordPair } from "@/lib/password-recovery";
const text = (f: FormData, key: string) => String(f.get(key) || "").trim();
function fail(path: string, message: string): never {
  redirect(
    `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`,
  );
}
function success(path: string, message = "Saved / Guardado"): never {
  revalidatePath("/", "layout");
  redirect(
    `${path}${path.includes("?") ? "&" : "?"}message=${encodeURIComponent(message)}`,
  );
}
const site = () =>
  (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
export async function changeLocale(f: FormData) {
  (await cookies()).set("locale", text(f, "locale") === "es" ? "es" : "en", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 31536000,
  });
  revalidatePath("/", "layout");
}
export async function signIn(f: FormData) {
  if (!configured())
    fail("/login", "Supabase is not configured / Supabase no está configurado");
  const t = await translations();
  const token = captchaToken(f);
  if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !token)
    fail("/login", t.signInCaptcha);
  const db = await supabase();
  let authError: unknown = null;
  try {
    const { error } = await db.auth.signInWithPassword({
      email: text(f, "email"),
      password: String(f.get("password") || ""),
      options: { captchaToken: token },
    });
    authError = error;
  } catch (error) {
    authError = error;
  }
  if (authError) {
    const failure = signInFailure(authError);
    const reference = randomUUID();
    console.error(
      JSON.stringify({
        event: "sign_in_failed",
        reference,
        ...failure,
        widgetConfigured: Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
      }),
    );
    const message =
      failure.kind === "captcha"
        ? t.signInCaptcha
        : failure.kind === "credentials"
          ? t.signInCredentials
          : failure.kind === "unverified"
            ? t.signInUnverified
            : failure.kind === "rateLimited"
              ? t.signInRateLimited
              : t.signInUnavailable;
    fail("/login", `${message} ${t.authReference}: ${reference}`);
  }
  redirect("/");
}
export async function signUp(f: FormData) {
  const t = await translations();
  if (!configured() || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
    fail("/login", t.signupUnavailable);
  const result = publicSignup.safeParse({
    email: text(f, "email"),
    password: String(f.get("password") || ""),
    name: text(f, "name"),
    captchaToken: captchaToken(f),
  });
  if (!result.success || f.get("consent") !== "yes")
    fail("/login", t.signupInvalid);
  const db = await supabase();
  const { data: open, error: statusError } = await db.rpc(
    "public_registration_open",
  );
  if (statusError || open !== true) fail("/login", t.signupUnavailable);
  const { error } = await db.auth.signUp({
    email: result.data.email,
    password: result.data.password,
    options: {
      captchaToken: result.data.captchaToken,
      emailRedirectTo: site() + "/auth/callback",
      data: { display_name: result.data.name, club_consent: true },
    },
  });
  if (error) fail("/login", t.signupInvalid);
  success("/login", t.checkEmail);
}
export async function joinPublicCompetition(f: FormData) {
  const t = await translations();
  if (!configured()) fail("/login", t.signupUnavailable);
  const db = await supabase();
  const { error } = await db.rpc("join_public_competition", {
    chosen_name: text(f, "name"),
    consented: f.get("consent") === "yes",
  });
  if (error) fail("/join", t.joinError);
  success("/");
}
export async function acceptInvitation(f: FormData) {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await db.rpc("accept_invitation", {
    token: text(f, "token"),
    chosen_name: text(f, "name"),
  });
  if (error)
    fail(
      "/join",
      "Invitation invalid, expired, used, or email not verified. Contact your administrator. / Invitación no válida o correo sin verificar.",
    );
  await db.auth.updateUser({ data: { invitation_token: null } });
  success("/");
}
export async function signOut() {
  if (configured()) {
    const db = await supabase();
    await db.auth.signOut();
  }
  redirect("/login");
}
export async function requestReset(f: FormData) {
  if (!configured()) fail("/login", "Supabase is not configured");
  const db = await supabase();
  const t = await translations();
  const email = text(f, "email");
  if (!z.email().safeParse(email).success) fail("/login", t.resetRequestError);
  const { error } = await db.auth.resetPasswordForEmail(email, {
    // Retain compatibility with older email templates while the new direct
    // token-hash template uses the canonical Site URL and confirmation page.
    redirectTo: site() + "/auth/callback?next=/join?recovery=1",
    captchaToken: captchaToken(f),
  });
  if (error) fail("/login", t.resetRequestError);
  success(
    "/login",
    "If that account exists, a recovery email has been sent. / Si existe la cuenta, recibirás un correo de recuperación.",
  );
}
export async function confirmRecovery(f: FormData) {
  const t = await translations();
  if (!configured()) fail("/login", t.recoveryInvalid);
  const db = await supabase();
  const verified = await verifyRecovery(f.get("token_hash"), async (input) => {
    const { data, error } = await db.auth.verifyOtp(input);
    return {
      error: error || (!data.session ? new Error("No recovery session") : null),
    };
  });
  if (!verified) fail("/login", t.recoveryInvalid);
  // Always remove the one-time token from the destination URL.
  redirect("/join?recovery=1");
}
export async function updatePassword(f: FormData) {
  const t = await translations();
  const value = String(f.get("password") || "");
  const confirmation = String(f.get("password_confirmation") || "");
  if (!validPasswordPair(value, confirmation))
    fail("/join?recovery=1", t.passwordMismatch);
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) fail("/login", t.recoveryInvalid);
  const { error } = await db.auth.updateUser({ password: value });
  if (error) fail("/join?recovery=1", t.passwordSaveError);
  success("/", t.passwordSaved);
}
export async function createGoal(f: FormData) {
  const { db } = await member();
  const parsed = z
    .object({
      title: z.string().min(2).max(100),
      category: z.enum(["fitness", "personal"]),
      target: z.coerce.number().positive().max(1e9),
      unit: z.string().min(1).max(30),
      weekdays: z.array(z.coerce.number().int().min(0).max(6)).min(1).max(7),
    })
    .safeParse({
      title: text(f, "title"),
      category: text(f, "category"),
      target: f.get("target"),
      unit: text(f, "unit"),
      weekdays: f.getAll("weekdays"),
    });
  if (!parsed.success)
    fail(
      "/goals",
      "Check goal details and select at least one day. / Revisa la meta y selecciona al menos un día.",
    );
  const g = parsed.data;
  const { error } = await db.rpc("save_goal", {
    cid: COMPETITION,
    goal_title: g.title,
    goal_category: g.category,
    goal_target: g.target,
    goal_unit: g.unit,
    goal_weekdays: g.weekdays,
  });
  if (error) fail("/goals", error.message);
  success("/goals");
}
export async function recordProgress(f: FormData) {
  const { db, user } = await member();
  const parsed = z
    .object({
      gid: z.uuid(),
      day: z.iso.date(),
      amount: z.coerce.number().min(0).max(1e9),
      notes: z.string().max(1000),
      timezone: z
        .string()
        .min(1)
        .max(100)
        .refine((zone) => {
          try {
            new Intl.DateTimeFormat("en", { timeZone: zone });
            return true;
          } catch {
            return false;
          }
        }),
    })
    .safeParse({
      gid: text(f, "goal"),
      day: text(f, "date"),
      amount: f.get("value"),
      notes: text(f, "notes"),
      timezone: text(f, "timezone") || "UTC",
    });
  if (!parsed.success)
    fail(
      "/log",
      "Check date, goal, and amount. / Revisa la fecha, meta y cantidad.",
    );
  const file = f.get("screenshot");
  let path: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (
      file.size > 3 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      fail(
        "/log",
        "Use a JPG, PNG or WebP under 3 MB. / Usa JPG, PNG o WebP de menos de 3 MB.",
      );
    // MIME declarations are untrusted; inspect the file signature as well.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const valid =
      file.type === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
        : file.type === "image/jpeg"
          ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
          : String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
            String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!valid) fail("/log", "Invalid image file / Imagen no válida");
    path = `${user.id}/${randomUUID()}.${file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp"}`;
    const { error } = await db.storage
      .from("progress-evidence")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (error)
      fail(
        "/log",
        "Screenshot upload failed. Try again or use honor reporting. / No se pudo subir la captura.",
      );
  }
  const p = parsed.data;
  const { error } = await db.rpc("record_progress", {
    gid: p.gid,
    day: p.day,
    amount: p.amount,
    entry_notes: p.notes,
    screenshot_path: path,
    reporting_timezone: p.timezone,
  });
  if (error) {
    if (path) await db.storage.from("progress-evidence").remove([path]);
    fail("/log", error.message);
  }
  success("/log");
}
export async function removeGoal(f: FormData) {
  const { db } = await member();
  const t = await translations();
  const gid = text(f, "goal");
  if (!z.uuid().safeParse(gid).success || text(f, "confirm") !== "yes")
    fail("/goals", t.goalRemoveError);
  const { data, error } = await db.rpc("remove_own_goal", { gid });
  if (error) fail("/goals", t.goalRemoveError);
  // Metadata is removed transactionally first. Existing storage policies permit
  // the owner to clean up only screenshots that are no longer referenced.
  let cleanupFailed = false;
  if (Array.isArray(data) && data.length) {
    try {
      const { error: cleanupError } = await db.storage
        .from("progress-evidence")
        .remove(data);
      cleanupFailed = Boolean(cleanupError);
    } catch {
      cleanupFailed = true;
    }
  }
  if (cleanupFailed) success("/goals", t.goalRemovedCleanup);
  success("/goals", t.goalRemoved);
}

export async function createTeam(f: FormData) {
  const { db } = await member();
  const { error } = await db.rpc("create_team", {
    cid: COMPETITION,
    team_name: text(f, "name"),
  });
  if (error) fail("/teams", error.message);
  success("/teams");
}
export async function joinTeam(f: FormData) {
  const { db } = await member();
  const { error } = await db.rpc("join_team", {
    cid: COMPETITION,
    tid: text(f, "team") || null,
  });
  if (error) fail("/teams", error.message);
  success("/teams");
}
export async function comment(f: FormData) {
  const { db } = await member();
  const { error } = await db.rpc("add_comment", {
    eid: text(f, "entry"),
    content: text(f, "body"),
  });
  if (error) fail("/community", error.message);
  success("/community");
}
export async function react(f: FormData) {
  const { db } = await member();
  const { error } = await db.rpc("toggle_reaction", { eid: text(f, "entry") });
  if (error) fail("/community", error.message);
  success("/community");
}
export async function invite(f: FormData) {
  const { db } = await admin();
  const email = text(f, "email");
  if (!z.email().safeParse(email).success) fail("/admin", "Invalid email");
  const token = randomBytes(32).toString("hex");
  const { error } = await db.rpc("create_invitation", {
    cid: COMPETITION,
    invited_email: email,
    token,
  });
  if (error) fail("/admin", error.message);
  // Store the one-time code in a short-lived HttpOnly cookie, never a URL or server log.
  (await cookies()).set("new_invitation", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 300,
  });
  success(
    "/admin",
    "Invitation created. Share the code privately. / Comparte el código en privado.",
  );
}
export async function setProgressReview(f: FormData) {
  const { db } = await admin();
  const t = await translations();
  const mode = text(f, "review_mode");
  if (mode !== "honor" && mode !== "required")
    fail("/admin", t.reviewModeError);
  const { error } = await db.rpc("set_progress_review", {
    cid: COMPETITION,
    review_required: mode === "required",
  });
  if (error) fail("/admin", t.reviewModeError);
  success("/admin", t.reviewModeSaved);
}

export async function review(f: FormData) {
  const { db } = await admin();
  const { error } = await db.rpc("review_progress", {
    eid: text(f, "entry"),
    decision: text(f, "decision"),
    reason: text(f, "reason"),
  });
  if (error) fail("/admin", error.message);
  success("/admin");
}
export async function manageMember(f: FormData) {
  const { db } = await admin();
  const { error } = await db.rpc("manage_member", {
    cid: COMPETITION,
    uid: text(f, "user"),
    member_status: text(f, "status"),
  });
  if (error) fail("/admin", error.message);
  success("/admin");
}
export async function announce(f: FormData) {
  const { db } = await admin();
  const { error } = await db.rpc("publish_announcement", {
    cid: COMPETITION,
    content: text(f, "body"),
  });
  if (error) fail("/admin", error.message);
  success("/admin");
}
export async function prize(f: FormData) {
  const { db } = await admin();
  const { error } = await db.rpc("set_prize", {
    cid: COMPETITION,
    prize_position: Number(f.get("place")),
    content: text(f, "description"),
  });
  if (error) fail("/admin", error.message);
  success("/admin");
}
export async function editGoal(f: FormData) {
  const { db } = await admin();
  const { error } = await db.rpc("admin_edit_goal", {
    gid: text(f, "goal"),
    goal_title: text(f, "title"),
    goal_category: text(f, "category"),
    goal_target: Number(f.get("target")),
    goal_unit: text(f, "unit"),
    goal_weekdays: f.getAll("weekdays").map(Number),
  });
  if (error) fail("/admin", error.message);
  success("/admin");
}
export async function revokeInvite(f: FormData) {
  const { db } = await admin();
  const { error } = await db.rpc("revoke_invitation", {
    iid: text(f, "invitation"),
  });
  if (error) fail("/admin", error.message);
  success("/admin");
}

export async function updateDisplayName(f: FormData) {
  const { db } = await member();
  const t = await translations();
  const name = text(f, "name").replace(/\s+/gu, " ");
  const parsed = z.string().min(2).max(60).safeParse(name);
  if (!parsed.success) fail("/profile", t.nameInvalid);
  const { error } = await db.rpc("update_display_name", {
    cid: COMPETITION,
    chosen_name: parsed.data,
  });
  if (error) fail("/profile", t.nameSaveError);
  success("/profile", t.nameSaved);
}
