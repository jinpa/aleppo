// Set EXPO_PUBLIC_API_URL in .env.local for a non-default backend URL.
// On a physical device replace localhost with your machine's local IP.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
