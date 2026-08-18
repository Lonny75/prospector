// Doit s'exécuter avant tout le reste : Hermes (moteur JS de RN) n'a pas TextDecoder
// nativement, requis par le protobuf utilisé en interne par livekit-client.
import "@bacons/text-decoder/install";

// @livekit/react-native (dépendance de @elevenlabs/react-native) a besoin de ses polyfills
// WebRTC globaux enregistrés avant que quoi que ce soit d'autre ne soit importé, sinon ça
// plante au chargement du module ("Cannot read property 'includes' of undefined").
import { registerGlobals } from "@livekit/react-native";
registerGlobals();

import "expo-router/entry";
