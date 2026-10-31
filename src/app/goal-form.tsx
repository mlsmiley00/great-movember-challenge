import { translations, locale } from "@/lib/i18n";
import { createGoal } from "./actions";
export async function Weekdays({
  selected = [0, 1, 2, 3, 4, 5, 6],
}: {
  selected?: number[];
}) {
  const lang = await locale();
  return (
    <div className="weekdays">
      {(lang === "en"
        ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]
        : ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sá"]
      ).map((day, i) => (
        <label key={i}>
          <input
            type="checkbox"
            name="weekdays"
            value={i}
            defaultChecked={selected.includes(i)}
          />
          <span>{day}</span>
        </label>
      ))}
    </div>
  );
}
export async function GoalForm() {
  const t = await translations();
  return (
    <form action={createGoal} className="stack">
      <label>
        {t.title}
        <input
          name="title"
          minLength={2}
          maxLength={100}
          placeholder="10,000 steps a day / 10.000 pasos al día"
          required
        />
      </label>
      <label>
        {t.fitness} / {t.personal}
        <select name="category">
          <option value="fitness">{t.fitness} · 2×</option>
          <option value="personal">{t.personal} · 1×</option>
        </select>
      </label>
      <div className="form-grid">
        <label>
          {t.target}
          <input
            type="number"
            name="target"
            min="0.001"
            max="1000000000"
            step="any"
            required
          />
        </label>
        <label>
          {t.unit}
          <input
            name="unit"
            placeholder="steps / pasos"
            maxLength={30}
            required
          />
        </label>
      </div>
      <fieldset>
        <legend>{t.schedule}</legend>
        <Weekdays />
      </fieldset>
      <p className="small muted">UTC · {t.dates}</p>
      <button>{t.create} ↗</button>
    </form>
  );
}
