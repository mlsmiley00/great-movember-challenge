import { member, COMPETITION } from "@/lib/auth";
import { translations, locale } from "@/lib/i18n";
import { comment, react } from "../../actions";
import { PageTitle, Notice, Empty } from "../../ui";
export default async function Community({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { db, user } = await member();
  const t = await translations();
  const lang = await locale();
  const results = await Promise.all([
    db
      .from("progress_entries")
      .select("*")
      .eq("competition_id", COMPETITION)
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("memberships")
      .select("user_id,display_name")
      .eq("competition_id", COMPETITION),
    db
      .from("goals")
      .select("id,title,target,unit")
      .eq("competition_id", COMPETITION),
  ]);
  for (const r of results) if (r.error) throw r.error;
  const [entries, people, goals] = results.map((r) => r.data || []);
  const ids = entries.map((e) => e.id);
  const comments = ids.length
    ? await db
        .from("comments")
        .select("*")
        .in("entry_id", ids)
        .order("created_at")
        .limit(500)
    : { data: [], error: null };
  const reactions = ids.length
    ? await db.from("reactions").select("*").in("entry_id", ids).limit(3000)
    : { data: [], error: null };
  if (comments.error || reactions.error)
    throw new Error("Unable to load activity feed");
  return (
    <>
      <PageTitle eyebrow="CHEER EACH OTHER ON" title={t.community}>
        <p>{t.tagline}</p>
      </PageTitle>
      <Notice searchParams={searchParams} />
      <div className="feed">
        {entries.length ? (
          entries.map((e) => {
            const goal = goals.find((g) => g.id === e.goal_id);
            const likes =
              reactions.data?.filter((r) => r.entry_id === e.id) || [];
            const complete =
              e.verification !== "rejected" &&
              Number(e.value) >= Number(goal?.target);
            return (
              <article className="panel feed-card" key={e.id}>
                <div className="feed-author">
                  <span className="avatar">
                    {people.find((p) => p.user_id === e.user_id)
                      ?.display_name[0] || "M"}
                  </span>
                  <div>
                    <b>
                      {
                        people.find((p) => p.user_id === e.user_id)
                          ?.display_name
                      }
                    </b>
                    <small>{e.logged_on}</small>
                  </div>
                  {complete && (
                    <span className="pill">
                      ✦ {lang === "en" ? "Goal met" : "Meta cumplida"}
                    </span>
                  )}
                </div>
                <h2>{goal?.title}</h2>
                <p className="feed-amount">
                  {Number(e.value).toLocaleString()} <small>{goal?.unit}</small>
                </p>
                {e.notes && <p>{e.notes}</p>}
                {e.verification === "rejected" && (
                  <span className="pill rejected">{t.rejected}</span>
                )}
                <div className="feed-actions">
                  <form action={react}>
                    <input type="hidden" name="entry" value={e.id} />
                    <button
                      className={`secondary ${likes.some((l) => l.user_id === user.id) ? "liked" : ""}`}
                      aria-label={lang === "en" ? "Cheer" : "Animar"}
                    >
                      ♥ {likes.length}
                    </button>
                  </form>
                  <span className="muted small">
                    {comments.data?.filter((c) => c.entry_id === e.id).length}{" "}
                    {t.comment}
                  </span>
                </div>
                <div className="comments">
                  {comments.data
                    ?.filter((c) => c.entry_id === e.id)
                    .map((c) => (
                      <p key={c.id}>
                        <b>
                          {
                            people.find((p) => p.user_id === c.user_id)
                              ?.display_name
                          }
                        </b>{" "}
                        {c.body}
                      </p>
                    ))}
                </div>
                <form action={comment} className="comment-form">
                  <input type="hidden" name="entry" value={e.id} />
                  <input
                    name="body"
                    aria-label={t.comment}
                    placeholder={t.comment + "…"}
                    maxLength={500}
                    required
                  />
                  <button>{t.comment}</button>
                </form>
              </article>
            );
          })
        ) : (
          <Empty>{t.noData}</Empty>
        )}
      </div>
    </>
  );
}
