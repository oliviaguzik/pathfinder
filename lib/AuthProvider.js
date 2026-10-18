"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext({
  user: null,
  loading: true,
  signInWithGoogle: () => {},
  sendEmailCode: async () => ({}),
  verifyEmailCode: async () => ({}),
  signOut: () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }

  // Sign in with a one-time code sent by email (no password). A new email
  // makes a new account; an email already used with Google signs in to that
  // same account. Both return { error } with a message to show, or {}.
  async function sendEmailCode(email) {
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    return { error: error && codeError(error) };
  }

  async function verifyEmailCode(email, code) {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
    return { error: error && codeError(error) };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, sendEmailCode, verifyEmailCode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// Supabase's sign-in errors, in plain words.
function codeError(error) {
  if (error.status === 429 || /rate limit|security purposes/i.test(error.message)) {
    return "Too many codes asked for. Wait a minute, then try again.";
  }
  if (/validate email|invalid format/i.test(error.message)) return "That doesn't look like an email address.";
  if (/expired|invalid/i.test(error.message)) return "That code didn't work. Check it, or send a new one.";
  return error.message;
}

export function useAuth() {
  return useContext(AuthContext);
}
