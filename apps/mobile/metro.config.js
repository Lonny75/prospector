const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// @elevenlabs/react-native (et ses dépendances, dont @elevenlabs/client qui a des sous-chemins
// comme "./internal" uniquement résolvables via "exports") utilisent le champ "exports" plutôt
// qu'un "main" classique — nécessite d'activer unstable_enablePackageExports.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["react-native", "browser", "require", "import"];

// Mais activer ça globalement casse la résolution de web-streams-polyfill (dépendance interne de
// @livekit/react-native/registerGlobals) — "Requiring unknown module 'undefined'" au runtime,
// vraisemblablement un conflit d'ID de module entre les deux modes de résolution. On la force donc
// explicitement vers son point d'entrée classique, en bypassant la logique "exports" seulement pour
// ce paquet précis.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "web-streams-polyfill") {
    return {
      filePath: require.resolve("web-streams-polyfill/dist/ponyfill.js"),
      type: "sourceFile",
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
