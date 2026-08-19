import type { TrainingSession, DebriefResult, Sector, Persona, ObjectionLevel, CallFormat, SessionHistoryItem } from "@prospector/shared-types";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

export type AuthUser = { id: string; email: string; name: string; role: string };

// Tenu en mémoire par AuthProvider (voir lib/auth.tsx) — pas de lecture async de SecureStore à
// chaque requête, juste au démarrage de l'app.
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

function authHeaders(): HeadersInit {
  return authToken ? { Authorization: `Bearer ${authToken}` } : {};
}

async function parseJsonOrThrow(res: Response, fallbackMessage: string) {
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? fallbackMessage);
  return body;
}

export async function signup(params: { email: string; name: string; password: string }): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseJsonOrThrow(res, "Échec de l'inscription");
}

export async function login(params: { email: string; password: string }): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return parseJsonOrThrow(res, "Échec de la connexion");
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/auth/me`, { headers: authHeaders() });
  return parseJsonOrThrow(res, "Session invalide");
}

export async function fetchSectors(): Promise<Sector[]> {
  const res = await fetch(`${API_URL}/catalog/sectors`);
  if (!res.ok) throw new Error("Échec de chargement des secteurs");
  return res.json();
}

export async function fetchPersonas(sectorId: string): Promise<Persona[]> {
  const res = await fetch(`${API_URL}/catalog/sectors/${sectorId}/personas`);
  if (!res.ok) throw new Error("Échec de chargement des personas");
  return res.json();
}

export async function fetchObjectionLevels(): Promise<ObjectionLevel[]> {
  const res = await fetch(`${API_URL}/catalog/objection-levels`);
  if (!res.ok) throw new Error("Échec de chargement des niveaux d'objection");
  return res.json();
}

export async function fetchCallFormats(): Promise<CallFormat[]> {
  const res = await fetch(`${API_URL}/catalog/call-formats`);
  if (!res.ok) throw new Error("Échec de chargement des formats d'appel");
  return res.json();
}

export async function createTrainingSession(params: {
  sectorId: string;
  personaId: string;
  objectionLevelId: string;
  callFormatId: string;
}): Promise<TrainingSession> {
  const res = await fetch(`${API_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Échec de création de la session");
  return res.json();
}

export async function fetchTrainingSession(
  sessionId: string,
): Promise<TrainingSession & { persona: Persona }> {
  const res = await fetch(`${API_URL}/sessions/${sessionId}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Échec de chargement de la session");
  return res.json();
}

export async function warmTrainingSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/warm`, { method: "POST", headers: authHeaders() });
  if (!res.ok) throw new Error("Échec du préchauffage de la session");
}

export async function endTrainingSession(sessionId: string): Promise<TrainingSession> {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/end`, { method: "POST", headers: authHeaders() });
  if (!res.ok) throw new Error("Échec de fin de session");
  return res.json();
}

export async function requestDebrief(sessionId: string): Promise<{ debriefId: string; flaggedForReview: boolean }> {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/debrief`, { method: "POST", headers: authHeaders() });
  if (!res.ok) throw new Error("Échec de génération du débrief");
  return res.json();
}

export async function fetchDebrief(sessionId: string): Promise<DebriefResult> {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/debrief`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Débrief indisponible");
  return res.json();
}

export async function fetchSessionHistory(): Promise<SessionHistoryItem[]> {
  const res = await fetch(`${API_URL}/sessions`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Échec de chargement de l'historique");
  return res.json();
}
