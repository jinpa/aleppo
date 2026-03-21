import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";
import { NavShell } from "@/components/NavShell";

type ImportByType = { type: string; count: number };
type ImportByStatus = { type: string; status: string; count: number };
type SourceDomain = { domain: string; type: string; count: number };
type FailedError = { type: string; error: string; count: number };
type WeeklyCount = { week: string; count: number };
type ImageSourceType = { sourceType: string; count: number };
type ActiveUsers = {
  cookLast7d: number;
  cookLast30d: number;
  importLast7d: number;
  importLast30d: number;
};

type AnalyticsData = {
  days: number;
  importsByType: ImportByType[];
  importsByStatus: ImportByStatus[];
  topSourceDomains: SourceDomain[];
  failedImportErrors: FailedError[];
  newUsersOverTime: WeeklyCount[];
  cookLogsOverTime: WeeklyCount[];
  recipesOverTime: WeeklyCount[];
  imageSourceTypes: ImageSourceType[];
  activeUsers: ActiveUsers;
};

const PERIOD_OPTIONS = [30, 90, 365] as const;

export default function AnalyticsScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState<number>(90);

  const baseUrl = Platform.OS === "web" ? "" : process.env.EXPO_PUBLIC_API_URL ?? "";

  const fetchData = useCallback(async (d: number) => {
    const res = await fetch(`${baseUrl}/api/admin/analytics?days=${d}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setData(await res.json());
    }
  }, [token, baseUrl]);

  useEffect(() => {
    if (!token) return;
    fetchData(days).then(() => setLoading(false));
  }, [token, days]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData(days);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fafaf9", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#78716c" />
      </View>
    );
  }

  const formatWeek = (w: string) => {
    const d = new Date(w);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <NavShell>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Title bar */}
        <View style={styles.titleBar}>
          <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Ionicons name="arrow-back" size={22} color="#1c1917" />
          </TouchableOpacity>
          <Text style={styles.title}>Analytics</Text>
        </View>

        {/* Period selector */}
        <View style={styles.periodRow}>
          {PERIOD_OPTIONS.map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.periodBtn, days === d && styles.periodBtnActive]}
              onPress={() => setDays(d)}
            >
              <Text style={[styles.periodText, days === d && styles.periodTextActive]}>
                {d === 365 ? "1 year" : `${d}d`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {data && (
          <>
            {/* Active users */}
            <Text style={styles.sectionTitle}>Active Users</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>Cooked (7d / 30d)</Text>
                <Text style={styles.value}>{data.activeUsers.cookLast7d} / {data.activeUsers.cookLast30d}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Imported (7d / 30d)</Text>
                <Text style={styles.value}>{data.activeUsers.importLast7d} / {data.activeUsers.importLast30d}</Text>
              </View>
            </View>

            {/* Imports by type */}
            <Text style={styles.sectionTitle}>Imports by Type</Text>
            <View style={styles.card}>
              {data.importsByType.length === 0 ? (
                <Text style={styles.emptyText}>No imports yet</Text>
              ) : (
                data.importsByType.map((r) => (
                  <View key={r.type} style={styles.row}>
                    <Text style={styles.label}>{r.type}</Text>
                    <Text style={styles.value}>{r.count}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Image source types */}
            {data.imageSourceTypes.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Image Import Types</Text>
                <View style={styles.card}>
                  {data.imageSourceTypes.map((r) => (
                    <View key={r.sourceType} style={styles.row}>
                      <Text style={styles.label}>{r.sourceType === "dish_photo" ? "Photo of dish" : r.sourceType === "recipe_text" ? "Recipe text/page" : r.sourceType}</Text>
                      <Text style={styles.value}>{r.count}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Success / failure by type */}
            <Text style={styles.sectionTitle}>Import Success Rate</Text>
            <View style={styles.card}>
              {data.importsByStatus.length === 0 ? (
                <Text style={styles.emptyText}>No imports yet</Text>
              ) : (
                data.importsByStatus.map((r, i) => (
                  <View key={`${r.type}-${r.status}-${i}`} style={styles.row}>
                    <Text style={styles.label}>
                      {r.type} <Text style={{ color: r.status === "failed" ? "#b91c1c" : "#15803d" }}>({r.status})</Text>
                    </Text>
                    <Text style={styles.value}>{r.count}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Top source domains */}
            <Text style={styles.sectionTitle}>Top Source Domains</Text>
            <View style={styles.card}>
              {data.topSourceDomains.length === 0 ? (
                <Text style={styles.emptyText}>No data</Text>
              ) : (
                data.topSourceDomains.map((r, i) => (
                  <View key={`${r.domain}-${r.type}-${i}`} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.label} numberOfLines={1}>{r.domain}</Text>
                      <Text style={styles.sublabel}>{r.type}</Text>
                    </View>
                    <Text style={styles.value}>{r.count}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Top errors */}
            {data.failedImportErrors.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Top Errors</Text>
                <View style={styles.card}>
                  {data.failedImportErrors.map((r, i) => (
                    <View key={`err-${i}`} style={styles.row}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.label}>{r.type}</Text>
                        <Text style={[styles.sublabel, { color: "#b91c1c" }]} numberOfLines={2}>{r.error}</Text>
                      </View>
                      <Text style={styles.value}>{r.count}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Weekly trends */}
            <Text style={styles.sectionTitle}>Weekly Trends</Text>
            <View style={styles.card}>
              <Text style={styles.trendHeader}>New Users</Text>
              {data.newUsersOverTime.length === 0 ? (
                <Text style={styles.emptyText}>No data</Text>
              ) : (
                data.newUsersOverTime.slice(-8).map((r) => (
                  <View key={r.week} style={styles.row}>
                    <Text style={styles.label}>{formatWeek(r.week)}</Text>
                    <Text style={styles.value}>{r.count}</Text>
                  </View>
                ))
              )}

              <Text style={[styles.trendHeader, { marginTop: 16 }]}>Cook Logs</Text>
              {data.cookLogsOverTime.length === 0 ? (
                <Text style={styles.emptyText}>No data</Text>
              ) : (
                data.cookLogsOverTime.slice(-8).map((r) => (
                  <View key={r.week} style={styles.row}>
                    <Text style={styles.label}>{formatWeek(r.week)}</Text>
                    <Text style={styles.value}>{r.count}</Text>
                  </View>
                ))
              )}

              <Text style={[styles.trendHeader, { marginTop: 16 }]}>Recipes Created</Text>
              {data.recipesOverTime.length === 0 ? (
                <Text style={styles.emptyText}>No data</Text>
              ) : (
                data.recipesOverTime.slice(-8).map((r) => (
                  <View key={r.week} style={styles.row}>
                    <Text style={styles.label}>{formatWeek(r.week)}</Text>
                    <Text style={styles.value}>{r.count}</Text>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </NavShell>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafaf9",
    paddingTop: Platform.OS === "ios" ? 60 : 24,
  },
  titleBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1c1917",
  },
  periodRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  periodBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e7e5e4",
    backgroundColor: "#fff",
  },
  periodBtnActive: {
    borderColor: "#1d4ed8",
    backgroundColor: "#eff6ff",
  },
  periodText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#57534e",
  },
  periodTextActive: {
    color: "#1d4ed8",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#78716c",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e7e5e4",
    padding: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  label: {
    fontSize: 14,
    color: "#1c1917",
  },
  sublabel: {
    fontSize: 11,
    color: "#a8a29e",
    marginTop: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1c1917",
    marginLeft: 12,
  },
  emptyText: {
    fontSize: 13,
    color: "#a8a29e",
    fontStyle: "italic",
  },
  trendHeader: {
    fontSize: 13,
    fontWeight: "600",
    color: "#57534e",
    marginBottom: 4,
  },
});
