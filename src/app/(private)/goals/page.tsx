import Link from "next/link";
import { member, COMPETITION } from "@/lib/auth";
import { translations, locale } from "@/lib/i18n";
import { PageTitle, Notice, Empty, Meter } from "../../ui";
import { GoalForm } from "../../goal-form";

type Goal = {
  id: string;
  user_id: string;
  title: string;
  category: string;
  target: number | string;
  unit: string;
  weekdays: number[];
  weight: number;
  score: number | string;
  completed_days: number;
  scheduled_days: number;
};
export default async function Goals({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { db, user } = await member();
  const t = await translations();
  const lang = await locale();
  const everyone = (await searchParams).view === "members";
  let query = db
    .from("goal_scores")
    .select("*")
    .eq("competition_id", COMPETITION)
    .order("title");
  if (!everyone) query = query.eq("user_id", user.id);
  const [goalResult, memberResult] = await Promise.all([
    query,
    everyone
      ? db
          .from("memberships")
          .select("user_id,display_name")
          .eq("competition_id", COMPETITION)
          .eq("status", "active")
          .order("display_name")
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (goalResult.error) throw goalResult.error;
  if (memberResult.error) throw memberResult.error;
  const goals: Goal[] = goalResult.data || [];
  const days =
    lang === "en"
      ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
      : ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
  function goalCard(g: Goal) {
    return (
      <article key={g.id} className="goal-card">
        <span className="pill">
          {g.category === "fitness" ? t.fitness : t.personal} · {g.weight}×
        </span>
        <h3>{g.title}</h3>
        <p>
          {Number(g.target).toLocaleString(lang)} {g.unit}
        </p>
        <p>
          {t.schedule}:{" "}
          {Array.from(new Set(g.weekdays))
            .sort((a, b) => a - b)
            .map((d) => days[d])
            .join(" · ")}{" "}
          (UTC)
        </p>
        <Meter value={Number(g.score)} />
        <p className="small">
          {g.completed_days}/{g.scheduled_days} {t.days} ·{" "}
          {Number(g.score).toFixed(1)} / 100
        </p>
      </article>
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="MOVEMBER 2026"
        title={everyone ? t.everyoneGoals : t.goals}
      >
        <p>{everyone ? t.everyoneGoalsIntro : t.progress}</p>
      </PageTitle>
      <nav className="goal-view-nav" aria-label={t.goalViews}>
        <Link href="/goals" aria-current={!everyone ? "page" : undefined}>
          {t.goals}
        </Link>
        <Link
          href="/goals?view=members"
          aria-current={everyone ? "page" : undefined}
        >
          {t.everyoneGoals}
        </Link>
      </nav>
      <Notice searchParams={searchParams} />
      {everyone ? (
        <>
          <p className="muted small">{t.goalsPrivacy}</p>
          <div className="member-goals-grid">
            {memberResult.data?.map((person) => {
              const theirs = goals.filter((g) => g.user_id === person.user_id);
              return (
                <section className="panel" key={person.user_id}>
                  <h2 className="member-goals-name">
                    <span className="avatar" aria-hidden="true">
                      {person.display_name.slice(0, 1).toUpperCase()}
                    </span>
                    {person.display_name}
                  </h2>
                  {theirs.length ? (
                    theirs.map(goalCard)
                  ) : (
                    <Empty>{t.memberNoGoals}</Empty>
                  )}
                </section>
              );
            })}
          </div>
          {!memberResult.data?.length && <Empty>{t.empty}</Empty>}
        </>
      ) : (
        <div className="two-columns">
          <section className="panel">
            <h2>{t.goals}</h2>
            {goals.length ? goals.map(goalCard) : <Empty>{t.noGoals}</Empty>}
            <p className="muted small">{t.locked}</p>
          </section>
          <section className="panel">
            <h2>{t.create}</h2>
            <GoalForm />
          </section>
        </div>
      )}
      <section className="rules-card">
        <h2>{t.rules}</h2>
        <p>{t.ruleText}</p>
      </section>
    </>
  );
}
