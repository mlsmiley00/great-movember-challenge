import { cookies } from "next/headers";
import { admin, COMPETITION } from "@/lib/auth";
import { translations } from "@/lib/i18n";
import {
  invite,
  review,
  manageMember,
  announce,
  prize,
  editGoal,
  revokeInvite,
} from "../../actions";
import { PageTitle, Notice, Empty } from "../../ui";
import { Weekdays } from "../../goal-form";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { db } = await admin();
  const t = await translations();
  const results = await Promise.all([
    db
      .from("memberships")
      .select("*")
      .eq("competition_id", COMPETITION)
      .order("display_name"),
    db
      .from("progress_entries")
      .select("*")
      .eq("competition_id", COMPETITION)
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("goals").select("*").eq("competition_id", COMPETITION),
    db
      .from("prizes")
      .select("*")
      .eq("competition_id", COMPETITION)
      .order("place"),
    db
      .from("invitations")
      .select("id,email,expires_at,used_at")
      .eq("competition_id", COMPETITION)
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("evidence").select("entry_id").eq("competition_id", COMPETITION),
  ]);
  for (const r of results) if (r.error) throw r.error;
  const [people, entries, goals, prizes, invitations, evidence] = results.map(
    (r) => r.data || [],
  );
  const token = (await cookies()).get("new_invitation")?.value;
  return (
    <>
      <PageTitle eyebrow="KEEP THE CLUB RUNNING" title={t.admin} />
      <Notice searchParams={searchParams} />
      <div className="two-columns">
        <section className="panel">
          <h2>{t.inviteCreate}</h2>
          <form action={invite} className="stack">
            <label>
              {t.inviteEmail}
              <input type="email" name="email" maxLength={254} required />
            </label>
            <button>{t.inviteCreate}</button>
          </form>
          {token && (
            <div className="notice">
              <b>{t.invite} · 7 days / días</b>
              <code className="invite-code">{token}</code>
              <small>
                Share privately with the invited email owner. Visible here for 5
                minutes. / Comparte en privado. Visible durante 5 minutos.
              </small>
            </div>
          )}
          <div className="invitation-list">
            {invitations.map((i) => (
              <div className="entry" key={i.id}>
                <b>{i.email}</b>
                <p className="small">
                  {i.used_at
                    ? "Used / Usada"
                    : `Expires / Caduca: ${i.expires_at.slice(0, 10)}`}
                </p>
                {!i.used_at && (
                  <form action={revokeInvite}>
                    <input type="hidden" name="invitation" value={i.id} />
                    <button className="text-button">Revoke / Revocar</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2>{t.announcements}</h2>
          <form action={announce} className="stack">
            <label>
              {t.announcement}
              <textarea
                name="body"
                minLength={1}
                maxLength={2000}
                rows={4}
                required
              />
            </label>
            <button>{t.publish}</button>
          </form>
          <h2>{t.prizes}</h2>
          {prizes.map((p) => (
            <form action={prize} key={p.place} className="stack compact">
              <input type="hidden" name="place" value={p.place} />
              <label>
                #{p.place}
                <input
                  name="description"
                  maxLength={300}
                  defaultValue={p.description}
                  required
                />
              </label>
              <button className="secondary">{t.save}</button>
            </form>
          ))}
        </section>
      </div>
      <section className="panel">
        <h2>{t.verification} · Latest 100 / Últimos 100</h2>
        <p className="muted small">
          Honor and pending entries count until rejected. Rejected entries score
          zero. Review decisions lock owner edits. / Los registros cuentan hasta
          ser rechazados. La revisión bloquea las ediciones del participante.
        </p>
        {entries.length ? (
          entries.map((e) => (
            <details key={e.id}>
              <summary>
                {people.find((p) => p.user_id === e.user_id)?.display_name} ·{" "}
                {e.logged_on} · {e.verification}
                <span>+</span>
              </summary>
              <p>
                <b>{goals.find((g) => g.id === e.goal_id)?.title}</b> ·{" "}
                {e.value}
              </p>
              <p>{e.notes}</p>
              {evidence.some((v) => v.entry_id === e.id) && (
                <p>
                  <a
                    href={`/evidence/${e.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t.screenshot} ↗
                  </a>
                </p>
              )}
              <form action={review} className="stack">
                <input type="hidden" name="entry" value={e.id} />
                <label>
                  {t.verification}
                  <select
                    name="decision"
                    defaultValue={
                      e.verification === "pending" ? "verified" : e.verification
                    }
                  >
                    <option value="verified">{t.verified}</option>
                    <option value="rejected">{t.rejected}</option>
                    <option value="honor">{t.honor} (reopen / reabrir)</option>
                  </select>
                </label>
                <label>
                  Reason / Motivo
                  <input
                    name="reason"
                    maxLength={500}
                    defaultValue={e.review_note}
                  />
                </label>
                <button>{t.save}</button>
              </form>
            </details>
          ))
        ) : (
          <Empty>{t.noData}</Empty>
        )}
      </section>
      <section className="panel">
        <h2>{t.members}</h2>
        {people.map((p) => (
          <div className="member-row" key={p.user_id}>
            <span>
              <b>{p.display_name}</b>
              <small>
                {p.role} · {p.status}
              </small>
            </span>
            {p.role !== "admin" && (
              <form action={manageMember}>
                <input type="hidden" name="user" value={p.user_id} />
                <input
                  type="hidden"
                  name="status"
                  value={p.status === "active" ? "suspended" : "active"}
                />
                <button className="secondary">
                  {p.status === "active"
                    ? "Suspend / Suspender"
                    : "Restore / Restaurar"}
                </button>
              </form>
            )}
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>
          {t.goals} · {t.admin}
        </h2>
        <p className="notice">
          Changes recalculate historical scores. Document scoring corrections in
          an announcement. / Los cambios recalculan resultados históricos.
          Publica las correcciones en un anuncio.
        </p>
        {goals.map((g) => (
          <details key={g.id}>
            <summary>
              {people.find((p) => p.user_id === g.user_id)?.display_name} ·{" "}
              {g.title}
              <span>+</span>
            </summary>
            <form action={editGoal} className="stack">
              <input type="hidden" name="goal" value={g.id} />
              <label>
                {t.title}
                <input
                  name="title"
                  defaultValue={g.title}
                  maxLength={100}
                  minLength={2}
                  required
                />
              </label>
              <label>
                {t.fitness} / {t.personal}
                <select name="category" defaultValue={g.category}>
                  <option value="fitness">{t.fitness}</option>
                  <option value="personal">{t.personal}</option>
                </select>
              </label>
              <div className="form-grid">
                <label>
                  {t.target}
                  <input
                    name="target"
                    type="number"
                    min="0.001"
                    max="1000000000"
                    step="any"
                    defaultValue={g.target}
                    required
                  />
                </label>
                <label>
                  {t.unit}
                  <input
                    name="unit"
                    maxLength={30}
                    defaultValue={g.unit}
                    required
                  />
                </label>
              </div>
              <fieldset>
                <legend>{t.schedule}</legend>
                <Weekdays selected={g.weekdays} />
              </fieldset>
              <button>{t.save}</button>
            </form>
          </details>
        ))}
      </section>
    </>
  );
}
