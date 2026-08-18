import { useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { DebriefResult } from "@prospector/shared-types";
import { requestDebrief, fetchDebrief } from "../../lib/api";
import { colors, radii, spacing, fonts } from "../../lib/theme";

type Status = "generating" | "ready" | "error";

export default function DebriefScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("generating");
  const [debrief, setDebrief] = useState<DebriefResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // requestDebrief déclenche la génération côté serveur (appel Claude, peut prendre jusqu'à
        // une minute sur un appel long) et attend qu'elle soit terminée avant de continuer.
        await requestDebrief(sessionId);
        const data = await fetchDebrief(sessionId);
        if (!cancelled) {
          setDebrief(data);
          setStatus("ready");
        }
      } catch (err) {
        console.error("Échec de récupération du débrief", err);
        if (!cancelled) setStatus("error");
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (status === "generating") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.black} size="large" />
        <Text style={styles.generatingTitle}>Analyse de ton appel en cours...</Text>
        <Text style={styles.muted}>Ça peut prendre jusqu'à une minute selon la durée de l'appel.</Text>
      </View>
    );
  }

  if (status === "error" || !debrief) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Débrief indisponible pour le moment.</Text>
      </View>
    );
  }

  const { overallScore, fond, forme } = debrief;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Score global</Text>
        <Text style={styles.overallScore}>{overallScore}</Text>
        <Text style={styles.scoreOutOf}>/ 100</Text>
      </View>

      <Axis title="Fond" score={fond.score} strengths={fond.strengths} improvements={fond.improvements} />
      <Axis title="Forme" score={forme.score} strengths={forme.strengths} improvements={forme.improvements} />

      <Pressable style={styles.newSessionButton} onPress={() => router.replace("/")}>
        <Text style={styles.newSessionButtonText}>Nouvel entraînement</Text>
      </Pressable>
    </ScrollView>
  );
}

function Axis({
  title,
  score,
  strengths,
  improvements,
}: {
  title: string;
  score: number;
  strengths: string[];
  improvements: { priority: number; text: string }[];
}) {
  return (
    <View style={styles.axisCard}>
      <View style={styles.axisHeader}>
        <Text style={styles.axisTitle}>{title}</Text>
        <View style={styles.axisScorePill}>
          <Text style={styles.axisScoreText}>{score}/100</Text>
        </View>
      </View>

      <Text style={styles.subheading}>Points forts</Text>
      {strengths.map((s, i) => (
        <Text key={i} style={styles.item}>• {s}</Text>
      ))}

      <Text style={styles.subheading}>Axes d'amélioration</Text>
      {improvements
        .sort((a, b) => a.priority - b.priority)
        .map((imp, i) => (
          <Text key={i} style={styles.item}>{imp.priority}. {imp.text}</Text>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.cream, padding: spacing.lg },
  generatingTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.black, marginTop: spacing.sm, textAlign: "center" },
  muted: { fontFamily: fonts.medium, color: colors.textMuted, textAlign: "center" },
  newSessionButton: { backgroundColor: colors.black, padding: 18, borderRadius: radii.pill, alignItems: "center", marginTop: spacing.sm },
  newSessionButtonText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  scoreCard: {
    backgroundColor: colors.purple,
    borderRadius: radii.card,
    padding: spacing.xl,
    alignItems: "center",
  },
  scoreLabel: { fontFamily: fonts.medium, color: colors.white, opacity: 0.85 },
  overallScore: { fontSize: 56, fontFamily: fonts.extraBold, color: colors.white, lineHeight: 62 },
  scoreOutOf: { fontFamily: fonts.medium, color: colors.white, opacity: 0.85 },
  axisCard: { backgroundColor: colors.white, borderRadius: radii.card, padding: spacing.lg, gap: spacing.xs },
  axisHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.xs },
  axisTitle: { fontSize: 18, fontFamily: fonts.extraBold, color: colors.black },
  axisScorePill: { backgroundColor: colors.cream, borderRadius: radii.pill, paddingVertical: 4, paddingHorizontal: 12 },
  axisScoreText: { fontFamily: fonts.bold, color: colors.black },
  subheading: { fontSize: 13, fontFamily: fonts.medium, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.sm },
  item: { fontSize: 15, lineHeight: 22, fontFamily: fonts.regular, color: colors.black },
});
