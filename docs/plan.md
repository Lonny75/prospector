# Prospector — App mobile d'entraînement commercial par IA vocale

## Contexte

Lonny veut lancer un revenu complémentaire via une app B2B : "Prospector" entraîne des commerciaux à la prospection téléphonique via un jeu de rôle vocal en temps réel contre une IA qui joue le prospect (méfiant, pressé, hésitant...). Le cœur de la valeur — et donc du prix — est le débrief post-appel : score, points forts, axes d'amélioration, verbatims précis, sur le fond (découverte, objections, closing) et la forme (ton, débit, écoute, tics de langage).

Décisions déjà actées avec Lonny (à ne pas rouvrir) :
- **App mobile native**, stack **React Native** (il connaît React via [[project-mastering-france]], pas Swift/Kotlin).
- **v1 en voix temps réel** dès le départ, malgré la complexité — c'est un choix assumé après explication des risques.
- Projet créé dans `/Users/lonny/Demo design/Prospector`.
- Modèle économique : abonnement B2B vendu à des managers d'équipe (achat de sièges), pas de vente individuelle dans l'app.

Priorités produit confirmées, dans l'ordre : 1) qualité du débrief (non négociable) 2) réalisme du prospect IA 3) sectorisation 4) gamification (v2 seulement).

## Recommandation d'architecture

### Plateforme voix : ElevenLabs Conversational AI

Vérifié en direct (juillet 2026) : ElevenLabs a le SDK `@elevenlabs/react-native` officiel, pensé pour Expo (dev client + LiveKit/WebRTC), et la meilleure qualité de voix + turn-taking natif du marché (leader sur le réalisme, priorité n°2). Vapi et Retell n'ont pas d'équivalent mobile officiel — il faudrait intégrer `react-native-webrtc` à la main, un risque inutile pour un premier projet mobile. Claude est branché comme "custom LLM" (endpoint compatible OpenAI) : ElevenLabs gère la voix (STT/TTS/latence), Claude gère le raisonnement.

Sources vérifiées : [ElevenLabs pricing](https://elevenlabs.io/pricing/agents), [React Native SDK docs](https://elevenlabs.io/docs/eleven-agents/libraries/react-native), [guide Expo](https://elevenlabs.io/docs/agents-platform/guides/integrations/expo-react-native), [npm @elevenlabs/react-native](https://www.npmjs.com/package/@elevenlabs/react-native).

Contrainte à connaître : nécessite un **Expo dev client (EAS Build)**, pas Expo Go (dépendance native LiveKit/WebRTC).

### Stack technique

| Couche | Choix | Pourquoi |
|---|---|---|
| Mobile | **Expo (managed) + TypeScript + expo-router**, EAS Build (dev client obligatoire) | Minimise la surface natif pour un débutant mobile ; c'est le chemin officiellement supporté par ElevenLabs |
| État | TanStack Query (serveur) + Zustand (local) | Léger, standard |
| Auth mobile | expo-auth-session (OAuth Google PKCE) | Le flow web de Mastering France ne se transpose pas tel quel sur mobile |
| Backend | Node.js + Express, réutilise les patterns de [[project-mastering-france]] | Stack déjà éprouvée par Lonny |
| ORM | **Prisma** (au lieu du SQL brut de Mastering France) | Types TS partagés, itération rapide sur un modèle de données qui va bouger (secteurs/personas/niveaux) |
| DB | PostgreSQL (Railway) | Comme Mastering France |
| IA voix (in-call) | Claude Sonnet 5, streaming, prompt caching sur le prompt système | Latence de tour de parole prioritaire |
| IA débrief | Claude Opus 4.8, async, sortie JSON structurée forcée | Qualité prioritaire, pas de contrainte de latence |
| Paiement | Stripe Checkout sur un **dashboard web manager** (pas d'IAP mobile) | Évite la commission Apple/Google (15-30%) puisque la vente est B2B via managers |
| Déploiement | Railway (backend), Vercel (dashboard web manager), EAS (mobile) | Cohérent avec l'existant |

### Structure de repo (monorepo, npm workspaces)

```
Prospector/
  apps/
    mobile/            Expo — app d'entraînement vocal
    web/               Next.js — dashboard manager (sièges, facturation, suivi équipe)
  services/
    api/
      src/routes/voice-llm-proxy.ts   pont ElevenLabs (BYO-LLM) ↔ Claude Sonnet 5
      src/services/debriefEngine.ts   génération + validation anti-hallucination du débrief
      prisma/schema.prisma
  packages/
    shared-types/      types partagés (Session, Debrief, Persona, Sector...)
    prompts/
      personas/<secteur>.ts
      objection-levels/<niveau>.ts
      call-formats/<format>.ts
```

### Modèle de données (PostgreSQL via Prisma)

`organizations`, `users` (role rep/manager/admin) · `sectors`, `personas` (liés à un secteur + voix ElevenLabs), `objection_levels`, `call_formats` · `training_sessions` (secteur+persona+niveau+format choisis) · `transcripts` (par tour, avec timestamps — clé pour l'analyse de forme) · `debriefs` + `debrief_strengths` + `debrief_improvements` + `debrief_verbatims` (verbatim lié à un `transcript_turn_index` réel, jamais du texte libre) · `usage_events` (minutes voix + tokens Claude, pour calibrer le prix).

### Moteur de débrief — anti-hallucination (le point le plus critique)

1. **Pré-calcul déterministe en code** (pas par le LLM) : débit de parole, blancs >2s, interruptions détectées à partir des timestamps de `transcripts`. Ces chiffres sont injectés comme faits dans le prompt, jamais devinés par Claude.
2. **Sortie JSON strictement structurée** (schéma imposé) via Claude Opus 4.8.
3. **Vérification programmatique de chaque verbatim** après génération : le `transcript_turn_index` cité existe-t-il, le texte cité matche-t-il (fuzzy >90%) le tour réel ? Sinon → 1 retry, puis flag pour revue manuelle. C'est le garde-fou principal.
4. Rubrique de notation **fixe et versionnée** (bandes de score explicites par critère fond/forme), mise en cache Claude — garantit une notation cohérente d'une session à l'autre.
5. Garde-fou optionnel : second appel Claude Haiku 4.5 (quasi gratuit) qui vérifie la cohérence du débrief généré avant affichage.

> **À vérifier en Phase 0** : ElevenLabs expose-t-il bien les timestamps par tour de parole post-appel ? Si les timestamps fins manquent, le débrief FOND reste possible, le FORME se dégrade proprement (moins de métriques débit/blancs/interruptions).

## Feuille de route (du plus risqué au moins critique)

| Phase | Contenu | Durée estimée |
|---|---|---|
| 0 — Spikes | Valider latence ElevenLabs+Claude en conversation réelle + valider le moteur de débrief sur un transcript de test, sans app | 1-2 sem. |
| 1 — Cœur du produit | 1 secteur, 1 persona, pipeline complet mobile→appel→transcript→débrief affiché, auth simple, pas de facturation | 3-4 sem. |
| 2 — Largeur sectorielle | Tous les secteurs, échelle complète débutant→expert, tous les formats d'appel | 3-4 sem. |
| 3 — Abonnement B2B réel | OAuth Google mobile, dashboard manager Stripe (achat de sièges), invitations, tableau de bord équipe | 2-3 sem. |
| 4 — Polish + soumission stores | Gestion coupures d'appel, limites d'usage, EAS Build prod, soumission App Store/Play (mention consentement enregistrement vocal) | 2-3 sem. |
| 5 (v2+) — Gamification | Streaks, badges, courbes de progression — piloté par les données réelles post-lancement, pas construit par anticipation | — |

Ne pas construire la Phase 3 (facturation) avant d'avoir validé la Phase 1-2 avec des bêta-testeurs gratuits.

## Coûts variables estimés (calibrage du prix d'abonnement)

Session 8 min (découverte) : ~$0.64 voix ElevenLabs + ~$0.08-0.10 Claude Sonnet (prospect) + ~$0.05-0.06 Claude Opus (débrief) ≈ **$0.80-0.85 tout compris**. Pour ~20 sessions/mois/utilisateur, coût variable ≈ **$15-17/mois** — un abonnement à $49-79/mois/siège garde une marge brute >65-75%. Recommandation : plafonner l'usage sur les paliers bas tant que les habitudes réelles ne sont pas connues.

## Prérequis de comptes à créer avant la Phase 0

- Compte ElevenLabs (API key + accès Conversational AI)
- Compte Anthropic (ANTHROPIC_API_KEY, déjà utilisé sur Mastering France)
- Compte Expo/EAS
- Compte Railway (backend + Postgres, déjà utilisé)
- Compte Stripe (déjà utilisé)
- Apple Developer Program (99$/an) et Google Play Developer (25$ une fois) — nécessaires avant la Phase 4 (soumission), pas avant

## Vérification

- **Phase 0** : script de test (Postman/CLI) qui simule un tour de conversation via l'endpoint `voice-llm-proxy` et mesure la latence bout-en-bout ; appel direct à `debriefEngine` sur un transcript fictif pour valider le JSON structuré + la vérification anti-hallucination des verbatims.
- **Phase 1** : test manuel de bout en bout — lancer l'app sur un appareil réel via EAS dev client, faire un appel complet avec 1 secteur/persona, vérifier que le débrief affiché est cohérent avec ce qui a été dit.
- Pas de suite de tests automatisés exhaustive attendue avant la Phase 2 (le prompt engineering et le réalisme priment sur la couverture de tests en v1).
