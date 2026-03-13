import { useState, useCallback } from "react";
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
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";
import { API_URL } from "@/constants/api";
import { UserAvatar } from "@/components/UserAvatar";
import { TagRow } from "@/components/TagRow";
import { formatTime, formatRelativeDate } from "@/utils/format";
import type { QueueItem } from "@aleppo/shared";


export default function QueueScreen() {
  const router = useRouter();
  const { token, user, signOut } = useAuth();
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchQueue = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/queue`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 && token) {
          await signOut();
          return;
        }
        if (!res.ok) throw new Error();
        setItems(await res.json());
      } catch {
        setError("Could not load queue");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, signOut]
  );

  useFocusEffect(useCallback(() => { fetchQueue(); }, [fetchQueue]));

  const removeItem = async (recipeId: string) => {
    setItems((prev) => prev.filter((i) => i.recipe.id !== recipeId));
    try {
      await fetch(`${API_URL}/api/queue`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ recipeId }),
      });
    } catch {
      fetchQueue({ silent: true });
    }
  };

  const moveItem = async (index: number, direction: "up" | "down") => {
    const newItems = [...items];
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= newItems.length) return;
    [newItems[index], newItems[swapWith]] = [newItems[swapWith], newItems[index]];
    setItems(newItems);
    try {
      await fetch(`${API_URL}/api/queue`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ order: newItems.map((i) => i.recipe.id) }),
      });
    } catch {
      fetchQueue({ silent: true });
    }
  };

  const listHeader = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.heading}>Want to Cook</Text>
        {items.length > 0 && <Text style={styles.count}>{items.length}</Text>}
      </View>
      <TouchableOpacity
        onPress={() => router.navigate("/profile")}
        style={styles.avatarButton}
      >
        <UserAvatar name={user?.name} image={user?.image} size={34} />
      </TouchableOpacity>
    </View>
  );

  const listEmpty = loading ? (
    <View style={styles.emptyContainer}>
      <ActivityIndicator size="large" color="#1c1917" />
    </View>
  ) : error ? (
    <View style={styles.emptyContainer}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => fetchQueue()}>
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.emptyContainer}>
      <Ionicons name="time-outline" size={48} color="#d6d3d1" />
      <Text style={styles.emptyTitle}>Queue is empty</Text>
      <Text style={styles.emptySubtitle}>
        Tap "Want to cook" on any recipe to add it here.
      </Text>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(item) => item.recipe.id}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            fetchQueue({ silent: true });
          }}
          tintColor="#1c1917"
        />
      }
      renderItem={({ item, index }) => {
        const totalMins = (item.recipe.prepTime ?? 0) + (item.recipe.cookTime ?? 0);
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/recipes/${item.recipe.id}`)}
            activeOpacity={0.7}
          >
            {item.recipe.imageUrl ? (
              <Image
                source={{ uri: item.recipe.imageUrl }}
                style={styles.cardImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.cardImagePlaceholder}>
                <Text style={styles.cardImagePlaceholderText}>🍳</Text>
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item.recipe.title}
              </Text>
              <View style={styles.cardMeta}>
                {totalMins > 0 && (
                  <Text style={styles.cardMetaText}>{formatTime(totalMins)}</Text>
                )}
                <Text style={styles.cardMetaText}>
                  Added {formatRelativeDate(item.addedAt)}
                </Text>
              </View>
              <TagRow tags={item.recipe.tags} />
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.cardActionBtn}
                onPress={() => moveItem(index, "up")}
                disabled={index === 0}
              >
                <Ionicons
                  name="chevron-up"
                  size={18}
                  color={index === 0 ? "#d6d3d1" : "#78716c"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardActionBtn}
                onPress={() => moveItem(index, "down")}
                disabled={index === items.length - 1}
              >
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={index === items.length - 1 ? "#d6d3d1" : "#78716c"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cardActionBtn}
                onPress={() => removeItem(item.recipe.id)}
              >
                <Ionicons name="close" size={20} color="#a8a29e" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      }}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafaf9" },
  list: { paddingBottom: 32 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 24,
    marginBottom: 16,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  heading: { fontSize: 28, fontWeight: "700", color: "#1c1917" },
  count: { fontSize: 14, color: "#78716c", marginTop: 4 },
  avatarButton: { borderRadius: 20 },
  emptyContainer: {
    paddingTop: 80, alignItems: "center", gap: 12, paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: "#1c1917" },
  emptySubtitle: { fontSize: 14, color: "#78716c", textAlign: "center" },
  errorText: { fontSize: 15, color: "#b91c1c", textAlign: "center" },
  retryButton: {
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: "#d6d3d1",
  },
  retryText: { fontSize: 14, color: "#57534e" },
  separator: { height: 10 },
  card: {
    marginHorizontal: 16, backgroundColor: "#fff",
    borderRadius: 12, borderWidth: 1, borderColor: "#e7e5e4",
    overflow: "hidden", flexDirection: "row",
  },
  cardImage: { width: 90, height: 90 },
  cardImagePlaceholder: {
    width: 90, height: 90, backgroundColor: "#fef3c7",
    justifyContent: "center", alignItems: "center",
  },
  cardImagePlaceholderText: { fontSize: 28 },
  cardBody: { flex: 1, padding: 10, gap: 3, justifyContent: "center" },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#1c1917", lineHeight: 20 },
  cardMeta: { flexDirection: "row", gap: 8, marginTop: 2, flexWrap: "wrap" },
  cardMetaText: { fontSize: 11, color: "#a8a29e" },
  cardActions: {
    flexDirection: "column", justifyContent: "space-evenly",
    alignItems: "center", paddingHorizontal: 10,
    borderLeftWidth: 1, borderLeftColor: "#f5f5f4",
  },
  cardActionBtn: { padding: 6 },
});
