import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Platform,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";

const TAB_ITEMS = [
  { name: "Recipes", icon: "book-outline" as const, route: "/(tabs)/recipes", amber: false },
  { name: "Queue", icon: "time-outline" as const, route: "/(tabs)/queue", amber: false },
  { name: "Feed", icon: "people-outline" as const, route: "/(tabs)/feed", amber: false },
  { name: "New", icon: "add-circle-outline" as const, route: "/(tabs)/new", amber: true },
  { name: "Import", icon: "arrow-down-circle-outline" as const, route: "/(tabs)/import", amber: false },
] as const;

function TabBar() {
  const router = useRouter();
  return (
    <View style={tabStyles.bar}>
      {TAB_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.name}
          style={tabStyles.tab}
          onPress={() => router.navigate(item.route)}
          activeOpacity={0.7}
        >
          <Ionicons name={item.icon} size={24} color={item.amber ? "#d97706" : "#a8a29e"} />
          <Text style={[tabStyles.label, item.amber && tabStyles.labelAmber]}>{item.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e7e5e4",
    paddingBottom: Platform.OS === "ios" ? 28 : 8,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  label: { fontSize: 11, fontWeight: "500", color: "#a8a29e" },
  labelAmber: { color: "#d97706" },
});

type Totals = { users: number; recipes: number; cookLogs: number; follows: number; totalStorageBytes: number };

type AdminUserRow = {
  id: string;
  name: string | null;
  email: string;
  isPublic: boolean;
  isAdmin: boolean;
  isSuspended: boolean;
  recipeCount: number;
  cookLogCount: number;
  storageBytes: number;
  createdAt: string;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

function useApi() {
  const { token } = useAuth();
  const baseUrl =
    Platform.OS === "web"
      ? ""
      : process.env.EXPO_PUBLIC_API_URL ?? "";

  const apiFetch = useCallback(
    async (path: string, opts?: RequestInit) => {
      const res = await fetch(`${baseUrl}${path}`, {
        ...opts,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(opts?.headers as Record<string, string>),
        },
      });
      return res;
    },
    [token, baseUrl]
  );

  return apiFetch;
}

export default function AdminScreen() {
  const { user, token } = useAuth();
  const router = useRouter();
  const apiFetch = useApi();

  const [totals, setTotals] = useState<Totals | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Guard: non-admin users get redirected
  useEffect(() => {
    if (user && !user.isAdmin) {
      router.replace("/(tabs)/recipes");
    }
  }, [user]);

  const fetchData = useCallback(
    async (q?: string) => {
      const qs = q ? `?q=${encodeURIComponent(q)}` : "";
      const res = await apiFetch(`/api/admin/stats${qs}`);
      if (!res.ok) return;
      const data = await res.json();
      setTotals(data.totals);
      setUsers(data.users);
    },
    [apiFetch]
  );

  useEffect(() => {
    if (!token) return;
    fetchData().then(() => setLoading(false));
  }, [token]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => fetchData(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(search);
    setRefreshing(false);
  };

  const handleSuspend = (row: AdminUserRow) => {
    const action = row.isSuspended ? "Unsuspend" : "Suspend";
    const doIt = async () => {
      await apiFetch(`/api/admin/users/${row.id}/suspend`, {
        method: "POST",
        body: JSON.stringify({ suspended: !row.isSuspended }),
      });
      fetchData(search);
    };

    if (Platform.OS === "web") {
      if (confirm(`${action} ${row.name ?? row.email}?`)) doIt();
    } else {
      Alert.alert(action, `${action} ${row.name ?? row.email}?`, [
        { text: "Cancel", style: "cancel" },
        { text: action, style: row.isSuspended ? "default" : "destructive", onPress: doIt },
      ]);
    }
  };

  const handleRole = (row: AdminUserRow) => {
    const action = row.isAdmin ? "Remove admin" : "Make admin";
    const doIt = async () => {
      await apiFetch(`/api/admin/users/${row.id}/role`, {
        method: "POST",
        body: JSON.stringify({ isAdmin: !row.isAdmin }),
      });
      fetchData(search);
    };

    if (Platform.OS === "web") {
      if (confirm(`${action} for ${row.name ?? row.email}?`)) doIt();
    } else {
      Alert.alert(action, `${action} for ${row.name ?? row.email}?`, [
        { text: "Cancel", style: "cancel" },
        { text: action, onPress: doIt },
      ]);
    }
  };

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const renderUser = ({ item }: { item: AdminUserRow }) => {
    const isExpanded = expandedId === item.id;
    const isSelf = item.id === user?.id;
    return (
      <View>
        <TouchableOpacity
          style={styles.userRow}
          onPress={() => setExpandedId(isExpanded ? null : item.id)}
          activeOpacity={0.6}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.userNameRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {item.name ?? "—"}
              </Text>
              {item.isAdmin && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>Admin</Text>
                </View>
              )}
              {item.isSuspended && (
                <View style={[styles.badge, styles.badgeSuspended]}>
                  <Text style={[styles.badgeText, styles.badgeTextSuspended]}>Suspended</Text>
                </View>
              )}
            </View>
            <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
            <Text style={styles.userMeta}>
              {item.recipeCount} recipes · {item.cookLogCount} cooks · {formatBytes(item.storageBytes)} · Joined{" "}
              {new Date(item.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </View>
          <Ionicons
            name={isExpanded ? "chevron-up" : "chevron-down"}
            size={16}
            color="#a8a29e"
          />
        </TouchableOpacity>
        {isExpanded && !isSelf && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.actionBtn, item.isSuspended && styles.actionBtnPrimary]}
              onPress={() => handleSuspend(item)}
            >
              <Text
                style={[
                  styles.actionBtnText,
                  item.isSuspended
                    ? styles.actionBtnTextPrimary
                    : styles.actionBtnTextDestructive,
                ]}
              >
                {item.isSuspended ? "Unsuspend" : "Suspend"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleRole(item)}
            >
              <Text style={styles.actionBtnText}>
                {item.isAdmin ? "Remove admin" : "Make admin"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const statsCards = totals
    ? [
        { label: "Users", value: totals.users },
        { label: "Recipes", value: totals.recipes },
        { label: "Cook Logs", value: totals.cookLogs },
        { label: "Follows", value: totals.follows },
        { label: "Storage", value: formatBytes(totals.totalStorageBytes), raw: true },
      ]
    : [];

  const header = (
    <>
      {/* Stats grid */}
      <View style={styles.statsGrid}>
        {statsCards.map((s) => (
          <View key={s.label} style={styles.statCard}>
            <Text style={styles.statLabel}>{s.label}</Text>
            <Text style={styles.statValue}>
              {"raw" in s ? s.value : (s.value as number).toLocaleString()}
            </Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="#a8a29e" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users by name or email..."
          placeholderTextColor="#a8a29e"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color="#a8a29e" />
          </TouchableOpacity>
        )}
      </View>

      {/* Users heading */}
      <Text style={styles.sectionTitle}>Users</Text>
    </>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fafaf9", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#78716c" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#fafaf9" }}>
      <View style={styles.container}>
        {/* Title bar */}
        <View style={styles.titleBar}>
          <Text style={styles.title}>Admin</Text>
        </View>

        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          renderItem={renderUser}
          ListHeaderComponent={header}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      </View>
      <TabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafaf9",
    paddingTop: Platform.OS === "ios" ? 60 : 24,
  },
  titleBar: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1c1917",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e7e5e4",
    padding: 14,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#78716c",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1c1917",
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e7e5e4",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1c1917",
    padding: 0,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#78716c",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e7e5e4",
  },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1c1917",
  },
  userEmail: {
    fontSize: 13,
    color: "#78716c",
    marginBottom: 2,
  },
  userMeta: {
    fontSize: 12,
    color: "#a8a29e",
  },
  badge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#1d4ed8",
  },
  badgeSuspended: {
    backgroundColor: "#fee2e2",
  },
  badgeTextSuspended: {
    color: "#b91c1c",
  },
  separator: {
    height: 6,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 2,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e7e5e4",
    backgroundColor: "#fff",
  },
  actionBtnPrimary: {
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#57534e",
  },
  actionBtnTextPrimary: {
    color: "#15803d",
  },
  actionBtnTextDestructive: {
    color: "#b91c1c",
  },
});
