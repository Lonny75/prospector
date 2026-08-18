import { useCallback } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { ConversationProvider } from "@elevenlabs/react-native";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { colors } from "../lib/theme";
import { LoadingScreen } from "../components/LoadingScreen";

const queryClient = new QueryClient();

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // On masque le splash natif dès le premier frame JS rendu, pour laisser place à LoadingScreen
  // (barre de chargement animée) plutôt que de rester sur l'écran figé natif jusqu'à ce que les
  // polices soient prêtes — l'utilisateur voit ainsi que l'app est bien en train de s'ouvrir.
  const onLayoutRootView = useCallback(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={{ flex: 1 }} onLayout={onLayoutRootView}>
      {fontsLoaded ? (
        <QueryClientProvider client={queryClient}>
          <ConversationProvider>
            <Stack
              screenOptions={{
                headerTitle: "Prospector",
                headerStyle: { backgroundColor: colors.cream },
                headerTitleStyle: { fontFamily: "PlusJakartaSans_700Bold" },
                contentStyle: { backgroundColor: colors.cream },
              }}
            />
          </ConversationProvider>
        </QueryClientProvider>
      ) : (
        <LoadingScreen />
      )}
    </View>
  );
}
