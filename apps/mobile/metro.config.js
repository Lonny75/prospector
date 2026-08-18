const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// unstable_enablePackageExports activé globalement causait une cascade de "Requiring unknown
// module 'undefined'" (web-streams-polyfill, puis d'autres lazy-getters CJS/ESM plus loin dans
// la chaîne) — un conflit d'ID de module entre les deux modes de résolution de Metro dans ce
// projet, jamais complètement identifié malgré plusieurs contournements. Solution plus fiable :
// laisser Metro résoudre tout le monde à l'ancienne (via "main"), et ne router explicitement que
// les deux imports qui n'ont PAS de "main" et nécessitent vraiment le champ "exports" :
// @elevenlabs/react-native (condition "react-native") et @elevenlabs/client/internal (sous-chemin).
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@elevenlabs/react-native") {
    return {
      filePath: require.resolve("@elevenlabs/react-native/dist/index.react-native.js"),
      type: "sourceFile",
    };
  }
  if (moduleName === "@elevenlabs/client/internal") {
    return {
      filePath: require.resolve("@elevenlabs/client/dist/internal.js"),
      type: "sourceFile",
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
