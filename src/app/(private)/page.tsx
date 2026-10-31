import { AboutMovember } from "../about-movember";
import {
  ArrowUpRight,
  Footprints,
  Flame,
  Target,
  Trophy,
  CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { member, COMPETITION } from "@/lib/auth";
import { translations, locale } from "@/lib/i18n";
import { streak } from "@/lib/scoring";
import { achievements } from "@/lib/achievements";
import { Mustache, Meter, Empty, Go, Notice } from "../ui";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { db, user, membership } = await member();
  const t = await translations();
  const lang = await locale();
  const results = await Promise.all([
    db
      .from("individual_scores")
      .select("*")
      .eq("competition_id", COMPETITION)
      .order("score", { ascending: false })
      .order("display_name"),
    db
      .from("goal_scores")
      .select("*")
      .eq("competition_id", COMPETITION)
      .eq("user_id", user.id),
    db
      .from("progress_entries")
      .select("logged_on,value,verification,goal_id")
      .eq("competition_id", COMPETITION)
      .eq("user_id", user.id),
    db
      .from("prizes")
      .select("*")
      .eq("competition_id", COMPETITION)
      .order("place"),
    db
      .from("announcements")
      .select("*")
      .eq("competition_id", COMPETITION)
      .order("created_at", { ascending: false })
      .limit(3),
  ]);
  for (const r of results)
    if (r.error) throw new Error("Unable to load clubhouse");
  const [ranks, goals, entries, prizes, announcements] = results.map(
    (r) => r.data || [],
  );
  const mine = ranks.find((r) => r.user_id === user.id);
  const today = new Date().toISOString().slice(0, 10);
  const completed = entries.filter(
    (e) =>
      e.verification !== "rejected" &&
      Number(e.value) >=
        Number(goals.find((g) => g.id === e.goal_id)?.target || Infinity),
  );
  const currentStreak = streak(
    completed.map((e) => e.logged_on),
    today > "2026-11-30" ? "2026-11-30" : today,
  );
  const rank = mine
    ? 1 + ranks.filter((r) => Number(r.score) > Number(mine.score)).length
    : null;
  const daysLeft = Math.max(
    0,
    Math.ceil((Date.parse("2026-12-01T00:00:00Z") - Date.now()) / 86400000),
  );
  return (
    <>
      <Notice searchParams={searchParams} />
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="gold-dot" /> {t.dates.toUpperCase()}
          </p>
          <h1>
            {lang === "en" ? (
              <>
                A little better.
                <br />
                <em>Every day.</em>
              </>
            ) : (
              <>
                Un poco mejor.
                <br />
                <em>Cada día.</em>
              </>
            )}
          </h1>
          <p>{t.subtitle}</p>
          <Go href="/log">{t.log}</Go>
          <div className="hero-fine">
            <span>✦</span> {t.tagline}
          </div>
        </div>
        <div className="hero-seal">
          <div className="seal-inner">
            <span className="eyebrow">THE GREAT</span>
            <Mustache />
            <strong>MOVEMBER</strong>
            <span className="seal-script">Challenge</span>
            <span className="seal-year">— 2026 —</span>
            <small>FRIENDS · FAMILY · A BETTER YOU</small>
          </div>
        </div>
        <div className="hero-corner">30 DAYS. COUNTLESS POSSIBILITIES.</div>
      </section>
      <div className="greeting">
        <div>
          <p className="eyebrow">YOUR PERSONAL SCORECARD</p>
          <h2>
            {t.welcome}, {membership.display_name}{" "}
            <span className="wave">✦</span>
          </h2>
        </div>
        <span className="date-label">
          <CalendarDays size={16} />
          {daysLeft} {t.days}{" "}
          {lang === "en" ? "until the finish" : "hasta la meta"}
        </span>
      </div>
      <div className="stats">
        <div className="stat">
          <span className="stat-icon">
            <Target size={20} />
          </span>
          <span>{t.score}</span>
          <strong>
            {Number(mine?.score || 0).toFixed(1)}
            <small>/100</small>
          </strong>
          <Meter value={Number(mine?.score || 0)} />
        </div>
        <div className="stat">
          <span className="stat-icon red">
            <Flame size={20} />
          </span>
          <span>{t.streak}</span>
          <strong>
            {currentStreak}
            <small>{t.days}</small>
          </strong>
          <small>{t.trophy}</small>
        </div>
        <div className="stat">
          <span className="stat-icon gold">
            <Trophy size={20} />
          </span>
          <span>{t.leaderboard}</span>
          <strong>
            {rank ? `#${rank}` : "—"}
            <small>/ {ranks.length}</small>
          </strong>
          <small>
            {lang === "en"
              ? "A little friendly competition"
              : "Un poco de competencia amistosa"}
          </small>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>{t.goals}</h2>
            <Link href="/goals">
              {t.goals}
              <ArrowUpRight size={16} />
            </Link>
          </div>
          {goals.length ? (
            goals.map((g) => (
              <div className="goal-summary" key={g.id}>
                <span className="goal-icon">
                  <Footprints size={23} />
                </span>
                <div>
                  <h3>{g.title}</h3>
                  <p>
                    {g.target.toLocaleString()} {g.unit} · {g.completed_days}/
                    {g.scheduled_days} {t.days}
                  </p>
                  <Meter value={Number(g.score)} />
                </div>
                <strong>
                  {Number(g.score).toFixed(0)}
                  <small> /100</small>
                </strong>
              </div>
            ))
          ) : (
            <Empty>
              {t.noGoals}
              <br />
              <Link href="/goals">{t.create} ↗</Link>
            </Empty>
          )}
          <div className="mini-calendar">
            {Array.from({ length: 30 }, (_, i) => (
              <span
                key={i}
                title={`November ${i + 1}`}
                className={
                  completed.some(
                    (e) =>
                      e.logged_on ===
                      `2026-11-${String(i + 1).padStart(2, "0")}`,
                  )
                    ? "done"
                    : ""
                }
              >
                {i + 1}
              </span>
            ))}
          </div>
          <p className="muted small">{t.progress}</p>
        </section>
        <section className="panel leaderboard-preview">
          <div className="section-heading">
            <h2>{t.leaderboard}</h2>
            <Link href="/leaderboard">
              <ArrowUpRight size={18} />
              <span className="sr-only">{t.leaderboard}</span>
            </Link>
          </div>
          {ranks.length ? (
            ranks.slice(0, 4).map((r) => (
              <div className="rank-row" key={r.user_id}>
                <span className="rank-number">
                  {1 +
                    ranks.filter((p) => Number(p.score) > Number(r.score))
                      .length}
                </span>
                <span className="avatar">{r.display_name[0]}</span>
                <div>
                  <b>{r.display_name}</b>
                  <small>
                    {r.completed_days} {t.days}
                  </small>
                </div>
                <strong>{Number(r.score).toFixed(1)}</strong>
              </div>
            ))
          ) : (
            <Empty>{t.empty}</Empty>
          )}
          <div className="ranking-note">{t.rankingNote}</div>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>{t.achievement}</h2>
          <span>✦</span>
        </div>
        <div className="achievement-grid">
          {achievements(
            completed.map((e) => e.logged_on),
            currentStreak,
          ).map((a) => (
            <div
              className={a.earned ? "achievement earned" : "achievement"}
              key={a.id}
            >
              <span>{a.symbol}</span>
              <b>{lang === "en" ? a.en : a.es}</b>
              <small>
                {a.earned
                  ? "✓"
                  : lang === "en"
                    ? "Keep going"
                    : "Sigue adelante"}
              </small>
            </div>
          ))}
        </div>
      </section>
      <section className="prize-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">A LITTLE EXTRA MOTIVATION</p>
            <h2>{t.prizes}</h2>
          </div>
          <span>✦</span>
        </div>
        <div className="prize-grid">
          {prizes.map((p) => (
            <div className={`prize prize-${p.place}`} key={p.place}>
              <span className="prize-medal">
                <Trophy size={25} />
              </span>
              <div>
                <small>{[t.first, t.second, t.third][p.place - 1]}</small>
                <h3>
                  {p.description === "To Be Announced" ? t.tba : p.description}
                </h3>
              </div>
              <span className="place">0{p.place}</span>
            </div>
          ))}
        </div>
      </section>
      <AboutMovember />
      <div className="dashboard-grid">
        <section className="panel">
          <p className="eyebrow">THE CLUB NOTICEBOARD</p>
          <h2>{t.announcements}</h2>
          {announcements.length ? (
            announcements.map((a) => (
              <article className="announcement" key={a.id}>
                <p>{a.body}</p>
                <small>{new Date(a.created_at).toLocaleDateString(lang)}</small>
              </article>
            ))
          ) : (
            <p className="muted">{t.empty}</p>
          )}
        </section>
        <section className="rules-card">
          <span>✦</span>
          <h2>{t.rules}</h2>
          <p>{t.ruleText}</p>
        </section>
      </div>
    </>
  );
}
