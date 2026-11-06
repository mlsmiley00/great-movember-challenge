import Link from "next/link";
import { translations } from "@/lib/i18n";
import { configured } from "@/lib/supabase/server";
import { recoveryToken } from "@/lib/password-recovery";
import { confirmRecovery } from "../../actions";
import { AuthSubmit } from "../../auth-submit";
import { Language, Mustache } from "../../ui";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function ConfirmRecovery({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const t = await translations();
  const token = recoveryToken.safeParse(p.token_hash);
  const valid = token.success && p.type === "recovery";
  return (
    <main className="auth-card">
      <Language />
      <Mustache />
      <h1>{t.updatePassword}</h1>
      {valid ? (
        <>
          <p>{t.recoveryContinueHelp}</p>
          <form action={confirmRecovery} className="stack">
            <input type="hidden" name="token_hash" value={token.data} />
            <AuthSubmit disabled={!configured()}>
              {t.recoveryContinue}
            </AuthSubmit>
          </form>
          {!configured() && <p className="notice">{t.settings}</p>}
        </>
      ) : (
        <p role="alert" className="notice error">
          {t.recoveryInvalid}
        </p>
      )}
      <p>
        <Link href="/login">{t.login}</Link>
      </p>
    </main>
  );
}
