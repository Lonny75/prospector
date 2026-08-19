import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useAuth } from "../lib/auth";
import { API_URL } from "../lib/api";
import { colors, radii, spacing, fonts } from "../lib/theme";

export default function LoginScreen() {
  const { login, signup, completeGoogleLogin } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

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

  async function handleGoogleLogin() {
    setError(null);
    setGoogleSubmitting(true);
    try {
      // Le backend fait l'échange de code Google (voir services/api/src/routes/googleAuth.ts) et
      // redirige vers ce schéma personnalisé avec notre propre JWT — openAuthSessionAsync capture
      // cette redirection sans jamais quitter réellement l'app.
      const returnUrl = Linking.createURL("auth-callback");
      const result = await WebBrowser.openAuthSessionAsync(`${API_URL}/auth/google/start`, returnUrl);
      if (result.type !== "success" || !result.url) return;

      const token = new URL(result.url).searchParams.get("token");
      if (!token) {
        setError("La connexion Google a échoué. Réessaie.");
        return;
      }
      await completeGoogleLogin(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "La connexion Google a échoué.");
    } finally {
      setGoogleSubmitting(false);
    }
  }

  const canSubmit = email.trim().length > 0 && password.length >= 8 && (mode === "login" || name.trim().length > 0);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text style={styles.title}>Prospectora</Text>
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

      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>ou</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable style={styles.googleButton} disabled={googleSubmitting} onPress={handleGoogleLogin}>
        {googleSubmitting ? <ActivityIndicator color={colors.black} /> : <Text style={styles.googleText}>Continuer avec Google</Text>}
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
  dividerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.textMuted, opacity: 0.3 },
  dividerText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 13 },
  googleButton: {
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  googleText: { color: colors.black, fontFamily: fonts.bold, fontSize: 16 },
  switchModeText: { color: colors.black, fontFamily: fonts.medium, textAlign: "center", marginTop: spacing.lg },
});
