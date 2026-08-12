import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, CLAUDE_DEBRIEF_MODEL, CLAUDE_VALIDATION_MODEL } from "../config/anthropic.js";
import { prisma } from "../config/db.js";
import { DEBRIEF_RUBRIC_PROMPT, DEBRIEF_RUBRIC_VERSION } from "@prospector/prompts";
import type { DebriefResult } from "@prospector/shared-types";
import { computeCallMetrics, formatMetricsAsFacts } from "./callMetrics.js";
import { verifyAllVerbatims } from "./verbatimVerification.js";

const MAX_GENERATION_ATTEMPTS = 2;

/**
 * Schéma JSON forcé via tool-use Anthropic — c'est le mécanisme qui garantit une sortie structurée
 * fiable (pas de parsing de prose libre). Doit rester synchronisé avec DebriefResult
 * (packages/shared-types) et avec ce que consomme le mobile pour l'affichage.
 */
const DEBRIEF_TOOL: Anthropic.Tool = {
  name: "submit_debrief",
  description: "Soumet le débrief structuré de la session d'entraînement.",
  input_schema: {
    type: "object",
    properties: {
      overallScore: { type: "integer", minimum: 0, maximum: 100 },
      fond: debriefAxisSchema(),
      forme: debriefAxisSchema(),
    },
    required: ["overallScore", "fond", "forme"],
  },
};

function debriefAxisSchema() {
  return {
    type: "object",
    properties: {
      score: { type: "integer", minimum: 0, maximum: 100 },
      strengths: { type: "array", items: { type: "string" }, maxItems: 3 },
      improvements: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            priority: { type: "integer", enum: [1, 2, 3] },
            text: { type: "string" },
          },
          required: ["priority", "text"],
        },
      },
      verbatims: {
        type: "array",
        items: {
          type: "object",
          properties: {
            transcriptTurnIndex: { type: "integer" },
            quoteText: { type: "string" },
            comment: { type: "string" },
            type: { type: "string", enum: ["moment_fort", "a_ameliorer"] },
          },
          required: ["transcriptTurnIndex", "quoteText", "comment", "type"],
        },
      },
    },
    required: ["score", "strengths", "improvements", "verbatims"],
  } as const;
}

async function requestDebriefFromClaude(params: {
  transcriptText: string;
  metricsFacts: string;
  sectorLabel: string;
  objectionLevelLabel: string;
  callFormatLabel: string;
  retryNote?: string;
}): Promise<DebriefResult> {
  const userContent = [
    `Secteur : ${params.sectorLabel}`,
    `Niveau d'objection : ${params.objectionLevelLabel}`,
    `Format d'appel : ${params.callFormatLabel}`,
    "",
    "Métriques précalculées (faits, ne pas recalculer) :",
    params.metricsFacts,
    "",
    "Transcript complet (format 'tour X [locuteur]: texte') :",
    params.transcriptText,
    params.retryNote ? `\n${params.retryNote}` : "",
  ].join("\n");

  const message = await anthropic.messages.create({
    model: CLAUDE_DEBRIEF_MODEL,
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: DEBRIEF_RUBRIC_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
    tools: [DEBRIEF_TOOL],
    tool_choice: { type: "tool", name: "submit_debrief" },
  });

  if (message.stop_reason === "max_tokens") {
    throw new Error("Réponse de Claude tronquée (max_tokens atteint) — débrief incomplet");
  }

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude n'a pas retourné de tool_use pour submit_debrief");
  }

  const candidate = toolUse.input as DebriefResult;
  if (!candidate.fond || !candidate.forme || typeof candidate.overallScore !== "number") {
    throw new Error(`Structure de débrief incomplète: ${JSON.stringify(candidate)}`);
  }

  return candidate;
}

/**
 * Génère et persiste le débrief d'une session terminée.
 *
 * Pipeline anti-hallucination (voir docs/plan.md) :
 * 1. Métriques calculées en code déterministe, jamais par le LLM.
 * 2. Sortie forcée en JSON structuré (tool-use).
 * 3. Chaque verbatim est vérifié programmatiquement contre le transcript réel ; en cas d'échec,
 *    un retry (max 1) est tenté avec une note explicite, puis la génération est acceptée avec
 *    un flag de revue manuelle si le second essai échoue encore.
 */
export async function generateDebrief(sessionId: string): Promise<{ debriefId: string; flaggedForReview: boolean }> {
  const session = await prisma.trainingSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { sector: true, objectionLevel: true, callFormat: true },
  });

  const turns = await prisma.transcript.findMany({
    where: { sessionId },
    orderBy: { turnIndex: "asc" },
  });

  const metrics = computeCallMetrics(turns, session.callFormat.targetDurationSeconds);
  const metricsFacts = formatMetricsAsFacts(metrics);
  const transcriptText = turns.map((t) => `tour ${t.turnIndex} [${t.speaker}]: ${t.text}`).join("\n");

  let result: DebriefResult | null = null;
  let flaggedForReview = false;
  let retryNote: string | undefined;

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
    let candidate: DebriefResult;
    try {
      candidate = await requestDebriefFromClaude({
        transcriptText,
        metricsFacts,
        sectorLabel: session.sector.label,
        objectionLevelLabel: session.objectionLevel.label,
        callFormatLabel: session.callFormat.label,
        retryNote,
      });
    } catch (err) {
      console.error(`Débrief session=${sessionId}: échec de la tentative ${attempt}`, err);
      if (attempt === MAX_GENERATION_ATTEMPTS) throw err;
      retryNote = "ATTENTION : ta précédente réponse était incomplète ou mal formée. Reste concis et respecte strictement le schéma demandé.";
      continue;
    }

    const allVerbatims = [...candidate.fond.verbatims, ...candidate.forme.verbatims];
    const { allValid, failures } = verifyAllVerbatims(
      allVerbatims,
      turns.map((t) => ({ turnIndex: t.turnIndex, text: t.text })),
    );

    if (allValid) {
      result = candidate;
      break;
    }

    if (attempt === MAX_GENERATION_ATTEMPTS) {
      result = candidate;
      flaggedForReview = true;
      console.warn(`Débrief session=${sessionId} accepté avec verbatims invalides après retry:`, failures);
    } else {
      retryNote = `ATTENTION : ta précédente tentative contenait des citations incorrectes (${failures.join("; ")}). Les citations doivent être EXACTES, mot pour mot, extraites du transcript fourni.`;
    }
  }

  if (!result) {
    throw new Error("Échec de génération du débrief après tous les essais");
  }

  const debrief = await prisma.debrief.create({
    data: {
      sessionId,
      overallScore: result.overallScore,
      fondScore: result.fond.score,
      formeScore: result.forme.score,
      modelUsed: CLAUDE_DEBRIEF_MODEL,
      promptVersion: DEBRIEF_RUBRIC_VERSION,
      rawJson: result as unknown as object,
      strengths: {
        create: [
          ...result.fond.strengths.map((text, i) => ({ category: "fond" as const, text, orderIndex: i })),
          ...result.forme.strengths.map((text, i) => ({ category: "forme" as const, text, orderIndex: i })),
        ],
      },
      improvements: {
        create: [
          ...result.fond.improvements.map((imp, i) => ({
            category: "fond" as const,
            priority: imp.priority,
            text: imp.text,
            orderIndex: i,
          })),
          ...result.forme.improvements.map((imp, i) => ({
            category: "forme" as const,
            priority: imp.priority,
            text: imp.text,
            orderIndex: i,
          })),
        ],
      },
      verbatims: {
        create: [
          ...result.fond.verbatims.map((v) => ({
            transcriptTurnIndex: v.transcriptTurnIndex,
            quoteText: v.quoteText,
            comment: v.comment,
            type: v.type,
            axis: "fond" as const,
          })),
          ...result.forme.verbatims.map((v) => ({
            transcriptTurnIndex: v.transcriptTurnIndex,
            quoteText: v.quoteText,
            comment: v.comment,
            type: v.type,
            axis: "forme" as const,
          })),
        ],
      },
    },
  });

  return { debriefId: debrief.id, flaggedForReview };
}

/**
 * Garde-fou optionnel (recommandé, coût marginal négligeable) : un second appel Haiku relit le
 * débrief généré et signale une incohérence évidente entre le débrief et les faits/transcript.
 * Non branché automatiquement dans generateDebrief() pour l'instant — à activer une fois la Phase 1
 * validée, si les faux positifs du garde-fou verbatims (ci-dessus) s'avèrent insuffisants en pratique.
 */
export async function crossValidateDebrief(params: {
  transcriptText: string;
  metricsFacts: string;
  debrief: DebriefResult;
}): Promise<{ consistent: boolean; explanation: string }> {
  const message = await anthropic.messages.create({
    model: CLAUDE_VALIDATION_MODEL,
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: [
          "Voici un transcript d'appel, des métriques précalculées, et un débrief généré par un autre modèle.",
          "Réponds UNIQUEMENT par 'COHERENT' ou 'INCOHERENT: <raison courte>'.",
          "",
          params.metricsFacts,
          "",
          params.transcriptText,
          "",
          `Débrief généré : ${JSON.stringify(params.debrief)}`,
        ].join("\n"),
      },
    ],
  });

  const text = message.content.find((b) => b.type === "text");
  const answer = text && text.type === "text" ? text.text.trim() : "INCOHERENT: réponse vide";

  return {
    consistent: answer.startsWith("COHERENT"),
    explanation: answer,
  };
}
