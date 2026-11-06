"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { END, streak } from "@/lib/scoring";
import { localCalendarDate } from "@/lib/progress-date";
import { achievements } from "@/lib/achievements";

function useLocalDay() {
  const [day, setDay] = useState<string | null>(null);
  useEffect(() => {
    const update = () => {
      const today = localCalendarDate(
        new Date(),
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      setDay(today > END ? END : today);
    };
    update();
    const timer = setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  return day;
}

const LocalDay = createContext<string | null>(null);

export function ProgressDay({ children }: { children: ReactNode }) {
  const day = useLocalDay();
  return <LocalDay.Provider value={day}>{children}</LocalDay.Provider>;
}

export function ProgressStreak({ dates }: { dates: string[] }) {
  const day = useContext(LocalDay);
  return <span aria-busy={!day}>{day ? streak(dates, day) : "…"}</span>;
}

export function ProgressAchievements({
  completedDates,
  dates,
  lang,
}: {
  completedDates: string[];
  dates: string[];
  lang: "en" | "es";
}) {
  const day = useContext(LocalDay);
  return (
    <div className="achievement-grid" aria-busy={!day}>
      {achievements(completedDates, day ? streak(dates, day) : 0).map((a) => (
        <div
          className={a.earned ? "achievement earned" : "achievement"}
          key={a.id}
        >
          <span>{a.symbol}</span>
          <b>{lang === "en" ? a.en : a.es}</b>
          <small>
            {a.id === "week" && !day
              ? "…"
              : a.earned
                ? "✓"
                : lang === "en"
                  ? "Keep going"
                  : "Sigue adelante"}
          </small>
        </div>
      ))}
    </div>
  );
}
