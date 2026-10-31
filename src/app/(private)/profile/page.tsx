import { member } from "@/lib/auth";
import { translations } from "@/lib/i18n";
import { updateDisplayName } from "../../actions";
import { Notice, PageTitle } from "../../ui";
export default async function Profile({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { membership } = await member();
  const t = await translations();
  return (
    <>
      <PageTitle eyebrow="MOVEMBER 2026" title={t.profile}>
        <p>{t.profileIntro}</p>
      </PageTitle>
      <Notice searchParams={searchParams} />
      <section className="panel profile-panel">
        <h2>{t.name}</h2>
        <form action={updateDisplayName} className="stack">
          <label htmlFor="display-name">{t.name}</label>
          <input
            id="display-name"
            name="name"
            autoComplete="nickname"
            defaultValue={membership.display_name}
            minLength={2}
            maxLength={60}
            required
            aria-describedby="name-help"
          />
          <p id="name-help" className="muted small">
            {t.nameHelp}
          </p>
          <button>{t.save}</button>
        </form>
      </section>
    </>
  );
}
