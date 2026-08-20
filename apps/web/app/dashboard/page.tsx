"use client";

import { useEffect, useState } from "react";
import type { OrganizationSummary } from "@prospector/shared-types";
import { fetchOrganization, regenerateInviteCode } from "../../lib/api";

const STATUS_LABELS: Record<string, string> = {
  trialing: "Essai gratuit en cours",
  active: "Abonnement actif",
  past_due: "Paiement en retard",
  canceled: "Abonnement annulé",
  incomplete: "Paiement incomplet",
};

export default function DashboardPage() {
  const [org, setOrg] = useState<OrganizationSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  function load() {
    fetchOrganization()
      .then(setOrg)
      .catch((err) => setError(err instanceof Error ? err.message : "Échec de chargement"));
  }

  useEffect(load, []);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await regenerateInviteCode();
      load();
    } finally {
      setRegenerating(false);
    }
  }

  function handleCopy() {
    if (!org) return;
    navigator.clipboard.writeText(org.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) return <p className="text-red">{error}</p>;
  if (!org) return <p className="text-text-muted">Chargement...</p>;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-purple p-6 text-white">
        <p className="text-sm opacity-85">{org.name}</p>
        <p className="mt-1 text-lg font-bold">
          {org.subscriptionStatus ? STATUS_LABELS[org.subscriptionStatus] ?? org.subscriptionStatus : "Aucun abonnement — achète des sièges pour commencer"}
        </p>
      </div>

      <div className="rounded-3xl bg-white p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Code d&apos;invitation</p>
        <p className="mt-1 text-sm text-text-muted">
          Partage ce code à tes commerciaux — ils l&apos;entrent à l&apos;inscription dans l&apos;app mobile pour rejoindre l&apos;équipe.
        </p>
        <div className="mt-3 flex items-center gap-3">
          <code className="rounded-full bg-cream px-4 py-2 text-lg font-bold tracking-widest">{org.inviteCode}</code>
          <button onClick={handleCopy} className="rounded-full bg-black px-4 py-2 text-sm font-bold text-white">
            {copied ? "Copié !" : "Copier"}
          </button>
          <button onClick={handleRegenerate} disabled={regenerating} className="text-sm font-medium text-text-muted disabled:opacity-50">
            Régénérer
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-text-muted">
          Équipe ({org.members.length} {org.members.length > 1 ? "membres" : "membre"})
        </p>
        <div className="space-y-2">
          {org.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-2xl bg-cream px-4 py-3">
              <div>
                <p className="text-sm font-bold">
                  {m.name} {m.role === "manager" && <span className="text-xs font-medium text-text-muted">(manager)</span>}
                </p>
                <p className="text-xs text-text-muted">{m.email}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-bold">{m.sessionCount} appel{m.sessionCount > 1 ? "s" : ""}</p>
                <p className="text-xs text-text-muted">{m.averageScore != null ? `${m.averageScore}/100 en moyenne` : "Pas encore de score"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
