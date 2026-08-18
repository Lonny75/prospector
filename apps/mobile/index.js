// Doit s'exécuter avant tout le reste : Hermes (moteur JS de RN) n'a pas TextDecoder
// nativement, requis par le protobuf utilisé en interne par livekit-client.
import "@bacons/text-decoder/install";

// dist/index.react-native.js de @elevenlabs/react-native importe @elevenlabs/client/internal
// AVANT d'appeler registerGlobals() lui-même (les imports ES sont évalués avant le reste du
// module) — si ce sous-module a besoin des globals WebRTC dès son propre chargement, c'est
// trop tard. D'où cet appel ici, qui doit s'exécuter avant même l'import d'expo-router/_layout.
import { registerGlobals } from "@livekit/react-native";
registerGlobals();

import "expo-router/entry";
