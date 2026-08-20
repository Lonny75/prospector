"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../lib/auth";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!loading && !user) router.replace("/");
  }, [loading, user, router]);

  if (loading || !user) return null;

  return (
    <div className="mx-auto min-h-screen max-w-3xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/dashboard" className="text-xl font-extrabold">
          Prospectora
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/dashboard">Équipe</Link>
          <Link href="/dashboard/billing">Facturation</Link>
          <button onClick={logout} className="text-text-muted">
            Déconnexion
          </button>
        </nav>
      </header>
      {children}
    </div>
  );
}
