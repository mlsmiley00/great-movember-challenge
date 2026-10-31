"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-card">
      <h1>Something went wrong / Algo salió mal</h1>
      <p>Please try again. If this continues, contact your administrator.</p>
      <button onClick={reset}>Try again / Reintentar</button>
    </main>
  );
}
