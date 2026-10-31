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
