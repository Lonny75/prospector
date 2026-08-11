import { ScrollView, View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { fetchDebrief } from "../../lib/api";
import { colors, radii, spacing, fonts } from "../../lib/theme";

export default function DebriefScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const debrief = useQuery({ queryKey: ["debrief", sessionId], queryFn: () => fetchDebrief(sessionId) });

  if (debrief.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.black} />
        <Text style={styles.muted}>Génération du débrief...</Text>
      </View>
    );
  }

  if (debrief.error || !debrief.data) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Débrief indisponible pour le moment.</Text>
      </View>
    );
  }

  const { overallScore, fond, forme } = debrief.data;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Score global</Text>
        <Text style={styles.overallScore}>{overallScore}</Text>
        <Text style={styles.scoreOutOf}>/ 100</Text>
      </View>

      <Axis title="Fond" score={fond.score} strengths={fond.strengths} improvements={fond.improvements} />
      <Axis title="Forme" score={forme.score} strengths={forme.strengths} improvements={forme.improvements} />
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
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: colors.cream },
  muted: { fontFamily: fonts.medium, color: colors.textMuted },
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
