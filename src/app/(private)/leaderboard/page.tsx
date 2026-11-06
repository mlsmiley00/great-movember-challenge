import { member, COMPETITION } from "@/lib/auth";
import { translations } from "@/lib/i18n";
import { progressDates } from "@/lib/scoring";
import { ProgressDay, ProgressStreak } from "../../progress-streak";
import { PageTitle, Empty } from "../../ui";
export default async function Leaderboard() {
  const { db, user } = await member();
  const t = await translations();
  const results = await Promise.all([
    db
      .from("individual_scores")
      .select("*")
      .eq("competition_id", COMPETITION)
      .order("score", { ascending: false })
      .order("display_name"),
    db
      .from("team_scores")
      .select("*")
      .eq("competition_id", COMPETITION)
      .order("score", { ascending: false })
      .order("name"),
    db
      .from("progress_entries")
      .select("user_id,logged_on,value,goal_id,verification")
      .eq("competition_id", COMPETITION)
      .neq("verification", "rejected"),
  ]);
  for (const r of results) if (r.error) throw r.error;
  const [people, teams, entries] = results.map((r) => r.data || []);
  return (
    <ProgressDay>
      <PageTitle eyebrow="A LITTLE FRIENDLY COMPETITION" title={t.leaderboard}>
        <p>{t.rankingNote}</p>
      </PageTitle>
      <section className="panel">
        <h2>
          {t.leaderboard} · {t.members}
        </h2>
        <p className="small muted">{t.streakHelp}</p>
        {people.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.name}</th>
                  <th>{t.score}</th>
                  <th>{t.streak}</th>
                  <th>{t.days}</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr
                    className={p.user_id === user.id ? "is-you" : ""}
                    key={p.user_id}
                  >
                    <td>
                      {1 +
                        people.filter((o) => Number(o.score) > Number(p.score))
                          .length}
                    </td>
                    <td>
                      <span className="table-name">
                        <span className="avatar">{p.display_name[0]}</span>
                        {p.display_name}
                      </span>
                    </td>
                    <td>
                      <strong>{Number(p.score).toFixed(1)}</strong>
                      <small> /100</small>
                    </td>
                    <td>
                      <ProgressStreak
                        dates={progressDates(
                          entries.filter((e) => e.user_id === p.user_id),
                        )}
                      />{" "}
                      🔥
                    </td>
                    <td>{p.completed_days}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t.empty}</Empty>
        )}
      </section>
      <section className="panel">
        <h2>{t.teams}</h2>
        {teams.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.team}</th>
                  <th>{t.members}</th>
                  <th>{t.score}</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.id}>
                    <td>
                      {1 +
                        teams.filter(
                          (o) => Number(o.score) > Number(team.score),
                        ).length}
                    </td>
                    <td>{team.name}</td>
                    <td>{team.member_count}</td>
                    <td>
                      <strong>{Number(team.score).toFixed(1)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>{t.empty}</Empty>
        )}
      </section>
      <section className="rules-card">
        <h2>{t.rules}</h2>
        <p>{t.ruleText}</p>
      </section>
    </ProgressDay>
  );
}
