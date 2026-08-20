import type { OrganizationSummary } from "@prospector/shared-types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type AuthUser = { id: string; email: string; name: string; role: string; organizationId: string | null };

const TOKEN_KEY = "prospectora_dashboard_token";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

function authHeaders(): HeadersInit {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseJsonOrThrow(res: Response, fallbackMessage: string) {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? fallbackMessage);
  return body;
}

export async function login(params: { email: string; password: string }): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseJsonOrThrow(res, "Échec de la connexion");
}

export async function signupManager(params: { email: string; name: string; password: string; organizationName: string }): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseJsonOrThrow(res, "Échec de l'inscription");
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/me`, { headers: authHeaders() });
  return parseJsonOrThrow(res, "Session invalide");
}

export async function fetchOrganization(): Promise<OrganizationSummary> {
  const res = await fetch(`${API_URL}/organizations/me`, { headers: authHeaders() });
  return parseJsonOrThrow(res, "Échec de chargement de l'équipe");
}

export async function regenerateInviteCode(): Promise<{ inviteCode: string }> {
  const res = await fetch(`${API_URL}/organizations/me/regenerate-invite-code`, { method: "POST", headers: authHeaders() });
  return parseJsonOrThrow(res, "Échec de la régénération du code");
}

export async function createCheckoutSession(seats: number): Promise<{ url: string }> {
  const res = await fetch(`${API_URL}/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ seats }),
  });
  return parseJsonOrThrow(res, "Échec de la création de la session de paiement");
}

export async function createPortalSession(): Promise<{ url: string }> {
  const res = await fetch(`${API_URL}/billing/portal`, { method: "POST", headers: authHeaders() });
  return parseJsonOrThrow(res, "Échec de l'ouverture du portail de facturation");
}
