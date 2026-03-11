import { Stack } from "expo-router";
import { AuthProvider } from "@/contexts/auth";

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="recipes/[id]/index" />
        <Stack.Screen name="recipes/[id]/edit" />
        <Stack.Screen name="u/[id]" />
      </Stack>
    </AuthProvider>
  );
}
