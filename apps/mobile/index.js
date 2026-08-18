// Doit s'exécuter avant tout le reste : Hermes (moteur JS de RN) n'a pas TextDecoder
// nativement, requis par le protobuf utilisé en interne par livekit-client.
import "@bacons/text-decoder/install";

// Pré-remplir nous-mêmes les globals WebStreams AVANT d'appeler registerGlobals() : sa propre
// tentative de les requérir via "web-streams-polyfill" échoue sous Metro dans ce projet
// ("Requiring unknown module 'undefined'"). Isolé précisément : le problème vient du mécanisme
// d'interop paresseux que Babel applique aux imports ESM (accès différé via getter, qui re-déclenche
// un require au moment de la lecture de la propriété — et CE require-là échoue). Un require() CJS
// direct n'a pas ce problème, contrairement à `import { X } from "..."`.
const webStreamsPolyfill = require("web-streams-polyfill");
if (typeof global.ReadableStream === "undefined") global.ReadableStream = webStreamsPolyfill.ReadableStream;
if (typeof global.WritableStream === "undefined") global.WritableStream = webStreamsPolyfill.WritableStream;
if (typeof global.TransformStream === "undefined") global.TransformStream = webStreamsPolyfill.TransformStream;
if (typeof global.CountQueuingStrategy === "undefined") global.CountQueuingStrategy = webStreamsPolyfill.CountQueuingStrategy;

// dist/index.react-native.js de @elevenlabs/react-native importe @elevenlabs/client/internal
// AVANT d'appeler registerGlobals() lui-même (les imports ES sont évalués avant le reste du
// module) — si ce sous-module a besoin des globals WebRTC dès son propre chargement, c'est
// trop tard. D'où cet appel ici, qui doit s'exécuter avant même l'import d'expo-router/_layout.
import { registerGlobals } from "@livekit/react-native";
registerGlobals();

import "expo-router/entry";
