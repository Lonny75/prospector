import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, PermissionsAndroid, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConversation } from "@elevenlabs/react-native";
import { endTrainingSession, fetchTrainingSession, warmTrainingSession } from "../../lib/api";
import { colors, radii, spacing, fonts } from "../../lib/theme";

// TODO Phase 0 : ID de l'agent ElevenLabs configuré en "Custom LLM" pointant vers
// {API_URL}/voice/llm/chat/completions (voir services/api/src/routes/voice-llm-proxy.ts).
const ELEVENLABS_AGENT_ID = process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_ID ?? "REPLACE_WITH_AGENT_ID";

// Coupe-circuit coût : un appel oublié ouvert facture des minutes ElevenLabs + tokens Claude en
// continu. 20 minutes est largement au-dessus du format le plus long (closing, 15 min cible).
const MAX_CALL_DURATION_MS = 20 * 60 * 1000;

export default function SessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const [ending, setEnding] = useState(false);
  const [starting, setStarting] = useState(false);
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);
  const autoEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // La voix du persona n'est pas fixée sur l'agent ElevenLabs (un seul agent pour tous les
  // personas) — on la récupère ici et on la passe en override à chaque appel (permission
  // "voice_id override" activée côté agent, voir docs/plan.md).
  function loadPersonaVoice() {
    setLoadError(false);
    fetchTrainingSession(sessionId)
      .then((session) => setVoiceId(session.persona.elevenlabsVoiceId))
      .catch((err) => {
        console.error("Échec de chargement du persona", err);
        setLoadError(true);
      });
  }

  useEffect(() => {
    loadPersonaVoice();
    return () => {
      if (autoEndTimer.current) clearTimeout(autoEndTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Appel connecté", sessionId);
      setCallError(null);
      autoEndTimer.current = setTimeout(() => {
        console.warn("Durée maximale d'appel atteinte, fin automatique");
        handleEnd();
      }, MAX_CALL_DURATION_MS);
    },
    onDisconnect: () => {
      console.log("Appel terminé", sessionId);
      if (autoEndTimer.current) clearTimeout(autoEndTimer.current);
    },
    onError: (error: unknown) => {
      console.error("Erreur ElevenLabs", error);
      setCallError("La connexion à l'appel a échoué. Vérifie ta connexion et réessaie.");
    },
  });

  async function handleStart() {
    setCallError(null);
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        setCallError("Le micro est nécessaire pour démarrer l'appel — autorise l'accès dans les réglages du téléphone.");
        return;
      }
    }
    setStarting(true);
    try {
      // Réchauffe le cache de prompt Claude pour CETTE tentative précise — celui fait à la création
      // de session ne suffit pas si on retente l'appel ici après un échec, ou si on a attendu avant
      // de démarrer : le cache éphémère Claude a une durée de vie courte (voir promptCache.ts).
      await warmTrainingSession(sessionId).catch((err) => console.error("Échec du préchauffage", err));
      await conversation.startSession({
        agentId: ELEVENLABS_AGENT_ID,
        // TODO : agent.firstMessage ("Allô ?" pour que le persona parle en premier) désactivé
        // temporairement le 2026-08-19 — dès son ajout, tous les appels ont échoué côté ElevenLabs
        // avec "Server error: Unknown error" générique, alors que le pont voix->Claude répond
        // correctement en direct (testé hors ElevenLabs). À réinvestiguer séparément.
        overrides: voiceId ? { tts: { voiceId } } : undefined,
        // Le seul mécanisme fiable trouvé pour faire parvenir le sessionId jusqu'au custom LLM :
        // customLlmExtraBody s'injecte directement dans le corps envoyé à voice-llm-proxy.ts (pas via
        // le templating {{}} des request_headers, qui ne fonctionne jamais dans cette intégration —
        // voir les notes en tête de voice-llm-proxy.ts).
        customLlmExtraBody: { sessionId },
      });
    } catch (err) {
      console.error("Échec du démarrage de l'appel", err);
      setCallError("Impossible de démarrer l'appel. Réessaie dans quelques instants.");
    } finally {
      setStarting(false);
    }
  }

  async function handleEnd() {
    setEnding(true);
    if (autoEndTimer.current) clearTimeout(autoEndTimer.current);
    try {
      await conversation.endSession();
      await endTrainingSession(sessionId);
      // La génération du débrief (appel à Claude) peut prendre jusqu'à une minute sur un appel
      // long — on ne fait pas attendre l'utilisateur ici, l'écran de débrief prend le relais et
      // affiche clairement que l'analyse est en cours.
      router.replace(`/debrief/${sessionId}`);
    } catch (err) {
      console.error("Échec de la fin de session", err);
      setCallError("L'appel s'est terminé mais une erreur est survenue. Le débrief pourrait être indisponible.");
      setEnding(false);
    }
  }

  const isConnected = conversation.status === "connected";

  return (
    <View style={styles.container}>
      <View style={styles.statusCard}>
        <View style={[styles.pulseDot, isConnected && styles.pulseDotActive]} />
        <Text style={styles.status}>
          {isConnected ? (conversation.isSpeaking ? "Le prospect parle..." : "À vous de parler") : "Prêt à démarrer"}
        </Text>
      </View>

      {callError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{callError}</Text>
        </View>
      )}

      {loadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Impossible de charger cet entraînement.</Text>
          <Pressable onPress={loadPersonaVoice}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : !isConnected ? (
        <Pressable
          style={[styles.startButton, (!voiceId || starting) && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={!voiceId || starting}
        >
          <Text style={styles.buttonText}>{!voiceId ? "Chargement..." : starting ? "Préparation..." : "Démarrer l'appel"}</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.endButton} onPress={handleEnd} disabled={ending}>
          <Text style={styles.buttonText}>{ending ? "Fin de l'appel..." : "Terminer l'appel"}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xl, padding: spacing.lg, backgroundColor: colors.cream },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
  },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.textMuted },
  pulseDotActive: { backgroundColor: colors.purple },
  status: { fontSize: 16, fontFamily: fonts.bold, color: colors.black },
  errorBanner: { backgroundColor: colors.white, borderRadius: radii.card, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.red, maxWidth: 320 },
  errorText: { fontFamily: fonts.medium, color: colors.red, textAlign: "center" },
  retryText: { fontFamily: fonts.bold, color: colors.black, textAlign: "center", marginTop: spacing.xs },
  startButton: { backgroundColor: colors.black, padding: 20, borderRadius: radii.pill, paddingHorizontal: 36 },
  startButtonDisabled: { opacity: 0.35 },
  endButton: { backgroundColor: colors.red, padding: 20, borderRadius: radii.pill, paddingHorizontal: 36 },
  buttonText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
});
