"use client";
import { useEffect, useState, type ReactNode } from "react";
import { progressDateBounds } from "@/lib/progress-date";
import { START } from "@/lib/scoring";

export function ProgressDateField({
  label,
  help,
  submit,
  children,
}: {
  label: string;
  help: string;
  submit: string;
  children?: ReactNode;
}) {
  const [clock, setClock] = useState<
    (ReturnType<typeof progressDateBounds> & { zone: string }) | null
  >(null);
  const [day, setDay] = useState("");
  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const update = () =>
      setClock({ ...progressDateBounds(new Date(), zone), zone });
    update();
    const timer = setInterval(update, 30000);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
    };
  }, []);
  return (
    <>
      <label>
        {label}
        {clock ? ` (${clock.zone})` : ""}
        <input
          name="date"
          type="date"
          min={START}
          max={clock?.max}
          value={day || clock?.day || ""}
          onChange={(event) => setDay(event.target.value)}
          required
          disabled={!clock || clock.beforeStart}
          aria-describedby="progress-date-help"
        />
      </label>
      {children}
      <input type="hidden" name="timezone" value={clock?.zone || ""} />
      <p id="progress-date-help" className="small muted">
        {help}
      </p>
      <button disabled={!clock || clock.beforeStart}>{submit} ↗</button>
    </>
  );
}
