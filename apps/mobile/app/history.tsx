import { FlatList, View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import type { SessionHistoryItem } from "@prospector/shared-types";
import { fetchTestUser, fetchSessionHistory } from "../lib/api";
import { colors, radii, spacing, fonts } from "../lib/theme";

export default function HistoryScreen() {
  const router = useRouter();
  const testUser = useQuery({ queryKey: ["test-user"], queryFn: fetchTestUser });
  const history = useQuery({
    queryKey: ["session-history", testUser.data?.id],
    queryFn: () => fetchSessionHistory(testUser.data!.id),
    enabled: !!testUser.data,
  });

  if (testUser.isLoading || history.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.black} />
      </View>
    );
  }

  if (history.error) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Impossible de charger l'historique.</Text>
      </View>
    );
  }

  const sessions = history.data ?? [];

  if (sessions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Aucun entraînement pour l'instant.</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      style={{ backgroundColor: colors.cream }}
      data={sessions}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <HistoryRow item={item} onPress={() => router.push(`/debrief/${item.id}`)} />}
    />
  );
}

function HistoryRow({ item, onPress }: { item: SessionHistoryItem; onPress: () => void }) {
  const date = new Date(item.startedAt);
  const dateLabel = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const hasScore = item.overallScore !== null;

  return (
    <Pressable style={styles.row} onPress={onPress} disabled={!hasScore}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle}>{item.sectorLabel}</Text>
        <Text style={styles.rowSubtitle}>
          {item.personaName.split(",")[0]} · {item.objectionLevelLabel} · {item.callFormatLabel}
        </Text>
        <Text style={styles.rowDate}>{dateLabel}</Text>
      </View>
      {hasScore ? (
        <View style={styles.scorePill}>
          <Text style={styles.scoreText}>{item.overallScore}</Text>
        </View>
      ) : (
        <Text style={styles.pendingText}>en cours</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.cream, padding: spacing.lg },
  muted: { fontFamily: fonts.medium, color: colors.textMuted, textAlign: "center" },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    padding: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  rowInfo: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.black },
  rowSubtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
  rowDate: { fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  scorePill: { backgroundColor: colors.purple, borderRadius: radii.pill, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  scoreText: { fontFamily: fonts.extraBold, color: colors.white, fontSize: 15 },
  pendingText: { fontFamily: fonts.medium, color: colors.textMuted, fontSize: 12 },
});
