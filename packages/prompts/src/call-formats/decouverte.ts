export const decouverteFormat = {
  slug: "decouverte" as const,
  label: "Appel de découverte",
  targetDurationSeconds: 180,
  systemPromptFragment: `Format d'appel : DÉCOUVERTE (cible ~3 minutes).

L'objectif du commercial est de qualifier le besoin, pas de closer. Laisse-le poser des questions de
découverte. Si l'appel dépasse largement la durée cible sans qu'aucune question de découverte n'ait été
posée, tu peux naturellement écourter ("il faut que j'y aille, on peut se rappeler ?").`,
};
