"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, login, signupManager } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await signupManager(email.trim(), name.trim(), password, organizationName.trim());
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 8 &&
    (mode === "login" || (name.trim().length > 0 && organizationName.trim().length > 0));

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-center text-3xl font-extrabold">Prospectora</h1>
        <p className="text-center text-sm text-text-muted">
          {mode === "login" ? "Connecte-toi à ton dashboard manager" : "Crée l'espace de ton équipe"}
        </p>

        {mode === "signup" && (
          <>
            <input
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm outline-none"
              placeholder="Ton nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm outline-none"
              placeholder="Nom de l'équipe"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
            />
          </>
        )}
        <input
          className="w-full rounded-2xl bg-white px-4 py-3 text-sm outline-none"
          placeholder="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-2xl bg-white px-4 py-3 text-sm outline-none"
          placeholder="Mot de passe (8 caractères min.)"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-center text-sm text-red">{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit || submitting}
          className="w-full rounded-full bg-black py-3 text-sm font-bold text-white disabled:opacity-35"
        >
          {submitting ? "..." : mode === "login" ? "Se connecter" : "Créer mon équipe"}
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode(mode === "login" ? "signup" : "login");
          }}
          className="w-full text-center text-sm font-medium"
        >
          {mode === "login" ? "Pas encore de compte ? Crée ton équipe" : "Déjà un compte ? Connecte-toi"}
        </button>
      </form>
    </div>
  );
}
