"use client";

import { useEffect, useState } from "react";
import type { OrganizationSummary } from "@prospector/shared-types";
import { fetchOrganization, createCheckoutSession, createPortalSession } from "../../../lib/api";

export default function BillingPage() {
  const [org, setOrg] = useState<OrganizationSummary | null>(null);
  const [seats, setSeats] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOrganization()
      .then(setOrg)
      .catch((err) => setError(err instanceof Error ? err.message : "Échec de chargement"));
  }, []);

  async function handleCheckout() {
    setError(null);
    setSubmitting(true);
    try {
      const { url } = await createCheckoutSession(seats);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du paiement");
      setSubmitting(false);
    }
  }

  async function handlePortal() {
    setError(null);
    setSubmitting(true);
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'ouverture du portail");
      setSubmitting(false);
    }
  }

  const hasSubscription = Boolean(org?.subscriptionStatus);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6">
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Abonnement</p>
        <p className="mt-1 text-lg font-bold">49 € / siège / mois — 14 jours d&apos;essai gratuit</p>
        <p className="mt-1 text-sm text-text-muted">
          {org ? `${org.seatsPurchased} siège${org.seatsPurchased > 1 ? "s" : ""} actuellement` : "Chargement..."}
        </p>
      </div>

      {error && <p className="text-red">{error}</p>}

      {!hasSubscription ? (
        <div className="rounded-3xl bg-white p-6">
          <label className="text-sm font-medium">Nombre de sièges</label>
          <input
            type="number"
            min={1}
            value={seats}
            onChange={(e) => setSeats(Math.max(1, Number(e.target.value)))}
            className="mt-2 w-24 rounded-2xl bg-cream px-4 py-2 text-sm outline-none"
          />
          <button
            onClick={handleCheckout}
            disabled={submitting}
            className="mt-4 block w-full rounded-full bg-black py-3 text-sm font-bold text-white disabled:opacity-35"
          >
            Acheter {seats} siège{seats > 1 ? "s" : ""}
          </button>
        </div>
      ) : (
        <button
          onClick={handlePortal}
          disabled={submitting}
          className="w-full rounded-full bg-black py-3 text-sm font-bold text-white disabled:opacity-35"
        >
          Gérer l&apos;abonnement
        </button>
      )}
    </div>
  );
}
