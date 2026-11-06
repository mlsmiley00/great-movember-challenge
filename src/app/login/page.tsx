import { translations } from "@/lib/i18n";
import { configured } from "@/lib/supabase/server";
import { signIn, signUp, requestReset } from "../actions";
import { Language, Mustache, Notice } from "../ui";
import { PasswordField } from "../password-field";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const t = await translations();
  const ready = configured();
  return (
    <main className="login">
      <div className="login-brand">
        <div className="topline">
          <span className="eyebrow">EST. 2026 · FRIENDS & FAMILY</span>
          <Language />
        </div>
        <div className="brand-art">
          <span className="round-label">THE GREAT</span>
          <Mustache />
          <h1>
            MOVEMBER
            <br />
            <i>CHALLENGE</i>
          </h1>
          <span className="date-chip">01 — 30 NOVEMBER 2026</span>
        </div>
        <div>
          <p className="eyebrow">{t.private}</p>
          <h2>{t.tagline}</h2>
          <p>{t.subtitle}</p>
        </div>
        <div className="barber-stripe" />
      </div>
      <div className="login-forms">
        <p className="eyebrow">A LITTLE FRIENDLY COMPETITION</p>
        <h2>{t.welcome}</h2>
        <p>{t.dates} · UTC</p>
        <Notice searchParams={searchParams} />
        {!ready && <p className="notice">{t.settings}</p>}
        <form action={signIn} className="stack">
          <label>
            {t.email}
            <input type="email" name="email" autoComplete="email" required />
          </label>
          <PasswordField
            label={t.password}
            showLabel={t.showPassword}
            hideLabel={t.hidePassword}
            autoComplete="current-password"
          />
          <button disabled={!ready}>
            {t.login} <span>↗</span>
          </button>
        </form>
        <details>
          <summary>
            {t.join} <span>+</span>
          </summary>
          <form action={signUp} className="stack">
            <label>
              {t.name}
              <input
                name="name"
                minLength={2}
                maxLength={60}
                autoComplete="nickname"
                required
              />
            </label>
            <label>
              {t.email}
              <input type="email" name="email" autoComplete="email" required />
            </label>
            <PasswordField
              label={t.password}
              showLabel={t.showPassword}
              hideLabel={t.hidePassword}
              autoComplete="new-password"
              minLength={12}
            />
            <small>12–128 characters / caracteres</small>
            <label>
              {t.invite}
              <input
                name="token"
                minLength={32}
                maxLength={128}
                autoComplete="off"
                required
              />
            </label>
            <label className="check">
              <input name="consent" type="checkbox" value="yes" required />
              <span>{t.consent}</span>
            </label>
            <button disabled={!ready}>{t.signup}</button>
            <small>{t.checkEmail}</small>
          </form>
        </details>
        <details>
          <summary>
            {t.reset}
            <span>+</span>
          </summary>
          <form action={requestReset} className="stack">
            <label>
              {t.email}
              <input type="email" name="email" required />
            </label>
            <button disabled={!ready}>{t.reset}</button>
          </form>
        </details>
        <p className="footnote">
          {t.private}
          <br />
          Made for showing up, together. <span aria-hidden>✦</span>
        </p>
      </div>
    </main>
  );
}
