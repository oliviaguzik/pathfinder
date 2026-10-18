"use client";

import { useState } from "react";
import { useAuth } from "../../lib/AuthProvider";
import BrandMark from "./BrandMark";

// Sign in with Google, or with a one-time code sent by email (no password).
export default function LoginScreen() {
  const { signInWithGoogle, sendEmailCode, verifyEmailCode } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  // "email" (ask for the address) | "code" (ask for the code we sent)
  const [step, setStep] = useState("email");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sendCode(e) {
    e?.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await sendEmailCode(email.trim());
    setBusy(false);
    if (error) return setMessage(error);
    setCode("");
    setStep("code");
  }

  async function checkCode(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = await verifyEmailCode(email.trim(), code.trim());
    setBusy(false);
    if (error) setMessage(error);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <BrandMark size={56} />
          <div className="brand">PathFinder</div>
        </div>

        {step === "email" ? (
          <>
            <p className="page-sub" style={{ marginBottom: 24 }}>Sign in to see your plan and goals.</p>
            <button className="google-signin-btn" onClick={signInWithGoogle}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z" />
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
              </svg>
              Sign in with Google
            </button>

            <div className="login-divider">or</div>

            <form className="login-form" onSubmit={sendCode}>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                aria-label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" disabled={busy || !email.trim()}>
                {busy ? "Sending…" : "Email me a sign-in code"}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="page-sub" style={{ marginBottom: 20 }}>
              We emailed a code to <strong>{email.trim()}</strong>. Type it here.
            </p>
            <form className="login-form" onSubmit={checkCode}>
              <input
                type="text"
                className="login-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Code"
                aria-label="Code from the email"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
                autoFocus
                required
              />
              <button type="submit" className="primary" disabled={busy || code.length < 6}>
                {busy ? "Checking…" : "Sign in"}
              </button>
            </form>
            <div className="login-links">
              <button type="button" className="ghost small-btn" onClick={sendCode} disabled={busy}>
                Send a new code
              </button>
              <button
                type="button"
                className="ghost small-btn"
                onClick={() => {
                  setStep("email");
                  setMessage("");
                }}
              >
                Use a different email
              </button>
            </div>
          </>
        )}

        {message && (
          <p className="login-message" role="alert">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
