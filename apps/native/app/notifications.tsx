import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";
import { API_URL } from "@/constants/api";
import { UserAvatar } from "@/components/UserAvatar";
import type { Notification } from "@aleppo/shared";

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followLoadingIds, setFollowLoadingIds] = useState<Set<string>>(new Set());

  const fetchNotifications = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setItems(data.notifications ?? []);
        }
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token]
  );

  // Fetch notifications and mark all as read on mount
  useEffect(() => {
    fetchNotifications();
    fetch(`${API_URL}/api/notifications`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }, [fetchNotifications, token]);

  // Check which actors the user already follows
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/feed`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const ids = new Set<string>(
          (data.following ?? []).map((u: { id: string }) => u.id)
        );
        setFollowingIds(ids);
      })
      .catch(() => {});
  }, [token]);

  const handleFollowBack = async (actorId: string) => {
    setFollowLoadingIds((prev) => new Set(prev).add(actorId));
    try {
      const res = await fetch(`${API_URL}/api/follows`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ followingId: actorId }),
      });
      if (res.ok) {
        setFollowingIds((prev) => new Set(prev).add(actorId));
      }
    } catch {
      // ignore
    } finally {
      setFollowLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(actorId);
        return next;
      });
    }
  };

  const renderItem = ({ item }: { item: Notification }) => {
    const actorName = item.actor?.name ?? "Someone";
    const showFollowBack =
      item.actor && item.actor.isPublic && !followingIds.has(item.actor.id);

    return (
      <TouchableOpacity
        style={[styles.row, !item.read && styles.rowUnread]}
        onPress={() => item.actor && router.push(`/u/${item.actor.id}`)}
        activeOpacity={0.7}
      >
        <UserAvatar
          name={item.actor?.name}
          image={item.actor?.image}
          size={40}
        />
        <View style={styles.rowBody}>
          <Text style={styles.rowText}>
            <Text style={styles.rowName}>{actorName}</Text>
            {" started following you"}
          </Text>
          <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        {showFollowBack && (
          <TouchableOpacity
            style={styles.followBackBtn}
            onPress={(e) => {
              e.stopPropagation();
              handleFollowBack(item.actor!.id);
            }}
            disabled={followLoadingIds.has(item.actor!.id)}
          >
            {followLoadingIds.has(item.actor!.id) ? (
              <ActivityIndicator size="small" color="#1c1917" />
            ) : (
              <Text style={styles.followBackText}>Follow back</Text>
            )}
          </TouchableOpacity>
        )}
        {item.actor && followingIds.has(item.actor.id) && (
          <View style={styles.followingBadge}>
            <Text style={styles.followingBadgeText}>Following</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color="#1c1917" />
        </TouchableOpacity>
        <Text style={styles.heading}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={items.length === 0 ? { flex: 1 } : undefined}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color="#1c1917" />
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color="#d6d3d1" />
              <Text style={styles.emptyTitle}>No notifications</Text>
              <Text style={styles.emptySubtitle}>
                When someone follows you, it will show up here.
              </Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchNotifications({ silent: true });
            }}
            tintColor="#1c1917"
          />
        }
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, backgroundColor: "#f5f5f4", marginLeft: 66 }} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafaf9" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e7e5e4",
  },
  heading: { fontSize: 17, fontWeight: "600", color: "#1c1917" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  rowUnread: { backgroundColor: "#fffbeb" },
  rowBody: { flex: 1 },
  rowText: { fontSize: 14, color: "#1c1917", lineHeight: 20 },
  rowName: { fontWeight: "600" },
  rowTime: { fontSize: 12, color: "#a8a29e", marginTop: 2 },
  followBackBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e7e5e4",
    backgroundColor: "#fff",
    minWidth: 90,
    alignItems: "center",
  },
  followBackText: { fontSize: 13, fontWeight: "600", color: "#1c1917" },
  followingBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#1c1917",
    minWidth: 90,
    alignItems: "center",
  },
  followingBadgeText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#1c1917" },
  emptySubtitle: { fontSize: 14, color: "#78716c", textAlign: "center" },
});
