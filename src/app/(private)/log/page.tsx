import { member, COMPETITION } from "@/lib/auth";
import { translations } from "@/lib/i18n";
import { recordProgress } from "../../actions";
import { PageTitle, Notice, Empty } from "../../ui";
import Link from "next/link";
export default async function Log({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { db, user } = await member();
  const t = await translations();
  const [g, e, v] = await Promise.all([
    db
      .from("goals")
      .select("*")
      .eq("competition_id", COMPETITION)
      .eq("user_id", user.id),
    db
      .from("progress_entries")
      .select("*")
      .eq("competition_id", COMPETITION)
      .eq("user_id", user.id)
      .order("logged_on", { ascending: false })
      .limit(90),
    db
      .from("evidence")
      .select("entry_id")
      .eq("competition_id", COMPETITION)
      .eq("user_id", user.id),
  ]);
  for (const r of [g, e, v]) if (r.error) throw r.error;
  const today = new Date().toISOString().slice(0, 10);
  const day =
    today < "2026-11-01"
      ? "2026-11-01"
      : today > "2026-11-30"
        ? "2026-11-30"
        : today;
  const labels = {
    honor: t.honor,
    pending: t.pending,
    verified: t.verified,
    rejected: t.rejected,
  };
  return (
    <>
      <PageTitle eyebrow="SHOW UP FOR YOURSELF" title={t.log}>
        <p>{t.progress}</p>
      </PageTitle>
      <Notice searchParams={searchParams} />
      <div className="two-columns">
        <section className="panel">
          <h2>{t.submit}</h2>
          {g.data?.length ? (
            <form action={recordProgress} className="stack">
              <label>
                {t.goals}
                <select name="goal" required>
                  {g.data.map((goal) => (
                    <option key={goal.id} value={goal.id}>
                      {goal.title} · {goal.target} {goal.unit}
                    </option>
                  ))}
                </select>
              </label>
              <div className="form-grid">
                <label>
                  {t.date} (UTC)
                  <input
                    name="date"
                    type="date"
                    min="2026-11-01"
                    max={today < "2026-11-01" ? "2026-11-01" : day}
                    defaultValue={day}
                    required
                  />
                </label>
                <label>
                  {t.value}
                  <input
                    type="number"
                    name="value"
                    min="0"
                    max="1000000000"
                    step="any"
                    required
                  />
                </label>
              </div>
              <label>
                {t.notes}
                <textarea name="notes" rows={3} maxLength={1000} />
              </label>
              <label>
                {t.screenshot}
                <input
                  name="screenshot"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                />
                <small>JPG, PNG, WebP · 3 MB max · {t.private}</small>
              </label>
              <p className="small muted">
                {t.honor} · {t.consent}
              </p>
              <button disabled={today < "2026-11-01"}>{t.submit} ↗</button>
              <p className="small muted">
                {t.date}: UTC. {t.dates}. 48h grace / 48h de gracia. Editing an
                unreviewed day replaces its entry and screenshot / Editar un día
                sin revisar reemplaza su registro y captura.
              </p>
            </form>
          ) : (
            <Empty>
              {t.noGoals}
              <br />
              <Link href="/goals">{t.create} ↗</Link>
            </Empty>
          )}
        </section>
        <section className="panel">
          <h2>{t.activity}</h2>
          {e.data?.length ? (
            e.data.map((entry) => (
              <article className="entry" key={entry.id}>
                <div className="entry-top">
                  <b>
                    {g.data?.find((goal) => goal.id === entry.goal_id)?.title}
                  </b>
                  <span className={`pill ${entry.verification}`}>
                    {labels[entry.verification as keyof typeof labels]}
                  </span>
                </div>
                <strong>
                  {Number(entry.value).toLocaleString()}{" "}
                  <small>
                    {g.data?.find((goal) => goal.id === entry.goal_id)?.unit}
                  </small>
                </strong>
                <p className="small muted">{entry.logged_on} · UTC</p>
                {entry.notes && <p>{entry.notes}</p>}
                {entry.review_note && (
                  <p className="notice">{entry.review_note}</p>
                )}
                {v.data?.some((v) => v.entry_id === entry.id) && (
                  <a
                    href={`/evidence/${entry.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.screenshot} ↗
                  </a>
                )}
              </article>
            ))
          ) : (
            <Empty>{t.noData}</Empty>
          )}
        </section>
      </div>
    </>
  );
}
