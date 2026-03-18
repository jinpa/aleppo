import { View, Text, TouchableOpacity, StyleSheet, Platform, Pressable, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const PHONE_MAX = 600;
const ACTIVE_COLOR = "#1c1917";
const INACTIVE_COLOR = "#a8a29e";
const AMBER_COLOR = "#d97706";

const TAB_ITEMS = [
  { name: "Recipes", icon: "book-outline" as const, route: "/(tabs)/recipes", amber: false },
  { name: "Queue", icon: "time-outline" as const, route: "/(tabs)/queue", amber: false },
  { name: "Feed", icon: "people-outline" as const, route: "/(tabs)/feed", amber: false },
  { name: "New", icon: "add-circle-outline" as const, route: "/(tabs)/new", amber: true },
  { name: "Import", icon: "arrow-down-circle-outline" as const, route: "/(tabs)/import", amber: false },
] as const;

type NavLayout = "top" | "left" | "bottom";

function useNavLayout(): NavLayout {
  const { width, height } = useWindowDimensions();
  if (width > height && width >= PHONE_MAX) return "left";
  if (width >= PHONE_MAX) return "top";
  return "bottom";
}

function TopNav() {
  const router = useRouter();
  return (
    <View style={styles.topBar}>
      {TAB_ITEMS.map((item) => {
        const color = item.amber ? AMBER_COLOR : INACTIVE_COLOR;
        return (
          <Pressable
            key={item.name}
            onPress={() => router.navigate(item.route)}
            style={styles.topTab}
          >
            <Ionicons name={item.icon} size={20} color={color} />
            <Text style={[styles.topLabel, { color }]}>{item.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SidebarNav() {
  const router = useRouter();
  return (
    <View style={styles.sidebar}>
      {TAB_ITEMS.map((item) => {
        const color = item.amber ? AMBER_COLOR : INACTIVE_COLOR;
        return (
          <Pressable
            key={item.name}
            onPress={() => router.navigate(item.route)}
            style={styles.sidebarTab}
          >
            <Ionicons name={item.icon} size={22} color={color} />
            <Text style={[styles.sidebarLabel, { color }]}>{item.name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function BottomTabBar() {
  const router = useRouter();
  return (
    <View style={styles.bottomBar}>
      {TAB_ITEMS.map((item) => (
        <TouchableOpacity
          key={item.name}
          style={styles.bottomTab}
          onPress={() => router.navigate(item.route)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={item.icon}
            size={24}
            color={item.amber ? AMBER_COLOR : INACTIVE_COLOR}
          />
          <Text style={[styles.bottomLabel, item.amber && styles.bottomLabelAmber]}>
            {item.name}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

/** Wraps children with the correct nav position (top bar, left sidebar, or bottom tab bar). */
export function NavShell({ children }: { children: React.ReactNode }) {
  const layout = useNavLayout();
  if (layout === "left") {
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        <SidebarNav />
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    );
  }
  if (layout === "top") {
    return (
      <View style={{ flex: 1 }}>
        <TopNav />
        {children}
      </View>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      {children}
      <BottomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e7e5e4",
    paddingTop: Platform.OS === "ios" ? 50 : 0,
  },
  topTab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 12 },
  topLabel: { fontSize: 13, fontWeight: "500" },
  sidebar: {
    width: 200,
    backgroundColor: "#ffffff",
    borderRightWidth: 1,
    borderRightColor: "#e7e5e4",
    paddingTop: 24,
  },
  sidebarTab: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  sidebarLabel: { fontSize: 14, fontWeight: "500" },
  bottomBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e7e5e4",
    paddingBottom: Platform.OS === "ios" ? 28 : 8,
    paddingTop: 8,
  },
  bottomTab: { flex: 1, alignItems: "center", gap: 2 },
  bottomLabel: { fontSize: 11, fontWeight: "500", color: INACTIVE_COLOR },
  bottomLabelAmber: { color: AMBER_COLOR },
});
