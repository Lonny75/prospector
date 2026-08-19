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
 * CORRÉLATION DE SESSION (2026-08) : le templating {{variable}} d'ElevenLabs dans
 * `custom_llm.request_headers` NE FONCTIONNE PAS (confirmé empiriquement le 2026-08-12, voir
 * docs/plan.md — testé avec dynamicVariable normale, secret__, et même une variable système garantie).
 * Le mécanisme qui fonctionne : `customLlmExtraBody` côté client (`startSession({ customLlmExtraBody:
 * { sessionId } })`) — c'est un événement de config structuré envoyé directement par le SDK, pas un
 * templating côté serveur ElevenLabs, donc pas soumis au même bug. Permission "custom_llm_extra_body"
 * à activer côté agent (`platform_settings.overrides.custom_llm_extra_body: true`).
 *
 * ATTENTION à l'emplacement réel dans le corps reçu : ElevenLabs n'injecte PAS customLlmExtraBody à
 * la racine du corps chat-completions, mais sous une clé `elevenlabs_extra_body` (confirmé le
 * 2026-08-19 via un dump des requêtes brutes — non documenté, a fait planter la corrélation de
 * session pendant plusieurs jours, `req.body.sessionId` étant toujours undefined). Le champ correct
 * est `req.body.elevenlabs_extra_body.sessionId`.
 *
 * Le header x-prospector-session-id et le fallback "session in_progress la plus récente" restent en
 * secours si jamais `elevenlabs_extra_body.sessionId` est absent (ex: ancien client mobile pas
 * encore mis à jour) — mais ce fallback ne doit plus être le chemin normal.
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
  // ElevenLabs enveloppe customLlmExtraBody sous cette clé plutôt que de le fusionner à la racine
  // du corps (confirmé le 2026-08-19 via un dump des requêtes brutes — la doc ne le précise pas,
  // et body.sessionId à plat était systématiquement undefined jusqu'ici).
  elevenlabs_extra_body?: { sessionId?: string };
}

/**
 * Le format chat-completions streamé attend un `role: "assistant"` sur le premier delta — sans
 * quoi certains consommateurs OpenAI-compatible stricts (dont, semble-t-il, ElevenLabs côté
 * custom LLM) rejettent le flux silencieusement plutôt que de l'ignorer (observé le 2026-08-19 :
 * réponse correcte en direct via curl, mais "Server error: Unknown error" systématique côté
 * ElevenLabs — le flux ne posait jamais problème hors de leur pipeline).
 */
function toOpenAiChunk(sessionId: string, deltaText: string, finishReason: string | null, isFirstChunk: boolean) {
  return {
    id: `chatcmpl-${sessionId}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: CLAUDE_PROSPECT_MODEL,
    choices: [
      {
        index: 0,
        delta: finishReason ? {} : { ...(isFirstChunk ? { role: "assistant" as const } : {}), content: deltaText },
        finish_reason: finishReason,
      },
    ],
  };
}

/**
 * Résout la session à utiliser pour cet appel entrant. `bodySessionId` (via customLlmExtraBody, voir
 * commentaire en tête de fichier) est la source fiable ; le header et le fallback ne sont que des
 * filets de sécurité.
 */
async function resolveSession(bodySessionId: string | undefined, headerSessionId: string | undefined) {
  for (const candidate of [bodySessionId, headerSessionId]) {
    const looksLikeUuid = candidate && /^[0-9a-f-]{36}$/i.test(candidate);
    if (!looksLikeUuid) continue;
    const session = await prisma.trainingSession.findUnique({
      where: { id: candidate },
      include: { persona: true, objectionLevel: true, callFormat: true },
    });
    if (session) return session;
  }

  console.warn(
    `voice-llm-proxy: sessionId introuvable/invalide (body=${JSON.stringify(bodySessionId)}, header=${JSON.stringify(headerSessionId)}), fallback sur la session in_progress la plus récente`,
  );

  const fallback = await prisma.trainingSession.findFirst({
    where: { status: "in_progress" },
    orderBy: { startedAt: "desc" },
    include: { persona: true, objectionLevel: true, callFormat: true },
  });

  if (!fallback) throw new Error("Aucune session in_progress disponible en fallback");
  return fallback;
}

async function loadSessionPromptContext(bodySessionId: string | undefined, headerSessionId: string | undefined) {
  const session = await resolveSession(bodySessionId, headerSessionId);

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
  // Tout le handler est sous ce try/catch : Express 4 n'intercepte pas les rejets de promesse
  // levés dans un handler async, donc toute exception non attrapée ici laisserait la requête sans
  // réponse jusqu'au timeout côté ElevenLabs (observé le 2026-08-19 : "Server error: Unknown error"
  // générique côté client, sans aucune trace d'erreur serveur — la requête n'avait jamais répondu).
  try {
    const headerSessionId = req.header("x-prospector-session-id");
    const body = req.body as OpenAiCompatibleChatRequest;
    const bodySessionId = body.elevenlabs_extra_body?.sessionId;
    console.log(
      `voice-llm-proxy: requête reçue (bodySessionId=${JSON.stringify(bodySessionId)}, headerSessionId=${JSON.stringify(headerSessionId)}, messageCount=${Array.isArray(body.messages) ? body.messages.length : "n/a"})`,
    );
    if (!Array.isArray(body.messages)) {
      console.error("voice-llm-proxy: requête sans messages exploitable", JSON.stringify(body));
      res.status(400).json({ error: "messages manquant ou invalide" });
      return;
    }
    const lastUserMessage = [...body.messages].reverse().find((m) => m.role === "user");

    let sessionId: string;
    let systemPrompt: string;
    let sessionStartedAtMs: number;
    try {
      const context = await loadSessionPromptContext(bodySessionId, headerSessionId);
      sessionId = context.session.id;
      systemPrompt = context.systemPrompt;
      sessionStartedAtMs = context.session.startedAt.getTime();
    } catch (err) {
      console.error("voice-llm-proxy: impossible de résoudre une session", err);
      res.status(404).json({ error: "Aucune session disponible pour cet appel" });
      return;
    }

    // Timestamps stockés en ms RELATIFS au début de la session (pas en epoch absolu, qui
    // déborderait la colonne Int32 en base — voir callMetrics.ts qui attend des offsets courts).
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

      // Chunk dédié annonçant `role: "assistant"` avant tout contenu, comme le fait l'API OpenAI
      // réelle — voir le commentaire sur toOpenAiChunk.
      res.write(`data: ${JSON.stringify(toOpenAiChunk(streamId, "", null, true))}\n\n`);

      stream.on("text", (delta) => {
        fullText += delta;
        res.write(`data: ${JSON.stringify(toOpenAiChunk(streamId, delta, null, false))}\n\n`);
      });

      await stream.finalMessage();

      res.write(`data: ${JSON.stringify(toOpenAiChunk(streamId, "", "stop", false))}\n\n`);
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
  } catch (err) {
    console.error("voice-llm-proxy: erreur inattendue", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Erreur interne du pont IA" });
    } else {
      res.end();
    }
  }
});
