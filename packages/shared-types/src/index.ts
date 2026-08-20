export type UserRole = "rep" | "manager" | "admin";
export type SessionStatus = "in_progress" | "completed" | "aborted";
export type Speaker = "rep" | "prospect";
export type FeedbackCategory = "fond" | "forme";
export type VerbatimType = "moment_fort" | "a_ameliorer";

export interface Sector {
  id: string;
  slug: string;
  label: string;
  description?: string;
  vocabularyNotes?: string;
}

export interface Persona {
  id: string;
  sectorId: string;
  name: string;
  baseSystemPromptFragment: string;
  elevenlabsVoiceId: string;
  toneMetadata?: Record<string, unknown>;
}

export interface ObjectionLevel {
  id: string;
  slug: "debutant" | "intermediaire" | "avance" | "expert";
  label: string;
  systemPromptFragment: string;
  tacticsJson?: Record<string, unknown>;
}

export interface CallFormat {
  id: string;
  slug: "decouverte" | "closing" | "relance" | string;
  label: string;
  targetDurationSeconds: number;
  systemPromptFragment: string;
}

export interface TranscriptTurn {
  turnIndex: number;
  speaker: Speaker;
  text: string;
  startedAtMs: number;
  endedAtMs: number;
}

export interface TrainingSession {
  id: string;
  userId: string;
  sectorId: string;
  personaId: string;
  objectionLevelId: string;
  callFormatId: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  durationSeconds?: number;
  elevenlabsConversationId?: string;
}

export interface DebriefVerbatim {
  transcriptTurnIndex: number;
  quoteText: string;
  comment: string;
  type: VerbatimType;
  axis: FeedbackCategory;
}

export interface DebriefImprovement {
  category: FeedbackCategory;
  priority: 1 | 2 | 3;
  text: string;
}

export interface DebriefAxis {
  score: number;
  strengths: string[];
  improvements: DebriefImprovement[];
  verbatims: DebriefVerbatim[];
}

/** Sortie structurée attendue de Claude pour un débrief — voir debriefEngine.ts */
export interface DebriefResult {
  overallScore: number;
  fond: DebriefAxis;
  forme: DebriefAxis;
}

export interface SessionHistoryItem {
  id: string;
  status: SessionStatus;
  startedAt: string;
  endedAt?: string;
  sectorLabel: string;
  personaName: string;
  objectionLevelLabel: string;
  callFormatLabel: string;
  overallScore: number | null;
}

export interface OrganizationMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  sessionCount: number;
  averageScore: number | null;
}

export interface OrganizationSummary {
  id: string;
  name: string;
  plan: string | null;
  seatsPurchased: number;
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
  inviteCode: string;
  members: OrganizationMember[];
}

export interface CallMetrics {
  wordsPerMinute: number;
  longSilences: { startedAtMs: number; durationMs: number }[];
  interruptionsByRep: { turnIndex: number; atMs: number }[];
  targetDurationSeconds: number;
  actualDurationSeconds: number;
}
