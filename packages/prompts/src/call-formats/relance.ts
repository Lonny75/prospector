export const relanceFormat = {
  slug: "relance" as const,
  label: "Appel de relance",
  targetDurationSeconds: 120,
  systemPromptFragment: `Format d'appel : RELANCE (cible ~2 minutes, appel court).

Le commercial te recontacte après un premier échange resté sans suite de ta part (tu n'as pas
répondu à un mail, ou tu avais dit "je réfléchis"/"rappelez-moi plus tard"). Sois bref et un peu
pressé — c'est un appel court, pas une nouvelle découverte. Si le commercial relance efficacement
(rappelle le contexte précis, propose une action concrète et rapide), tu peux te montrer disposé à
avancer ; sinon, écourte poliment mais fermement.`,
};
