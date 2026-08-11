interface PromptFragmentSource {
  systemPromptFragment: string;
}

/**
 * Compose le prompt système complet envoyé à Claude pour jouer le rôle du prospect.
 * Le persona pose le décor, le niveau d'objection règle la résistance, le format cadre la durée/l'objectif.
 * Cette composition est ce qui est mis en cache (cache_control) côté appel Claude Sonnet, identique sur toute la session.
 */
export function composeProspectSystemPrompt(params: {
  persona: { baseSystemPromptFragment: string };
  objectionLevel: PromptFragmentSource;
  callFormat: PromptFragmentSource;
}): string {
  return [
    params.persona.baseSystemPromptFragment,
    params.objectionLevel.systemPromptFragment,
    params.callFormat.systemPromptFragment,
  ].join("\n\n---\n\n");
}
