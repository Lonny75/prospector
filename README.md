# Prospector

App mobile qui entraîne les commerciaux à la prospection via un jeu de rôle vocal en temps réel contre une IA jouant le prospect (secteur, persona et niveau d'objection personnalisables), avec un débrief structuré (fond + forme) comme cœur de valeur.

Plan d'architecture complet : voir `docs/plan.md` (copie du plan validé).

## Stack

| Couche | Techno |
|--------|--------|
| Mobile | Expo (managed) + TypeScript + expo-router, EAS Build (dev client) |
| Voix IA | ElevenLabs Conversational AI (`@elevenlabs/react-native`, BYO-LLM) |
| IA prospect (in-call) | Claude Sonnet 5 |
| IA débrief | Claude Opus 4.8 |
| Backend | Node.js + Express + Prisma |
| Base de données | PostgreSQL (Railway) |
| Dashboard manager | Next.js (Vercel) |
| Paiements | Stripe Checkout (achat de sièges, côté dashboard web — pas d'IAP mobile) |

## Structure du monorepo

```
apps/
  mobile/     Expo — app d'entraînement vocal
  web/        Next.js — dashboard manager (sièges, facturation, suivi équipe)
services/
  api/        Backend Express + Prisma
    src/routes/voice-llm-proxy.ts   pont ElevenLabs (BYO-LLM) ↔ Claude Sonnet 5
    src/services/debriefEngine.ts   génération + validation anti-hallucination du débrief
    prisma/schema.prisma
packages/
  shared-types/   types TS partagés (Session, Debrief, Persona, Sector...)
  prompts/        composition des prompts système (personas, niveaux d'objection, formats d'appel)
```

## Prérequis avant de pouvoir tester (Phase 0)

Comptes/clés à créer :

- **ElevenLabs** — API key + accès Conversational AI (agent créé avec BYO-LLM pointant vers l'API Prospector)
- **Anthropic** — `ANTHROPIC_API_KEY`
- **Expo/EAS** — compte pour builder le dev client (obligatoire, `@elevenlabs/react-native` ne fonctionne pas avec Expo Go)
- **Railway** — backend + PostgreSQL
- **Stripe** — clé secrète + webhook (à partir de la Phase 3 seulement)
- **Apple Developer Program** (99$/an) et **Google Play Developer** (25$ unique) — nécessaires à partir de la Phase 4 (soumission), pas avant

Voir `services/api/.env.example` pour la liste complète des variables.

## Installation locale

```bash
npm install                                  # installe tous les workspaces
cd services/api && cp .env.example .env      # renseigner les clés
npm run dev:api                              # démarre le backend sur http://localhost:3001
```

L'app mobile (`apps/mobile`) nécessite un build EAS dev client avant de pouvoir tester la voix — voir Phase 1 de la feuille de route.

## Feuille de route

Voir le plan complet pour le détail des phases. Résumé :

0. Spikes (latence voix + moteur de débrief) — sans app
1. Cœur du produit : 1 secteur, 1 persona, pipeline complet
2. Largeur sectorielle + progression des niveaux d'objection
3. Abonnement B2B réel (dashboard manager, sièges)
4. Polish + soumission stores
5. Gamification (v2+)
