import { START, END } from "./scoring";

export function localCalendarDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function progressDateBounds(now: Date, timeZone: string) {
  const today = localCalendarDate(now, timeZone);
  return {
    today,
    day: today < START ? START : today > END ? END : today,
    min: START,
    max: today < START ? START : today > END ? END : today,
    beforeStart: today < START,
  };
}
