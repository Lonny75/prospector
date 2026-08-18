import { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";
import { colors, radii, spacing } from "../lib/theme";

const BAR_WIDTH = 160;
const KNOB_WIDTH = 64;

/**
 * Écran affiché entre le splash natif (masqué dès le premier layout, voir _layout.tsx) et le
 * moment où les polices sont prêtes. La progression est indéterminée (pas de vraie mesure
 * d'avancement disponible côté RN pour useFonts) — l'animation en boucle sert de repère visuel
 * pour que l'utilisateur sache que l'app est en train de s'ouvrir, pas figée.
 */
export function LoadingScreen() {
  const translateX = useRef(new Animated.Value(-KNOB_WIDTH)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: BAR_WIDTH,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -KNOB_WIDTH,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [translateX]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Prospector</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.knob, { transform: [{ translateX }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, backgroundColor: colors.cream },
  title: { fontSize: 24, fontWeight: "800", color: colors.black },
  track: { width: BAR_WIDTH, height: 6, borderRadius: radii.pill, backgroundColor: colors.white, overflow: "hidden" },
  knob: { width: KNOB_WIDTH, height: 6, borderRadius: radii.pill, backgroundColor: colors.purple },
});
