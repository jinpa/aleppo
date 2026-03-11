import { createContext, useContext, useState, useEffect } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";

// SecureStore is not available on web — fall back to localStorage.
const storage = {
  async get(key: string) {
    if (Platform.OS === "web") return localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string) {
    if (Platform.OS === "web") { localStorage.setItem(key, value); return; }
    return SecureStore.setItemAsync(key, value);
  },
  async remove(key: string) {
    if (Platform.OS === "web") { localStorage.removeItem(key); return; }
    return SecureStore.deleteItemAsync(key);
  },
};

export type AuthUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (token: string, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([storage.get(TOKEN_KEY), storage.get(USER_KEY)]).then(
      ([storedToken, storedUser]) => {
        setToken(storedToken);
        setUser(storedUser ? JSON.parse(storedUser) : null);
        setIsLoading(false);
      }
    );
  }, []);

  const signIn = async (newToken: string, newUser: AuthUser) => {
    await Promise.all([
      storage.set(TOKEN_KEY, newToken),
      storage.set(USER_KEY, JSON.stringify(newUser)),
    ]);
    setToken(newToken);
    setUser(newUser);
  };

  const signOut = async () => {
    await Promise.all([storage.remove(TOKEN_KEY), storage.remove(USER_KEY)]);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
