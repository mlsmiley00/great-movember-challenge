import { member, COMPETITION } from "@/lib/auth";
import { translations } from "@/lib/i18n";
import { streak } from "@/lib/scoring";
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
    db.from("goals").select("id,target").eq("competition_id", COMPETITION),
  ]);
  for (const r of results) if (r.error) throw r.error;
  const [people, teams, entries, goals] = results.map((r) => r.data || []);
  const today = new Date().toISOString().slice(0, 10);
  const asOf = today > "2026-11-30" ? "2026-11-30" : today;
  return (
    <>
      <PageTitle eyebrow="A LITTLE FRIENDLY COMPETITION" title={t.leaderboard}>
        <p>{t.rankingNote}</p>
      </PageTitle>
      <section className="panel">
        <h2>
          {t.leaderboard} · {t.members}
        </h2>
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
                      {streak(
                        entries
                          .filter(
                            (e) =>
                              e.user_id === p.user_id &&
                              Number(e.value) >=
                                Number(
                                  goals.find((g) => g.id === e.goal_id)
                                    ?.target || Infinity,
                                ),
                          )
                          .map((e) => e.logged_on),
                        asOf,
                      )}{" "}
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
    </>
  );
}
