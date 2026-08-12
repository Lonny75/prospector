import { Router } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../config/db.js";
import { anthropic, CLAUDE_PROSPECT_MODEL } from "../config/anthropic.js";
import { composeProspectSystemPrompt } from "@prospector/prompts";

/**
 * Pont "custom LLM" pour ElevenLabs Conversational AI.
 *
 * ElevenLabs appelle cet endpoint à chaque tour de parole, au format compatible OpenAI
 * (chat completions). On y injecte Claude Sonnet 5 comme cerveau du prospect, avec le prompt
 * système composé dynamiquement à partir du secteur/persona/niveau d'objection/format choisis
 * pour la session — voir packages/prompts.
 *
 * Configuration côté ElevenLabs : l'agent est en "Custom LLM" pointant vers
 * POST {API_URL}/voice/llm/chat/completions.
 *
 * IMPORTANT (confirmé empiriquement le 2026-08-12, voir docs/plan.md) : le templating {{variable}}
 * d'ElevenLabs dans `custom_llm.request_headers` NE FONCTIONNE PAS — testé avec une dynamicVariable
 * normale, une "secret dynamic variable" (secret__), et même une variable système garantie
 * ({{system__conversation_id}}) : dans tous les cas le header arrive côté serveur comme le texte
 * littéral non substitué. Le corps de la requête (format OpenAI chat completions) ne contient non
 * plus aucun identifiant de conversation exploitable.
 *
 * Faute de mécanisme fiable pour corréler un appel entrant à une TrainingSession précise, on retombe
 * sur la session "in_progress" la plus récente — ACCEPTABLE UNIQUEMENT pour un usage mono-utilisateur
 * (Phase 0 solo). À remplacer avant tout usage concurrent (plusieurs commerciaux en même temps) par
 * l'un de ces mécanismes plus robustes, à explorer :
 *   1. Un agent ElevenLabs distinct par combinaison secteur/persona/niveau/format, avec des
 *      request_headers STATIQUES (pas de templating requis) identifiant la config — le backend créerait
 *      alors la TrainingSession à la volée sur le premier appel.
 *   2. Le webhook "conversation_initiation_client_data" (vu dans la config agent,
 *      `enable_conversation_initiation_client_data_from_webhook`) — ElevenLabs semble pouvoir appeler
 *      notre serveur AVANT le début de l'appel pour récupérer une config dynamique ; jamais testé.
 */
export const voiceLlmProxyRouter = Router();

interface OpenAiCompatibleMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAiCompatibleChatRequest {
  model?: string;
  messages: OpenAiCompatibleMessage[];
  stream?: boolean;
}

function toOpenAiChunk(sessionId: string, deltaText: string, finishReason: string | null) {
  return {
    id: `chatcmpl-${sessionId}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: CLAUDE_PROSPECT_MODEL,
    choices: [
      {
        index: 0,
        delta: finishReason ? {} : { content: deltaText },
        finish_reason: finishReason,
      },
    ],
  };
}

/**
 * Résout la session à utiliser pour cet appel entrant. Le header x-prospector-session-id n'est
 * fiable que s'il ressemble à un vrai UUID (le templating ElevenLabs ne fonctionnant pas, il arrive
 * généralement encore sous forme de placeholder littéral "{{...}}") — sinon on retombe sur la session
 * "in_progress" la plus récente. Voir le commentaire en tête de fichier.
 */
async function resolveSession(headerSessionId: string | undefined) {
  const looksLikeUuid = headerSessionId && /^[0-9a-f-]{36}$/i.test(headerSessionId);

  if (looksLikeUuid) {
    const session = await prisma.trainingSession.findUnique({
      where: { id: headerSessionId },
      include: { persona: true, objectionLevel: true, callFormat: true },
    });
    if (session) return session;
  }

  console.warn(
    `voice-llm-proxy: header session-id invalide/absent (${JSON.stringify(headerSessionId)}), fallback sur la session in_progress la plus récente`,
  );

  const fallback = await prisma.trainingSession.findFirst({
    where: { status: "in_progress" },
    orderBy: { startedAt: "desc" },
    include: { persona: true, objectionLevel: true, callFormat: true },
  });

  if (!fallback) throw new Error("Aucune session in_progress disponible en fallback");
  return fallback;
}

async function loadSessionPromptContext(headerSessionId: string | undefined) {
  const session = await resolveSession(headerSessionId);

  const systemPrompt = composeProspectSystemPrompt({
    persona: session.persona,
    objectionLevel: session.objectionLevel,
    callFormat: session.callFormat,
  });

  return { session, systemPrompt };
}

async function nextTurnIndex(sessionId: string): Promise<number> {
  const last = await prisma.transcript.findFirst({
    where: { sessionId },
    orderBy: { turnIndex: "desc" },
  });
  return (last?.turnIndex ?? -1) + 1;
}

/**
 * Persiste les tours de transcript à mesure de l'appel.
 *
 * NOTE : les timestamps ici sont approximés côté serveur (heure de réception/réponse du proxy),
 * pas les timestamps audio fins (début/fin de parole réels). Pour le calcul précis du débit,
 * des blancs et des interruptions (moteur de débrief, voir debriefEngine.ts), il faudra recouper
 * avec l'export post-appel d'ElevenLabs si celui-ci fournit des timestamps par tour de parole —
 * c'est le point à vérifier en Phase 0 (voir docs/plan.md, section "Moteur de débrief").
 */
async function recordTranscriptTurn(params: {
  sessionId: string;
  speaker: "rep" | "prospect";
  text: string;
  startedAtMs: number;
  endedAtMs: number;
}) {
  const turnIndex = await nextTurnIndex(params.sessionId);
  await prisma.transcript.create({
    data: {
      sessionId: params.sessionId,
      turnIndex,
      speaker: params.speaker,
      text: params.text,
      startedAtMs: params.startedAtMs,
      endedAtMs: params.endedAtMs,
    },
  });
}

voiceLlmProxyRouter.post("/chat/completions", async (req, res) => {
  const headerSessionId = req.header("x-prospector-session-id");

  const body = req.body as OpenAiCompatibleChatRequest;
  const lastUserMessage = [...body.messages].reverse().find((m) => m.role === "user");

  let sessionId: string;
  let systemPrompt: string;
  let sessionStartedAtMs: number;
  try {
    const context = await loadSessionPromptContext(headerSessionId);
    sessionId = context.session.id;
    systemPrompt = context.systemPrompt;
    sessionStartedAtMs = context.session.startedAt.getTime();
  } catch (err) {
    console.error("voice-llm-proxy: impossible de résoudre une session", err);
    res.status(404).json({ error: "Aucune session disponible pour cet appel" });
    return;
  }

  // Timestamps stockés en ms RELATIFS au début de la session (pas en epoch absolu, qui déborderait
  // la colonne Int32 en base — voir callMetrics.ts qui attend des offsets courts, pas des dates).
  const turnStartedAt = Date.now() - sessionStartedAtMs;

  if (lastUserMessage) {
    await recordTranscriptTurn({
      sessionId,
      speaker: "rep",
      text: lastUserMessage.content,
      startedAtMs: turnStartedAt,
      endedAtMs: turnStartedAt,
    });
  }

  // Historique de conversation (hors system) traduit au format Anthropic.
  const anthropicMessages = body.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const streamId = randomUUID();
  let fullText = "";

  try {
    const stream = anthropic.messages.stream({
      model: CLAUDE_PROSPECT_MODEL,
      max_tokens: 300,
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: anthropicMessages,
    });

    stream.on("text", (delta) => {
      fullText += delta;
      res.write(`data: ${JSON.stringify(toOpenAiChunk(streamId, delta, null))}\n\n`);
    });

    await stream.finalMessage();

    res.write(`data: ${JSON.stringify(toOpenAiChunk(streamId, "", "stop"))}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();

    await recordTranscriptTurn({
      sessionId,
      speaker: "prospect",
      text: fullText,
      startedAtMs: turnStartedAt,
      endedAtMs: Date.now() - sessionStartedAtMs,
    });
  } catch (err) {
    console.error("voice-llm-proxy: erreur de streaming Claude", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erreur interne du pont IA" });
    } else {
      res.end();
    }
  }
});
