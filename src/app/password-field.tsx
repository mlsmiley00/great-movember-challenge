"use client";
import { useId, useState } from "react";

export function PasswordField({
  label,
  showLabel,
  hideLabel,
  name = "password",
  autoComplete = "current-password",
  minLength,
  maxLength = 128,
}: {
  label: string;
  showLabel: string;
  hideLabel: string;
  name?: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  maxLength?: number;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="password-field">
      <label htmlFor={id}>{label}</label>
      <div className="password-control">
        <input
          id={id}
          type={visible ? "text" : "password"}
          name={name}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          required
          autoCapitalize="none"
          spellCheck={false}
        />
        <button
          type="button"
          className="secondary"
          aria-controls={id}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? hideLabel : showLabel}
        </button>
      </div>
    </div>
  );
}
