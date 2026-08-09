"use client";

import { AuthProvider, useAuth } from "../../lib/AuthProvider";
import NavBar from "./NavBar";
import LoginScreen from "./LoginScreen";

function Gate({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="auth-loading">Loading...</div>;
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <>
      <NavBar />
      <main className="container">{children}</main>
    </>
  );
}

export default function AuthGate({ children }) {
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  );
}
