// Doit s'exécuter avant tout le reste : Hermes (moteur JS de RN) n'a pas TextDecoder
// nativement, requis par le protobuf utilisé en interne par livekit-client.
import "@bacons/text-decoder/install";

// Pré-remplir nous-mêmes les globals WebStreams AVANT d'appeler registerGlobals() : sa propre
// tentative de les requérir via "web-streams-polyfill" échoue sous Metro dans ce projet
// ("Requiring unknown module 'undefined'", cause exacte non résolue malgré plusieurs essais de
// contournement côté resolver). En les définissant nous-mêmes en amont, son code interne
// (shimWebstreams) les trouve déjà présents et ne tente jamais ce require cassé.
import { ReadableStream, WritableStream, TransformStream, CountQueuingStrategy } from "web-streams-polyfill";
if (typeof global.ReadableStream === "undefined") global.ReadableStream = ReadableStream;
if (typeof global.WritableStream === "undefined") global.WritableStream = WritableStream;
if (typeof global.TransformStream === "undefined") global.TransformStream = TransformStream;
if (typeof global.CountQueuingStrategy === "undefined") global.CountQueuingStrategy = CountQueuingStrategy;

// dist/index.react-native.js de @elevenlabs/react-native importe @elevenlabs/client/internal
// AVANT d'appeler registerGlobals() lui-même (les imports ES sont évalués avant le reste du
// module) — si ce sous-module a besoin des globals WebRTC dès son propre chargement, c'est
// trop tard. D'où cet appel ici, qui doit s'exécuter avant même l'import d'expo-router/_layout.
import { registerGlobals } from "@livekit/react-native";
registerGlobals();

import "expo-router/entry";
