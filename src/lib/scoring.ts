export const START = "2026-11-01";
export const END = "2026-11-30";
export type GoalScore = {
  target: number;
  weight: number;
  entries: { value: number; rejected?: boolean }[];
  scheduledDays: number;
};
// 70% capped completion + 30% successful-day consistency. Every scheduled day counts.
export function goalScore(goal: GoalScore): number {
  if (goal.target <= 0 || goal.scheduledDays <= 0) return 0;
  const valid = goal.entries.filter((e) => !e.rejected);
  const completion =
    valid.reduce(
      (s, e) => s + Math.min(1, Math.max(0, e.value / goal.target)),
      0,
    ) / goal.scheduledDays;
  const consistency =
    valid.filter((e) => e.value >= goal.target).length / goal.scheduledDays;
  return Math.min(100, 100 * (0.7 * completion + 0.3 * consistency));
}
export function individualScore(goals: GoalScore[]): number {
  const weight = goals.reduce((s, g) => s + g.weight, 0);
  return weight
    ? goals.reduce((s, g) => s + goalScore(g) * g.weight, 0) / weight
    : 0;
}
export function teamScore(scores: number[]): number {
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}
export function streak(dates: string[], asOf: string): number {
  const days = new Set(dates);
  const d = new Date(asOf + "T00:00:00Z");
  if (!days.has(asOf)) d.setUTCDate(d.getUTCDate() - 1);
  let n = 0;
  while (days.has(d.toISOString().slice(0, 10))) {
    n++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}
