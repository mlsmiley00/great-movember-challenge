import Link from "next/link";
import { changeLocale } from "./actions";
export function Mustache() {
  return (
    <svg viewBox="0 0 160 65" aria-hidden="true" className="mustache">
      <path
        d="M80 27C61-8 39 9 32 30 27 44 12 43 5 34c2 35 56 43 75 10 19 33 73 25 75-10-7 9-22 10-27-4-7-21-29-38-48-3Z"
        fill="currentColor"
      />
    </svg>
  );
}
export function Language() {
  return (
    <form action={changeLocale} className="language">
      <button name="locale" value="en" lang="en">
        EN
      </button>
      <span>/</span>
      <button name="locale" value="es" lang="es">
        ES
      </button>
    </form>
  );
}
export async function Notice({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const p = await searchParams;
  return (
    <>
      {p.error && (
        <p role="alert" className="notice error">
          {p.error}
        </p>
      )}
      {p.message && (
        <p role="status" className="notice">
          {p.message}
        </p>
      )}
    </>
  );
}
export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="empty">
      <span className="spark">✦</span>
      <p>{children}</p>
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children}
    </header>
  );
}
export function Meter({ value }: { value: number }) {
  return (
    <div
      className="meter"
      role="meter"
      aria-label="Goal score / Puntuación"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function Go({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="button">
      {children}
      <span aria-hidden>↗</span>
    </Link>
  );
}
