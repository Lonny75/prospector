import type { TrainingSession, DebriefResult, Sector, Persona, ObjectionLevel, CallFormat } from "@prospector/shared-types";

// TODO Phase 1 : remplacer par une variable EAS/expo-constants une fois le déploiement Railway prêt.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3001";

/** Phase 0/1 uniquement — pas d'auth encore (voir services/api/src/routes/catalog.ts). */
export async function fetchTestUser(): Promise<{ id: string }> {
  const res = await fetch(`${API_URL}/catalog/test-user`);
  if (!res.ok) throw new Error("Échec de chargement de l'utilisateur de test");
  return res.json();
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
  userId: string;
  sectorId: string;
  personaId: string;
  objectionLevelId: string;
  callFormatId: string;
}): Promise<TrainingSession> {
  const res = await fetch(`${API_URL}/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Échec de création de la session");
  return res.json();
}

export async function endTrainingSession(sessionId: string): Promise<TrainingSession> {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/end`, { method: "POST" });
  if (!res.ok) throw new Error("Échec de fin de session");
  return res.json();
}

export async function requestDebrief(sessionId: string): Promise<{ debriefId: string; flaggedForReview: boolean }> {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/debrief`, { method: "POST" });
  if (!res.ok) throw new Error("Échec de génération du débrief");
  return res.json();
}

export async function fetchDebrief(sessionId: string): Promise<DebriefResult> {
  const res = await fetch(`${API_URL}/sessions/${sessionId}/debrief`);
  if (!res.ok) throw new Error("Débrief indisponible");
  return res.json();
}
