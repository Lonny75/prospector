import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
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
    <View style={styles.container}>
      <Text style={styles.title}>Nouvel entraînement</Text>

      <Section title="Secteur" loading={sectors.isLoading}>
        {sectors.data?.map((s) => (
          <Option key={s.id} label={s.label} selected={s.id === sectorId} onPress={() => { setSectorId(s.id); setPersonaId(null); }} />
        ))}
      </Section>

      {sectorId && (
        <Section title="Persona" loading={personas.isLoading}>
          {personas.data?.map((p) => (
            <Option key={p.id} label={p.name} selected={p.id === personaId} onPress={() => setPersonaId(p.id)} />
          ))}
        </Section>
      )}

      <Section title="Niveau d'objection" loading={objectionLevels.isLoading}>
        {objectionLevels.data?.map((o) => (
          <Option key={o.id} label={o.label} selected={o.id === objectionLevelId} onPress={() => setObjectionLevelId(o.id)} />
        ))}
      </Section>

      <Section title="Format d'appel" loading={callFormats.isLoading}>
        {callFormats.data?.map((f) => (
          <Option key={f.id} label={f.label} selected={f.id === callFormatId} onPress={() => setCallFormatId(f.id)} />
        ))}
      </Section>

      <Pressable
        style={[styles.startButton, !canStart && styles.startButtonDisabled]}
        disabled={!canStart || starting}
        onPress={handleStart}
      >
        {starting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.startButtonText}>Démarrer l'appel</Text>}
      </Pressable>
    </View>
  );
}

function Section({ title, loading, children }: { title: string; loading: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {loading ? <ActivityIndicator color={colors.black} /> : <View style={styles.optionsRow}>{children}</View>}
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
  container: { flex: 1, padding: spacing.lg, gap: spacing.lg, backgroundColor: colors.cream },
  title: { fontSize: 24, fontFamily: fonts.extraBold, color: colors.black },
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
  startButton: {
    marginTop: "auto",
    backgroundColor: colors.black,
    padding: 18,
    borderRadius: radii.pill,
    alignItems: "center",
  },
  startButtonDisabled: { opacity: 0.35 },
  startButtonText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
});
