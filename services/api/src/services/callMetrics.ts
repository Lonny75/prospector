import type { CallMetrics } from "@prospector/shared-types";

interface TranscriptTurnLike {
  turnIndex: number;
  speaker: "rep" | "prospect";
  text: string;
  startedAtMs: number;
  endedAtMs: number;
}

const LONG_SILENCE_THRESHOLD_MS = 2000;

/**
 * Calcule les métriques de forme en code déterministe, à partir des timestamps réels du transcript.
 * Claude ne doit jamais recalculer ces chiffres lui-même — il les reçoit comme des faits (voir
 * debriefEngine.ts) et les interprète. C'est le garde-fou anti-hallucination n°1 (voir docs/plan.md).
 *
 * NOTE : la fiabilité de ces métriques dépend de timestamps par tour fidèles à l'audio réel.
 * Si voice-llm-proxy.ts n'utilise encore que des timestamps approximés côté serveur (limitation
 * documentée là-bas), wordsPerMinute/longSilences/interruptions seront peu fiables tant que
 * ce n'est pas corrigé avec de vrais timestamps audio (export ElevenLabs post-appel, Phase 0).
 */
export function computeCallMetrics(
  turns: TranscriptTurnLike[],
  targetDurationSeconds: number,
): CallMetrics {
  const sorted = [...turns].sort((a, b) => a.turnIndex - b.turnIndex);

  const repTurns = sorted.filter((t) => t.speaker === "rep");
  const repWordCount = repTurns.reduce((sum, t) => sum + countWords(t.text), 0);
  const repSpeakingMs = repTurns.reduce((sum, t) => sum + Math.max(0, t.endedAtMs - t.startedAtMs), 0);
  const wordsPerMinute = repSpeakingMs > 0 ? Math.round((repWordCount / repSpeakingMs) * 60_000) : 0;

  const longSilences: CallMetrics["longSilences"] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gapMs = sorted[i].startedAtMs - sorted[i - 1].endedAtMs;
    if (gapMs >= LONG_SILENCE_THRESHOLD_MS) {
      longSilences.push({ startedAtMs: sorted[i - 1].endedAtMs, durationMs: gapMs });
    }
  }

  const interruptionsByRep: CallMetrics["interruptionsByRep"] = [];
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const previous = sorted[i - 1];
    if (current.speaker === "rep" && previous.speaker === "prospect" && current.startedAtMs < previous.endedAtMs) {
      interruptionsByRep.push({ turnIndex: current.turnIndex, atMs: current.startedAtMs });
    }
  }

  const actualDurationSeconds =
    sorted.length > 0
      ? Math.round((sorted[sorted.length - 1].endedAtMs - sorted[0].startedAtMs) / 1000)
      : 0;

  return {
    wordsPerMinute,
    longSilences,
    interruptionsByRep,
    targetDurationSeconds,
    actualDurationSeconds,
  };
}

function countWords(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

/** Traduit les métriques précalculées en phrase factuelle à injecter dans le prompt de débrief. */
export function formatMetricsAsFacts(metrics: CallMetrics): string {
  const silencesDesc =
    metrics.longSilences.length > 0
      ? metrics.longSilences.map((s) => `${Math.round(s.durationMs / 1000)}s`).join(", ")
      : "aucun";

  const interruptionsDesc =
    metrics.interruptionsByRep.length > 0
      ? metrics.interruptionsByRep.map((i) => `tour ${i.turnIndex}`).join(", ")
      : "aucune";

  return [
    `Débit moyen du commercial : ${metrics.wordsPerMinute} mots/minute.`,
    `Blancs de plus de 2 secondes : ${metrics.longSilences.length} occurrence(s) (${silencesDesc}).`,
    `Interruptions du prospect par le commercial : ${metrics.interruptionsByRep.length} (${interruptionsDesc}).`,
    `Durée cible du format : ${metrics.targetDurationSeconds}s — durée réelle : ${metrics.actualDurationSeconds}s.`,
  ].join("\n");
}
