const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// @elevenlabs/react-native (et ses dépendances) utilisent le champ "exports" avec des conditions
// "browser"/"react-native"/"default" plutôt qu'un champ "main" classique — Metro a besoin d'être
// dit explicitement de prioriser la condition "react-native", sinon la résolution échoue.
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionNames = ["react-native", "browser", "require", "import"];

module.exports = config;
