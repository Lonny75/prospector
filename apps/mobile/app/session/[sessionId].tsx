import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useConversation } from "@elevenlabs/react-native";
import { endTrainingSession, requestDebrief } from "../../lib/api";
import { colors, radii, spacing, fonts } from "../../lib/theme";

// TODO Phase 0 : ID de l'agent ElevenLabs configuré en "Custom LLM" pointant vers
// {API_URL}/voice/llm/chat/completions (voir services/api/src/routes/voice-llm-proxy.ts).
const ELEVENLABS_AGENT_ID = process.env.EXPO_PUBLIC_ELEVENLABS_AGENT_ID ?? "REPLACE_WITH_AGENT_ID";

export default function SessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const [ending, setEnding] = useState(false);

  // TODO Phase 0 (spike) : vérifier dans la doc ElevenLabs à jour comment les dynamicVariables
  // passées ici sont réellement transmises jusqu'au custom LLM (header/metadata) — c'est ce mécanisme
  // qui doit porter le sessionId jusqu'à `x-prospector-session-id` côté voice-llm-proxy.ts.
  const conversation = useConversation({
    onConnect: () => console.log("Appel connecté", sessionId),
    onDisconnect: () => console.log("Appel terminé", sessionId),
    onError: (error: unknown) => console.error("Erreur ElevenLabs", error),
  });

  async function handleStart() {
    await conversation.startSession({
      agentId: ELEVENLABS_AGENT_ID,
      dynamicVariables: { sessionId },
    });
  }

  async function handleEnd() {
    setEnding(true);
    try {
      await conversation.endSession();
      await endTrainingSession(sessionId);
      await requestDebrief(sessionId);
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
        <Pressable style={styles.startButton} onPress={handleStart}>
          <Text style={styles.buttonText}>Démarrer l'appel</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.endButton} onPress={handleEnd} disabled={ending}>
          <Text style={styles.buttonText}>{ending ? "Génération du débrief..." : "Terminer l'appel"}</Text>
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
  endButton: { backgroundColor: colors.red, padding: 20, borderRadius: radii.pill, paddingHorizontal: 36 },
  buttonText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
});
