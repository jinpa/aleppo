import { Stack } from "expo-router";
import { AuthProvider } from "@/contexts/auth";
import { KeyboardProvider } from "react-native-keyboard-controller";

export default function RootLayout() {
  return (
    <KeyboardProvider>
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="recipes/[id]/index" />
        <Stack.Screen name="recipes/[id]/edit" />
        <Stack.Screen name="u/[id]" />
      </Stack>
    </AuthProvider>
    </KeyboardProvider>
  );
}
