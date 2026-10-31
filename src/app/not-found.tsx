import Link from "next/link";
export default function NotFound() {
  return (
    <main className="auth-card">
      <h1>Page not found / Página no encontrada</h1>
      <Link href="/">Return to the club / Volver al club</Link>
    </main>
  );
}
