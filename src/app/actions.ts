"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { supabase, configured } from "@/lib/supabase/server";
import { admin, member, COMPETITION } from "@/lib/auth";
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
  const db = await supabase();
  const { error } = await db.auth.signInWithPassword({
    email: text(f, "email"),
    password: String(f.get("password") || ""),
  });
  if (error)
    fail(
      "/login",
      "Unable to sign in. Check your credentials and verify your email. / Revisa tus datos y verifica tu correo.",
    );
  redirect("/");
}
export async function signUp(f: FormData) {
  if (!configured()) fail("/login", "Supabase is not configured");
  const result = z
    .object({
      email: z.email(),
      password: z.string().min(12).max(128),
      name: z.string().min(2).max(60),
      token: z.string().min(32).max(128),
    })
    .safeParse({
      email: text(f, "email"),
      password: String(f.get("password") || ""),
      name: text(f, "name"),
      token: text(f, "token"),
    });
  if (!result.success || f.get("consent") !== "yes")
    fail(
      "/login",
      "Check your details, invitation code, password (12+ characters), and privacy consent. / Revisa tus datos, código, contraseña (12+ caracteres) y consentimiento.",
    );
  const db = await supabase();
  const { error } = await db.auth.signUp({
    email: result.data.email,
    password: result.data.password,
    options: {
      emailRedirectTo: site() + "/auth/callback",
      data: {
        display_name: result.data.name,
        invitation_token: result.data.token,
      },
    },
  });
  if (error)
    fail(
      "/login",
      "Registration could not be completed. Try again or contact your administrator. / No se pudo completar el registro.",
    );
  success(
    "/login",
    "Check your email to verify your account. / Revisa tu correo para verificar tu cuenta.",
  );
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
  await db.auth.resetPasswordForEmail(text(f, "email"), {
    redirectTo: site() + "/auth/callback?next=/join?recovery=1",
  });
  success(
    "/login",
    "If that account exists, a recovery email has been sent. / Si existe la cuenta, recibirás un correo de recuperación.",
  );
}
export async function updatePassword(f: FormData) {
  const value = String(f.get("password") || "");
  if (value.length < 12 || value.length > 128)
    fail("/join?recovery=1", "Use 12–128 characters / Usa 12–128 caracteres");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await db.auth.updateUser({ password: value });
  if (error)
    fail(
      "/join",
      "Unable to change password / No se pudo cambiar la contraseña",
    );
  success("/");
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
    })
    .safeParse({
      gid: text(f, "goal"),
      day: text(f, "date"),
      amount: f.get("value"),
      notes: text(f, "notes"),
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
  });
  if (error) {
    if (path) await db.storage.from("progress-evidence").remove([path]);
    fail("/log", error.message);
  }
  success("/log");
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
