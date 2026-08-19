import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useAuth } from "../lib/auth";
import { colors, radii, spacing, fonts } from "../lib/theme";

export default function LoginScreen() {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password);
      } else {
        await signup(email.trim(), name.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length >= 8 && (mode === "login" || name.trim().length > 0);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Prospector</Text>
      <Text style={styles.subtitle}>{mode === "login" ? "Connecte-toi pour continuer" : "Crée ton compte"}</Text>

      {mode === "signup" && (
        <TextInput
          style={styles.input}
          placeholder="Nom"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      )}
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe (8 caractères min.)"
        placeholderTextColor={colors.textMuted}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]} disabled={!canSubmit || submitting} onPress={handleSubmit}>
        {submitting ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>{mode === "login" ? "Se connecter" : "Créer mon compte"}</Text>}
      </Pressable>

      <Pressable
        onPress={() => {
          setError(null);
          setMode(mode === "login" ? "signup" : "login");
        }}
      >
        <Text style={styles.switchModeText}>
          {mode === "login" ? "Pas encore de compte ? Inscris-toi" : "Déjà un compte ? Connecte-toi"}
        </Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.cream },
  title: { fontSize: 28, fontFamily: fonts.extraBold, color: colors.black, textAlign: "center", marginBottom: spacing.xs },
  subtitle: { fontSize: 15, fontFamily: fonts.medium, color: colors.textMuted, textAlign: "center", marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.white,
    borderRadius: radii.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.black,
  },
  error: { color: colors.red, fontFamily: fonts.medium, textAlign: "center", marginTop: spacing.xs },
  submitButton: {
    backgroundColor: colors.black,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  submitButtonDisabled: { opacity: 0.35 },
  submitText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  switchModeText: { color: colors.black, fontFamily: fonts.medium, textAlign: "center", marginTop: spacing.lg },
});
