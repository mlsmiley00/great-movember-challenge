import { test } from "node:test";
import assert from "node:assert/strict";
import {
  localCalendarDate,
  progressDateBounds,
} from "../src/lib/progress-date";

test("evening progress uses today's local date after UTC has advanced to tomorrow", () => {
  const now = new Date("2026-11-06T02:00:00Z");
  assert.equal(localCalendarDate(now, "America/Chicago"), "2026-11-05");
  assert.equal(progressDateBounds(now, "America/Chicago").max, "2026-11-05");
  assert.equal(progressDateBounds(now, "America/Chicago").day, "2026-11-05");
  assert.equal(localCalendarDate(now, "UTC"), "2026-11-06");
});
test("members ahead of UTC can choose their local today", () => {
  const now = new Date("2026-11-05T17:00:00Z");
  assert.equal(localCalendarDate(now, "Asia/Tokyo"), "2026-11-06");
});
test("the November date picker allows earlier competition days and caps the final date", () => {
  assert.deepEqual(
    progressDateBounds(new Date("2026-11-06T02:00:00Z"), "America/Chicago"),
    {
      today: "2026-11-05",
      day: "2026-11-05",
      min: "2026-11-01",
      max: "2026-11-05",
      beforeStart: false,
    },
  );
  const before = progressDateBounds(
    new Date("2026-11-01T02:00:00Z"),
    "America/Chicago",
  );
  assert.equal(before.beforeStart, true);
  assert.equal(before.day, "2026-11-01");
  const after = progressDateBounds(
    new Date("2026-12-02T02:00:00Z"),
    "America/Chicago",
  );
  assert.equal(after.day, "2026-11-30");
  assert.equal(after.max, "2026-11-30");
});
test("date selection handles the daylight saving transition", () => {
  assert.equal(
    localCalendarDate(new Date("2026-11-01T05:30:00Z"), "America/Chicago"),
    "2026-11-01",
  );
  assert.equal(
    localCalendarDate(new Date("2026-11-01T08:30:00Z"), "America/Chicago"),
    "2026-11-01",
  );
});
