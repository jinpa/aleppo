import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";

type RowProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

function Row({ icon, label, onPress, destructive }: RowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      <Ionicons
        name={icon}
        size={20}
        color={destructive ? "#b91c1c" : "#57534e"}
        style={styles.rowIcon}
      />
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
        {label}
      </Text>
      {!destructive && (
        <Ionicons name="chevron-forward" size={16} color="#d6d3d1" />
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <View style={styles.container}>
      <View style={styles.titleBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color="#1c1917" />
        </TouchableOpacity>
        <Text style={styles.title}>Profile</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.identity}>
        {user?.image ? (
          <Image
            source={{ uri: user.image }}
            style={styles.avatar}
            contentFit="cover"
          />
        ) : (
          <View style={styles.avatarFallback}>
            {initials ? (
              <Text style={styles.avatarInitials}>{initials}</Text>
            ) : (
              <Ionicons name="person" size={28} color="#a8a29e" />
            )}
          </View>
        )}
        {user ? (
          <>
            <Text style={styles.name}>{user.name ?? "—"}</Text>
            <Text style={styles.email}>{user.email}</Text>
          </>
        ) : (
          <Text style={styles.placeholderNote}>
            Sign out and back in to load your profile.
          </Text>
        )}
      </View>

      <View style={styles.section}>
        <Row
          icon="settings-outline"
          label="Settings"
          onPress={() => router.push("/settings")}
        />
        <View style={styles.divider} />
        <Row
          icon="person-outline"
          label="View public profile"
          onPress={() => user?.id && router.push(`/u/${user.id}`)}
        />
      </View>

      <View style={styles.section}>
        <Row
          icon="log-out-outline"
          label="Sign out"
          onPress={handleSignOut}
          destructive
        />
      </View>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1c1917",
  },
  identity: {
    alignItems: "center",
    gap: 6,
    marginBottom: 32,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 4,
  },
  avatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#e7e5e4",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  avatarInitials: {
    fontSize: 26,
    fontWeight: "600",
    color: "#57534e",
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1c1917",
  },
  email: {
    fontSize: 14,
    color: "#78716c",
  },
  placeholderNote: {
    fontSize: 13,
    color: "#a8a29e",
    textAlign: "center",
    marginTop: 4,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e7e5e4",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowIcon: {
    marginRight: 12,
    width: 22,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: "#1c1917",
  },
  rowLabelDestructive: {
    color: "#b91c1c",
  },
  divider: {
    height: 1,
    backgroundColor: "#f5f5f4",
    marginLeft: 50,
  },
});
