import { prisma } from "../config/db.js";
import { anthropic, CLAUDE_PROSPECT_MODEL } from "../config/anthropic.js";
import { composeProspectSystemPrompt } from "@prospector/prompts";

/**
 * Préchauffe le cache de prompt éphémère d'Anthropic pour la combinaison persona/niveau
 * d'objection/format de cette session, en tâche de fond dès sa création.
 *
 * Sans ça, la toute première utilisation d'une combinaison (ex: un secteur/niveau/format ajouté
 * récemment, jamais rejoué depuis) coûte jusqu'à ~11s avant le premier token — largement au-delà
 * de ce qu'un appel vocal temps réel tolère, ce qui fait planter la conversation côté ElevenLabs
 * ("Server error: Unknown error", observé le 2026-08-19). Un appel déjà en cache répond en ~1-3s.
 * Le cache éphémère expire après quelques minutes ; ce préchauffage vise la fenêtre entre la
 * création de la session et le premier vrai tour de parole (permission micro, connexion à l'agent).
 */
export async function warmSystemPromptCache(sessionId: string): Promise<void> {
  const session = await prisma.trainingSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { persona: true, objectionLevel: true, callFormat: true },
  });

  const systemPrompt = composeProspectSystemPrompt({
    persona: session.persona,
    objectionLevel: session.objectionLevel,
    callFormat: session.callFormat,
  });

  await anthropic.messages.create({
    model: CLAUDE_PROSPECT_MODEL,
    max_tokens: 1,
    system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: "." }],
  });
}
