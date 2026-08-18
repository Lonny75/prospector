const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const config = getDefaultConfig(__dirname);

// Les paquets @elevenlabs/* (client, react, react-native) n'ont pas de champ "main" classique,
// seulement "exports" — et ça en cascade : chaque sous-module qu'ils importent entre eux
// (@elevenlabs/client, @elevenlabs/client/internal, @elevenlabs/react, ...) posait le même
// problème un par un. Plutôt que de lister chaque cas à la main, on lit et interprète leur champ
// "exports" nous-mêmes pour n'importe quel sous-chemin de ces paquets.
//
// (L'activation globale de unstable_enablePackageExports avait été tentée en premier, mais
// causait une cascade différente de "Requiring unknown module 'undefined'" sur des paquets tiers
// comme web-streams-polyfill — un conflit d'ID de module jamais élucidé. Cette résolution manuelle,
// ciblée uniquement sur les paquets qui en ont réellement besoin, est plus prévisible.)
function findPackageRoot(pkgName) {
  // require.resolve(pkgName) suit la condition "default"/"require" du champ exports (toujours
  // présente en pratique) — on remonte ensuite les dossiers jusqu'à trouver le package.json dont
  // le "name" correspond, plutôt que de supposer une profondeur fixe.
  let dir = path.dirname(require.resolve(pkgName));
  for (let i = 0; i < 5; i++) {
    const candidate = path.join(dir, "package.json");
    if (fs.existsSync(candidate)) {
      const json = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (json.name === pkgName) return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

function resolveElevenLabsExport(moduleName) {
  const slashIndex = moduleName.indexOf("/", "@elevenlabs/".length);
  const pkgName = slashIndex === -1 ? moduleName : moduleName.slice(0, slashIndex);
  const subpath = slashIndex === -1 ? "." : `.${moduleName.slice(slashIndex)}`;

  const pkgRoot = findPackageRoot(pkgName);
  if (!pkgRoot) return null;

  const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgRoot, "package.json"), "utf8"));
  const exportsMap = pkgJson.exports;
  if (!exportsMap || !exportsMap[subpath]) return null;

  const entry = exportsMap[subpath];
  const target =
    typeof entry === "string"
      ? entry
      : entry["react-native"] || entry.default || entry.browser || entry.require || entry.import;
  if (!target) return null;

  return path.join(pkgRoot, target);
}

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@elevenlabs/")) {
    const resolved = resolveElevenLabsExport(moduleName);
    if (resolved && fs.existsSync(resolved)) {
      return { filePath: resolved, type: "sourceFile" };
    }
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
