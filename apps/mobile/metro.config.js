const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// require.resolve("pkg/deep/path") respecte lui-même le champ "exports" de Node — il refuse un
// sous-chemin non explicitement listé, même si le fichier existe (et même "./package.json" n'est
// pas exempté ici). On résout plutôt le point d'entrée "." normal du paquet (toujours listé dans
// exports) puis on déduit le dossier dist/ à partir de là pour atteindre le fichier voisin voulu.
function packageDistDir(pkgName) {
  return path.dirname(require.resolve(pkgName));
}

// unstable_enablePackageExports activé globalement causait une cascade de "Requiring unknown
// module 'undefined'" (web-streams-polyfill, puis d'autres lazy-getters CJS/ESM plus loin dans
// la chaîne) — un conflit d'ID de module entre les deux modes de résolution de Metro dans ce
// projet, jamais complètement identifié malgré plusieurs contournements. Solution plus fiable :
// laisser Metro résoudre tout le monde à l'ancienne (via "main"), et ne router explicitement que
// les imports qui n'ont PAS de "main" et nécessitent vraiment le champ "exports" :
// @elevenlabs/react-native (condition "react-native"), @elevenlabs/client et son sous-chemin
// @elevenlabs/client/internal.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@elevenlabs/react-native") {
    return {
      filePath: path.join(packageDistDir("@elevenlabs/react-native"), "index.react-native.js"),
      type: "sourceFile",
    };
  }
  if (moduleName === "@elevenlabs/client/internal") {
    return {
      filePath: path.join(packageDistDir("@elevenlabs/client"), "internal.js"),
      type: "sourceFile",
    };
  }
  if (moduleName === "@elevenlabs/client") {
    return {
      filePath: path.join(packageDistDir("@elevenlabs/client"), "index.js"),
      type: "sourceFile",
    };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
