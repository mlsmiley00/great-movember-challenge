import { redirect } from "next/navigation";
import { configured, supabase } from "@/lib/supabase/server";
import { translations } from "@/lib/i18n";
import { joinPublicCompetition, signOut, updatePassword } from "../actions";
import { Language, Mustache, Notice } from "../ui";
import { PasswordField } from "../password-field";
import { AuthSubmit } from "../auth-submit";
export default async function Join({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  if (!configured()) redirect("/login");
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const t = await translations();
  const p = await searchParams;
  return (
    <main className="auth-card">
      <Language />
      <Mustache />
      <h1>{p.recovery ? t.updatePassword : t.join}</h1>
      <Notice searchParams={searchParams} />
      {p.recovery ? (
        <form action={updatePassword} className="stack">
          <PasswordField
            label={t.choosePassword}
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
            autoComplete="new-password"
            minLength={12}
          />
          <PasswordField
            label={t.confirmPassword}
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
            name="password_confirmation"
            autoComplete="new-password"
            minLength={12}
          />
          <small>{t.passwordHelp}</small>
          <AuthSubmit>{t.save}</AuthSubmit>
        </form>
      ) : (
        <>
          <p>{user.email}</p>
          <p>{t.consent}</p>
          <form action={joinPublicCompetition} className="stack">
            <label>
              {t.name}
              <input
                name="name"
                minLength={2}
                maxLength={60}
                defaultValue={user.user_metadata.display_name || ""}
                required
              />
            </label>
            <label className="check">
              <input name="consent" type="checkbox" value="yes" required />
              <span>{t.consent}</span>
            </label>
            <AuthSubmit>{t.join}</AuthSubmit>
          </form>
        </>
      )}
      <form action={signOut}>
        <button className="text-button">{t.logout}</button>
      </form>
    </main>
  );
}
