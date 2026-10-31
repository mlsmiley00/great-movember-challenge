import { translations } from "@/lib/i18n";
import { Mustache } from "./ui";
export async function AboutMovember() {
  const t = await translations();
  return (
    <section
      className="panel about-movember"
      aria-labelledby="about-movember-title"
    >
      <div className="about-movember-heading">
        <div>
          <p className="eyebrow">{t.movemberEyebrow}</p>
          <h2 id="about-movember-title">{t.aboutMovember}</h2>
        </div>
        <Mustache />
      </div>
      <div className="about-movember-grid">
        <div>
          <p>{t.movemberHistory}</p>
          <p>{t.movemberMission}</p>
          <p>{t.movemberConnection}</p>
          <a
            href="https://us.movember.com/about/history"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.movemberLearn} ↗
          </a>
        </div>
        <aside className="about-movember-giving">
          <h3>{t.movemberGivingTitle}</h3>
          <p>{t.movemberGiving}</p>
          <a
            className="button secondary"
            href="https://us.movember.com/donate"
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.movemberDonate} ↗
          </a>
          <p className="small muted">{t.movemberExternal}</p>
        </aside>
      </div>
    </section>
  );
}
