# Prospector — mobile (Expo)

## Design

Police et palette tirées de `Prospector/Images/idée de visuel app prospector *.webp` (slide "BRANDING") :
**Plus Jakarta Sans** (Google Font, chargée via `@expo-google-fonts/plus-jakarta-sans`), et la palette
`#B48DE6` (violet, sélection/accent), `#F24646` (rouge, action de fin d'appel), `#232323` (noir, CTA
principal), `#EEEDEA` (crème, fond d'écran), `#FFFFFF` (blanc, cartes) — centralisée dans `lib/theme.ts`.

## Point important : Expo Go ne fonctionnera PAS

`@elevenlabs/react-native` embarque du code natif (LiveKit/WebRTC), donc l'app doit tourner via un
**dev client EAS**, pas l'app Expo Go du store. Voir docs/plan.md à la racine du projet.

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform ios      # ou android
```

Une fois le dev client installé sur ton téléphone/simulateur :

```bash
cp .env.example .env
# renseigner EXPO_PUBLIC_ELEVENLABS_AGENT_ID une fois l'agent créé côté dashboard ElevenLabs
npm run start
```

## À vérifier en Phase 0 (avant de coder plus loin sur cet écran)

- Le nom exact des plugins Expo requis par `@elevenlabs/react-native`/LiveKit dans `app.json` — j'ai mis
  des noms plausibles (`@livekit/react-native-webrtc`, `@config-plugins/react-native-webrtc`) d'après la
  doc consultée en juillet 2026, mais à confirmer contre le guide officiel avant le premier build EAS :
  https://elevenlabs.io/docs/agents-platform/guides/integrations/expo-react-native
- La forme exacte du hook `useConversation` (props de `startSession`, notamment comment `dynamicVariables`
  est réellement acheminé jusqu'au custom LLM côté backend) — l'API bouge vite, à valider contre la doc
  au moment de coder ce spike, pas à supposer figée.
- Configuration de l'agent ElevenLabs en mode "Custom LLM" pointant vers
  `{API_URL}/voice/llm/chat/completions` — à faire manuellement dans leur dashboard, pas dans ce repo.
