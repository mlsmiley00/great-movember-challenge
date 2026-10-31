import { member, COMPETITION } from "@/lib/auth";
import { translations, locale } from "@/lib/i18n";
import { createTeam, joinTeam } from "../../actions";
import { PageTitle, Notice, Empty } from "../../ui";
export default async function Teams({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { db, membership } = await member();
  const t = await translations();
  const lang = await locale();
  const { data: teams, error } = await db
    .from("team_scores")
    .select("*")
    .eq("competition_id", COMPETITION)
    .order("name");
  if (error) throw error;
  return (
    <>
      <PageTitle eyebrow="BETTER TOGETHER" title={t.teams}>
        <p>
          {lang === "en"
            ? "Bring your family. Build your momentum. You can join or change teams through November 30, even after logging progress. Your progress stays with you."
            : "Invita a tu familia. Puedes unirte o cambiar de equipo hasta el 30 de noviembre, incluso después de registrar avances. Conservas tu progreso."}
        </p>
      </PageTitle>
      <Notice searchParams={searchParams} />
      <div className="two-columns">
        <section className="panel">
          <h2>{t.teams}</h2>
          {teams?.length ? (
            teams.map((team) => (
              <article className="team-card" key={team.id}>
                <span className="team-icon">✦</span>
                <div>
                  <h3>{team.name}</h3>
                  <p>
                    {team.member_count} {t.members} ·{" "}
                    {Number(team.score).toFixed(1)} /100
                  </p>
                </div>
                <form action={joinTeam}>
                  <input type="hidden" name="team" value={team.id} />
                  <button
                    className="secondary"
                    disabled={membership.team_id === team.id}
                  >
                    {membership.team_id === team.id
                      ? lang === "en"
                        ? "Your team ✓"
                        : "Tu equipo ✓"
                      : lang === "en"
                        ? "Join team"
                        : "Unirme al equipo"}
                  </button>
                </form>
              </article>
            ))
          ) : (
            <Empty>{t.empty}</Empty>
          )}
          {membership.team_id && (
            <form action={joinTeam}>
              <button className="text-button">
                {lang === "en" ? "Leave team" : "Salir del equipo"}
              </button>
            </form>
          )}
        </section>
        <section className="panel">
          <h2>{t.create}</h2>
          <form action={createTeam} className="stack">
            <label>
              {t.team}
              <input name="name" minLength={2} maxLength={60} required />
            </label>
            <button>{t.create} ↗</button>
          </form>
          <p className="muted">{t.ruleText}</p>
        </section>
      </div>
    </>
  );
}
