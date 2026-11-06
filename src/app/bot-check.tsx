"use client";
import Script from "next/script";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

type Turnstile = {
  render(element: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
  reset(id: string): void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
export function BotCheck({
  siteKey,
  language,
  label,
  errorLabel,
  retryLabel,
  disabled = false,
  children,
}: {
  siteKey?: string;
  language: "en" | "es";
  label: string;
  errorLabel: string;
  retryLabel: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const target = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState(false);
  const { pending } = useFormStatus();
  const render = useCallback(() => {
    if (
      !siteKey ||
      !target.current ||
      !window.turnstile ||
      widget.current !== null
    )
      return;
    widget.current = window.turnstile.render(target.current, {
      sitekey: siteKey,
      language,
      size: "compact",
      appearance: "interaction-only",
      "response-field": false,
      "refresh-expired": "auto",
      callback: (value: string) => {
        setToken(value);
        setError(false);
      },
      "expired-callback": () => setToken(""),
      "error-callback": () => {
        setToken("");
        setError(true);
      },
    });
  }, [siteKey, language]);
  useEffect(() => {
    render();
    window.addEventListener("movember:turnstile-ready", render);
    return () => {
      window.removeEventListener("movember:turnstile-ready", render);
      if (widget.current !== null) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [render]);
  return (
    <>
      {siteKey && (
        <>
          <Script
            src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
            strategy="afterInteractive"
            onReady={() => {
              window.dispatchEvent(new Event("movember:turnstile-ready"));
            }}
            onError={() => setError(true)}
          />
          <div ref={target} aria-label={label} />
          <input type="hidden" name="captcha_token" value={token} />
          {error && (
            <p role="status">
              {errorLabel}{" "}
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  if (!window.turnstile) {
                    window.location.reload();
                    return;
                  }
                  setToken("");
                  setError(false);
                  if (widget.current !== null)
                    window.turnstile?.reset(widget.current);
                  else render();
                }}
              >
                {retryLabel}
              </button>
            </p>
          )}
        </>
      )}
      <button
        disabled={disabled || pending || Boolean(siteKey && !token)}
        aria-busy={pending}
      >
        {children}
        {pending ? "…" : ""}
      </button>
    </>
  );
}
