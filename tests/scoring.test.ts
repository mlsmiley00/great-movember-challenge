import { test } from "node:test";
import assert from "node:assert/strict";
import {
  goalScore,
  individualScore,
  teamScore,
  streak,
  type GoalScore,
} from "../src/lib/scoring";
const goal = (
  entries: GoalScore["entries"],
  scheduledDays = 30,
  weight = 2,
): GoalScore => ({ entries, scheduledDays, weight, target: 10000 });
test("a perfect November scores 100; excessive amounts add no points", () => {
  assert.equal(
    goalScore(goal(Array.from({ length: 30 }, () => ({ value: 10000 })))),
    100,
  );
  assert.equal(goalScore(goal([{ value: 1000000 }], 1)), 100);
});
test("missed days and partial completion reduce score", () => {
  assert.equal(goalScore(goal([{ value: 5000 }], 1)), 35);
  assert.equal(goalScore(goal([{ value: 10000 }], 2)), 50);
  assert.equal(goalScore(goal([])), 0);
});
test("rejected evidence counts as zero; honor reports count", () => {
  assert.equal(goalScore(goal([{ value: 10000, rejected: true }], 1)), 0);
  assert.equal(goalScore(goal([{ value: 10000 }], 1)), 100);
});
test("more equally performing goals give no automatic advantage", () => {
  const g = goal([{ value: 10000 }], 2);
  assert.equal(individualScore([g]), individualScore([g, g, g]));
  assert.equal(individualScore([]), 0);
});
test("fitness counts twice as much as personal growth", () => {
  assert.equal(
    individualScore([goal([{ value: 10000 }], 1, 2), goal([], 1, 1)]),
    200 / 3,
  );
});
test("team ranking averages every member including zero scores", () => {
  assert.equal(teamScore([100, 0]), 50);
  assert.equal(teamScore([50, 50, 50, 50]), 50);
  assert.equal(teamScore([]), 0);
});
test("streak deduplicates goal days, handles yesterday and month boundaries", () => {
  assert.equal(
    streak(["2026-11-01", "2026-11-02", "2026-11-02"], "2026-11-03"),
    2,
  );
  assert.equal(streak(["2026-11-01"], "2026-11-03"), 0);
  assert.equal(streak(["2026-10-31", "2026-11-01"], "2026-11-01"), 2);
});
test("no elapsed scheduled days scores zero", () =>
  assert.equal(goalScore(goal([], 0)), 0));
import { achievements } from "../src/lib/achievements";
test("achievements require real distinct successful days", () => {
  assert.equal(achievements([], 0).filter((a) => a.earned).length, 0);
  assert.equal(
    achievements(["2026-11-01", "2026-11-01"], 0).filter((a) => a.earned)
      .length,
    1,
  );
  assert.equal(
    achievements(
      Array.from({ length: 30 }, (_, i) => `2026-11-${i + 1}`),
      7,
    ).filter((a) => a.earned).length,
    4,
  );
});

import { progressDates } from "../src/lib/scoring";
test("partial positive progress counts without meeting a target", () => {
  const dates = progressDates([
    { logged_on: "2026-11-01", value: 1, verification: "honor" },
    { logged_on: "2026-11-02", value: "0.5", verification: "pending" },
    { logged_on: "2026-11-03", value: 20, verification: "verified" },
  ]);
  assert.equal(streak(dates, "2026-11-03"), 3);
});
test("backfilling a missed activity date restores the full streak regardless of when it was submitted", () => {
  const entries = [
    {
      logged_on: "2026-11-01",
      value: 1,
      verification: "honor",
      created_at: "2026-11-01T12:00:00Z",
    },
    {
      logged_on: "2026-11-03",
      value: 1,
      verification: "honor",
      created_at: "2026-11-03T12:00:00Z",
    },
  ];
  assert.equal(streak(progressDates(entries), "2026-11-03"), 1);
  entries.push({
    logged_on: "2026-11-02",
    value: 1,
    verification: "honor",
    created_at: "2026-11-06T12:00:00Z",
  });
  assert.equal(streak(progressDates(entries), "2026-11-03"), 3);
  assert.equal(streak(progressDates(entries), "2026-11-04"), 3);
  assert.equal(streak(progressDates(entries), "2026-11-06"), 0);
});
test("duplicate goal logs, zero amounts, rejected reports and noncompetition dates do not inflate streaks", () => {
  const entries = [
    { logged_on: "2026-11-01", value: 1, verification: "honor" },
    { logged_on: "2026-11-01", value: 99, verification: "verified" },
    { logged_on: "2026-11-02", value: 0, verification: "honor" },
    { logged_on: "2026-11-02", value: 99, verification: "rejected" },
    { logged_on: "2026-10-31", value: 1, verification: "honor" },
    { logged_on: "2026-12-01", value: 1, verification: "honor" },
    { logged_on: "2026-11-02", value: "invalid", verification: "honor" },
  ];
  assert.deepEqual(progressDates(entries), ["2026-11-01"]);
  assert.equal(streak(progressDates(entries), "2026-11-02"), 1);
});
test("the seven-day badge uses participation while target-based score remains unchanged", () => {
  const dates = progressDates(
    Array.from({ length: 7 }, (_, i) => ({
      logged_on: `2026-11-0${i + 1}`,
      value: 1,
      verification: "honor",
    })),
  );
  assert.equal(streak(dates, "2026-11-07"), 7);
  assert.equal(
    achievements([], streak(dates, "2026-11-07")).find((a) => a.id === "week")
      ?.earned,
    true,
  );
  assert.equal(goalScore(goal([{ value: 5000 }], 1)), 35);
});
