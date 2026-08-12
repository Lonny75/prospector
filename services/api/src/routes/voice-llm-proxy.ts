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
 * Configuration côté ElevenLabs (Phase 0, à faire manuellement dans leur dashboard) :
 * l'agent doit être configuré en "Custom LLM" pointant vers POST {API_URL}/voice/llm/chat/completions,
 * avec un header personnalisé "x-prospector-session-id" transmettant l'ID de la TrainingSession créée
 * côté Prospector au moment où le mobile démarre l'appel (voir routes/sessions.ts, à créer en Phase 1).
 *
 * TODO Phase 0 (spike) : vérifier le format exact des headers/metadata qu'ElevenLabs transmet
 * réellement à un custom LLM (la doc évolue) et ajuster l'extraction de sessionId ci-dessous en
 * conséquence si besoin.
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

async function loadSessionPromptContext(sessionId: string) {
  const session = await prisma.trainingSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { persona: true, objectionLevel: true, callFormat: true },
  });

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
  const sessionId = req.header("x-prospector-session-id");
  console.log(`voice-llm-proxy: x-prospector-session-id reçu = ${JSON.stringify(sessionId)}`);
  console.log(`voice-llm-proxy: x-test-conversation-id reçu = ${JSON.stringify(req.header("x-test-conversation-id"))}`);
  console.log(`voice-llm-proxy: tous les headers = ${JSON.stringify(req.headers)}`);

  if (!sessionId) {
    res.status(400).json({ error: "x-prospector-session-id manquant" });
    return;
  }

  const body = req.body as OpenAiCompatibleChatRequest;
  const lastUserMessage = [...body.messages].reverse().find((m) => m.role === "user");

  let systemPrompt: string;
  try {
    ({ systemPrompt } = await loadSessionPromptContext(sessionId));
  } catch (err) {
    console.error(`voice-llm-proxy: session introuvable pour sessionId=${sessionId}`, err);
    res.status(404).json({ error: `Session introuvable: ${sessionId}` });
    return;
  }

  const turnStartedAt = Date.now();

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
      endedAtMs: Date.now(),
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
