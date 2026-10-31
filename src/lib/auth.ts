import { redirect } from "next/navigation";
import { supabase, configured } from "./supabase/server";
export const COMPETITION = "20260000-0000-4000-8000-000000000001";
export async function member() {
  if (!configured()) redirect("/login");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await db
    .from("memberships")
    .select("*")
    .eq("competition_id", COMPETITION)
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();
  if (!membership || !user.email_confirmed_at) redirect("/join");
  return { db, user, membership };
}
export async function admin() {
  const ctx = await member();
  if (ctx.membership.role !== "admin") redirect("/");
  return ctx;
}
