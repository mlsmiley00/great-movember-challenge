import { member, COMPETITION } from "@/lib/auth";
import { translations } from "@/lib/i18n";
import { PageTitle, Notice, Empty, Meter } from "../../ui";
import { GoalForm } from "../../goal-form";
export default async function Goals({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { db } = await member();
  const t = await translations();
  const { user } = await member();
  const { data: goals, error } = await db
    .from("goal_scores")
    .select("*")
    .eq("competition_id", COMPETITION)
    .eq("user_id", user.id);
  if (error) throw error;
  return (
    <>
      <PageTitle eyebrow="MAKE IT PERSONAL" title={t.goals}>
        <p>{t.progress}</p>
      </PageTitle>
      <Notice searchParams={searchParams} />
      <div className="two-columns">
        <section className="panel">
          <h2>{t.goals}</h2>
          {goals?.length ? (
            goals.map((g) => (
              <article key={g.id} className="goal-card">
                <span className="pill">
                  {g.category === "fitness" ? t.fitness : t.personal} ·{" "}
                  {g.weight}×
                </span>
                <h3>{g.title}</h3>
                <p>
                  {g.target.toLocaleString()} {g.unit} · {g.weekdays.length}/7{" "}
                  {t.days}
                </p>
                <Meter value={Number(g.score)} />
                <p className="small">
                  {g.completed_days}/{g.scheduled_days} {t.days} ·{" "}
                  {Number(g.score).toFixed(1)} / 100
                </p>
              </article>
            ))
          ) : (
            <Empty>{t.noGoals}</Empty>
          )}
          <p className="muted small">{t.locked}</p>
        </section>
        <section className="panel">
          <h2>{t.create}</h2>
          <GoalForm />
        </section>
      </div>
      <section className="rules-card">
        <h2>{t.rules}</h2>
        <p>{t.ruleText}</p>
      </section>
    </>
  );
}
