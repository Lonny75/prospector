import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, PermissionsAndroid, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConversation } from "@elevenlabs/react-native";
import { endTrainingSession, fetchTrainingSession } from "../../lib/api";
import { colors, radii, spacing, fonts } from "../../lib/theme";

// TODO Phase 0 : ID de l'agent ElevenLabs configuré en "Custom LLM" pointant vers
// {API_URL}/voice/llm/chat/completions (voir services/api/src/routes/voice-llm-proxy.ts).
const ELEVENLABS_AGENT_ID = process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_ID ?? "REPLACE_WITH_AGENT_ID";

export default function SessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const [ending, setEnding] = useState(false);
  const [voiceId, setVoiceId] = useState<string | null>(null);

  // La voix du persona n'est pas fixée sur l'agent ElevenLabs (un seul agent pour tous les
  // personas) — on la récupère ici et on la passe en override à chaque appel (permission
  // "voice_id override" activée côté agent, voir docs/plan.md).
  useEffect(() => {
    fetchTrainingSession(sessionId)
      .then((session) => setVoiceId(session.persona.elevenlabsVoiceId))
      .catch((err) => console.error("Échec de chargement du persona", err));
  }, [sessionId]);

  // Le préfixe "secret__" est requis pour que la variable soit interpolée dans les request_headers
  // du custom LLM (confirmé empiriquement via apps/voice-test — une dynamicVariable normale, sans ce
  // préfixe, arrive côté backend comme le texte littéral "{{sessionId}}", non substitué).
  const conversation = useConversation({
    onConnect: () => console.log("Appel connecté", sessionId),
    onDisconnect: () => console.log("Appel terminé", sessionId),
    onError: (error: unknown) => console.error("Erreur ElevenLabs", error),
  });

  async function handleStart() {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.error("Permission micro refusée");
        return;
      }
    }
    await conversation.startSession({
      agentId: ELEVENLABS_AGENT_ID,
      overrides: voiceId ? { tts: { voiceId } } : undefined,
      // Le seul mécanisme fiable trouvé pour faire parvenir le sessionId jusqu'au custom LLM :
      // customLlmExtraBody s'injecte directement dans le corps envoyé à voice-llm-proxy.ts (pas via
      // le templating {{}} des request_headers, qui ne fonctionne jamais dans cette intégration —
      // voir les notes en tête de voice-llm-proxy.ts).
      customLlmExtraBody: { sessionId },
    });
  }

  async function handleEnd() {
    setEnding(true);
    try {
      await conversation.endSession();
      await endTrainingSession(sessionId);
      // La génération du débrief (appel à Claude) peut prendre jusqu'à une minute sur un appel
      // long — on ne fait pas attendre l'utilisateur ici, l'écran de débrief prend le relais et
      // affiche clairement que l'analyse est en cours.
      router.replace(`/debrief/${sessionId}`);
    } finally {
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

      {!isConnected ? (
        <Pressable style={[styles.startButton, !voiceId && styles.startButtonDisabled]} onPress={handleStart} disabled={!voiceId}>
          <Text style={styles.buttonText}>{voiceId ? "Démarrer l'appel" : "Chargement..."}</Text>
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
  startButton: { backgroundColor: colors.black, padding: 20, borderRadius: radii.pill, paddingHorizontal: 36 },
  startButtonDisabled: { opacity: 0.35 },
  endButton: { backgroundColor: colors.red, padding: 20, borderRadius: radii.pill, paddingHorizontal: 36 },
  buttonText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
});
