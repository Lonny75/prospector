// Doit s'exécuter avant tout le reste : Hermes (moteur JS de RN) n'a pas TextDecoder
// nativement, requis par le protobuf utilisé en interne par livekit-client.
import "@bacons/text-decoder/install";

// NOTE : pas d'appel manuel à registerGlobals() ici — dist/index.react-native.js de
// @elevenlabs/react-native l'appelle déjà lui-même à son propre chargement. Un double appel
// causait "Requiring unknown module 'undefined'" (état interne corrompu côté web-streams-polyfill).

import "expo-router/entry";
