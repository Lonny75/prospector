import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { useRouter, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { fetchSectors, fetchPersonas, fetchObjectionLevels, fetchCallFormats, fetchTestUser, createTrainingSession } from "../lib/api";
import { colors, radii, spacing, fonts } from "../lib/theme";

export default function HomeScreen() {
  const router = useRouter();
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [objectionLevelId, setObjectionLevelId] = useState<string | null>(null);
  const [callFormatId, setCallFormatId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // TODO Phase 3 : remplacer par l'utilisateur authentifié réel (OAuth Google, voir docs/plan.md).
  const testUser = useQuery({ queryKey: ["test-user"], queryFn: fetchTestUser });

  const sectors = useQuery({ queryKey: ["sectors"], queryFn: fetchSectors });
  const personas = useQuery({
    queryKey: ["personas", sectorId],
    queryFn: () => fetchPersonas(sectorId!),
    enabled: !!sectorId,
  });
  const objectionLevels = useQuery({ queryKey: ["objection-levels"], queryFn: fetchObjectionLevels });
  const callFormats = useQuery({ queryKey: ["call-formats"], queryFn: fetchCallFormats });

  const canStart = testUser.data && sectorId && personaId && objectionLevelId && callFormatId;

  async function handleStart() {
    if (!canStart || !testUser.data) return;
    setStarting(true);
    try {
      const session = await createTrainingSession({
        userId: testUser.data.id,
        sectorId: sectorId!,
        personaId: personaId!,
        objectionLevelId: objectionLevelId!,
        callFormatId: callFormatId!,
      });
      router.push(`/session/${session.id}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} style={{ backgroundColor: colors.cream }}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push("/history")} hitSlop={10}>
              <Text style={styles.historyLink}>Historique</Text>
            </Pressable>
          ),
        }}
      />
      <Text style={styles.title}>Nouvel entraînement</Text>

      <Section title="Secteur" loading={sectors.isLoading} error={sectors.isError} onRetry={() => sectors.refetch()}>
        {sectors.data?.map((s) => (
          <Option key={s.id} label={s.label} selected={s.id === sectorId} onPress={() => { setSectorId(s.id); setPersonaId(null); }} />
        ))}
      </Section>

      {sectorId && (
        <Section title="Persona" loading={personas.isLoading} error={personas.isError} onRetry={() => personas.refetch()}>
          {personas.data?.map((p) => (
            <Option key={p.id} label={p.name} selected={p.id === personaId} onPress={() => setPersonaId(p.id)} />
          ))}
        </Section>
      )}

      <Section title="Niveau d'objection" loading={objectionLevels.isLoading} error={objectionLevels.isError} onRetry={() => objectionLevels.refetch()}>
        {objectionLevels.data?.map((o) => (
          <Option key={o.id} label={o.label} selected={o.id === objectionLevelId} onPress={() => setObjectionLevelId(o.id)} />
        ))}
      </Section>

      <Section title="Format d'appel" loading={callFormats.isLoading} error={callFormats.isError} onRetry={() => callFormats.refetch()}>
        {callFormats.data?.map((f) => (
          <Option key={f.id} label={f.label} selected={f.id === callFormatId} onPress={() => setCallFormatId(f.id)} />
        ))}
      </Section>

      {testUser.isError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Impossible de te connecter au serveur. Vérifie ta connexion.</Text>
          <Pressable onPress={() => testUser.refetch()}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={[styles.startButton, !canStart && styles.startButtonDisabled]}
        disabled={!canStart || starting}
        onPress={handleStart}
      >
        {starting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.startButtonText}>Démarrer l'appel</Text>}
      </Pressable>
    </ScrollView>
  );
}

function Section({
  title,
  loading,
  error,
  onRetry,
  children,
}: {
  title: string;
  loading: boolean;
  error?: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {loading ? (
        <ActivityIndicator color={colors.black} />
      ) : error ? (
        <View style={styles.sectionError}>
          <Text style={styles.errorText}>Échec du chargement.</Text>
          <Pressable onPress={onRetry}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.optionsRow}>{children}</View>
      )}
    </View>
  );
}

function Option({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.option, selected && styles.optionSelected]} onPress={onPress}>
      <Text style={selected ? styles.optionTextSelected : styles.optionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  title: { fontSize: 24, fontFamily: fonts.extraBold, color: colors.black },
  historyLink: { color: colors.black, fontFamily: fonts.bold, fontSize: 15 },
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: 13, fontFamily: fonts.medium, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  option: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
  },
  optionSelected: { backgroundColor: colors.purple },
  optionText: { color: colors.black, fontFamily: fonts.medium },
  optionTextSelected: { color: colors.white, fontFamily: fonts.bold },
  sectionError: { gap: spacing.xs },
  errorBanner: { backgroundColor: colors.white, borderRadius: radii.card, padding: spacing.md, gap: spacing.xs, borderWidth: 1, borderColor: colors.red },
  errorText: { fontFamily: fonts.medium, color: colors.red },
  retryText: { fontFamily: fonts.bold, color: colors.black },
  startButton: {
    marginTop: spacing.md,
    backgroundColor: colors.black,
    padding: 18,
    borderRadius: radii.pill,
    alignItems: "center",
  },
  startButtonDisabled: { opacity: 0.35 },
  startButtonText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
});
