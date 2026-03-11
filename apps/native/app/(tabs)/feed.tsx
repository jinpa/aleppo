import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
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

type FeedItem = {
  log: {
    id: string;
    cookedOn: string;
    notes: string | null;
    createdAt: string;
  };
  recipe: {
    id: string;
    title: string;
    imageUrl: string | null;
    tags: string[];
  };
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
};

type SearchUser = {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  isFollowing: boolean;
  followLoading: boolean;
};

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function UserAvatar({
  user,
  size = 36,
}: {
  user: FeedItem["user"];
  size?: number;
}) {
  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (user.image) {
    return (
      <Image
        source={{ uri: user.image }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#e7e5e4",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      {initials ? (
        <Text style={{ fontSize: size * 0.35, fontWeight: "600", color: "#57534e" }}>
          {initials}
        </Text>
      ) : (
        <Ionicons name="person" size={size * 0.5} color="#a8a29e" />
      )}
    </View>
  );
}

export default function FeedScreen() {
  const router = useRouter();
  const { token, user, signOut } = useAuth();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const fetchFeed = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/api/feed`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          await signOut();
          return;
        }
        if (!res.ok) throw new Error();
        setItems(await res.json());
      } catch {
        setError("Could not load feed");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, signOut]
  );

  useFocusEffect(useCallback(() => { fetchFeed(); }, [fetchFeed]));

  // Debounced people search
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(
            data.map((u: Omit<SearchUser, "isFollowing" | "followLoading">) => ({
              ...u,
              isFollowing: false,
              followLoading: false,
            }))
          );
        }
      } catch {
        // silently ignore search errors
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, token]);

  const toggleFollow = async (userId: string) => {
    setSearchResults((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, followLoading: true } : u))
    );
    const target = searchResults.find((u) => u.id === userId);
    if (!target) return;
    const wasFollowing = target.isFollowing;
    // optimistic update
    setSearchResults((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, isFollowing: !wasFollowing, followLoading: false } : u
      )
    );
    try {
      const res = await fetch(`${API_URL}/api/follows`, {
        method: wasFollowing ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ followingId: userId }),
      });
      if (!res.ok) {
        // revert
        setSearchResults((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, isFollowing: wasFollowing } : u
          )
        );
      } else if (!wasFollowing) {
        // followed someone — refresh feed in background
        fetchFeed({ silent: true });
      }
    } catch {
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, isFollowing: wasFollowing } : u
        )
      );
    }
  };

  const initials = user?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const listHeader = (
    <View>
      {/* Title row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.heading}>Following Feed</Text>
        </View>
        <TouchableOpacity onPress={() => router.navigate("/profile")} style={styles.avatarButton}>
          {user?.image ? (
            <Image source={{ uri: user.image }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={styles.avatarFallback}>
              {initials ? (
                <Text style={styles.avatarInitials}>{initials}</Text>
              ) : (
                <Ionicons name="person" size={16} color="#78716c" />
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* People search */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <Ionicons name="person-add-outline" size={16} color="#78716c" />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Find people to follow…"
            placeholderTextColor="#a8a29e"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searchLoading && <ActivityIndicator size="small" color="#a8a29e" />}
        </View>

        {searchResults.length > 0 && (
          <View style={styles.searchResults}>
            {searchResults.map((result) => {
              const ri = result.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <View key={result.id} style={styles.searchResultRow}>
                  <TouchableOpacity
                    style={styles.searchResultLeft}
                    onPress={() => router.push(`/u/${result.id}`)}
                    activeOpacity={0.7}
                  >
                    {result.image ? (
                      <Image source={{ uri: result.image }} style={styles.searchResultAvatar} contentFit="cover" />
                    ) : (
                      <View style={styles.searchResultAvatarFallback}>
                        {ri ? (
                          <Text style={styles.searchResultInitials}>{ri}</Text>
                        ) : (
                          <Ionicons name="person" size={14} color="#a8a29e" />
                        )}
                      </View>
                    )}
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName} numberOfLines={1}>{result.name ?? "Unknown"}</Text>
                      {result.bio ? <Text style={styles.searchResultBio} numberOfLines={1}>{result.bio}</Text> : null}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.followBtn, result.isFollowing && styles.followBtnActive]}
                    onPress={() => toggleFollow(result.id)}
                    disabled={result.followLoading}
                  >
                    {result.followLoading ? (
                      <ActivityIndicator size="small" color={result.isFollowing ? "#fff" : "#1c1917"} />
                    ) : (
                      <Text style={[styles.followBtnText, result.isFollowing && styles.followBtnTextActive]}>
                        {result.isFollowing ? "Following" : "Follow"}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {searchQuery.trim().length >= 2 && !searchLoading && searchResults.length === 0 && (
          <Text style={styles.searchEmpty}>No users found for "{searchQuery.trim()}"</Text>
        )}
      </View>
    </View>
  );

  const listEmpty = loading ? (
    <View style={styles.emptyContainer}>
      <ActivityIndicator size="large" color="#1c1917" />
    </View>
  ) : error ? (
    <View style={styles.emptyContainer}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => fetchFeed()}>
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={48} color="#d6d3d1" />
      <Text style={styles.emptyTitle}>Nothing in your feed yet</Text>
      <Text style={styles.emptySubtitle}>
        Follow other cooks to see what they've been making.
      </Text>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={items}
      keyExtractor={(item) => item.log.id}
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
            fetchFeed({ silent: true });
          }}
          tintColor="#1c1917"
        />
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          {/* User row */}
          <View style={styles.cardUserRow}>
            <TouchableOpacity
              onPress={() => router.push(`/u/${item.user.id}`)}
              style={styles.cardUserLeft}
              activeOpacity={0.7}
            >
              <UserAvatar user={item.user} size={36} />
              <View style={styles.cardUserInfo}>
                <Text style={styles.cardUserName}>
                  {item.user.name ?? "Unknown"}
                </Text>
                <Text style={styles.cardUserAction}>
                  cooked this · {formatDate(item.log.cookedOn)}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Cook notes */}
          {item.log.notes ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>"{item.log.notes}"</Text>
            </View>
          ) : null}

          {/* Recipe card */}
          <TouchableOpacity
            style={styles.recipeCard}
            onPress={() => router.push(`/recipes/${item.recipe.id}`)}
            activeOpacity={0.7}
          >
            {item.recipe.imageUrl ? (
              <Image
                source={{ uri: item.recipe.imageUrl }}
                style={styles.recipeImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.recipeImagePlaceholder}>
                <Text style={{ fontSize: 24 }}>🍳</Text>
              </View>
            )}
            <View style={styles.recipeBody}>
              <Text style={styles.recipeTitle} numberOfLines={2}>
                {item.recipe.title}
              </Text>
              {item.recipe.tags.length > 0 && (
                <View style={styles.tagRow}>
                  {item.recipe.tags.slice(0, 3).map((tag) => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                  {item.recipe.tags.length > 3 && (
                    <Text style={styles.tagOverflow}>+{item.recipe.tags.length - 3}</Text>
                  )}
                </View>
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color="#d6d3d1" style={{ alignSelf: "center" }} />
          </TouchableOpacity>
        </View>
      )}
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
  avatarButton: { borderRadius: 20 },
  avatar: { width: 34, height: 34, borderRadius: 17 },
  avatarFallback: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "#e7e5e4", justifyContent: "center", alignItems: "center",
  },
  avatarInitials: { fontSize: 13, fontWeight: "600", color: "#57534e" },
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
  separator: { height: 12 },

  // Feed card
  card: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e7e5e4",
    overflow: "hidden",
  },
  cardUserRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
  },
  cardUserLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  cardUserInfo: { flex: 1 },
  cardUserName: { fontSize: 14, fontWeight: "600", color: "#1c1917" },
  cardUserAction: { fontSize: 12, color: "#78716c", marginTop: 1 },

  // Notes
  notesBox: {
    backgroundColor: "#fef3c7",
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 8,
    padding: 10,
  },
  notesText: {
    fontSize: 13,
    color: "#92400e",
    fontStyle: "italic",
    lineHeight: 18,
  },

  // Recipe card
  recipeCard: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#f5f5f4",
    padding: 10,
    gap: 10,
  },
  recipeImage: { width: 56, height: 56, borderRadius: 8 },
  recipeImagePlaceholder: {
    width: 56, height: 56, borderRadius: 8,
    backgroundColor: "#fef3c7", justifyContent: "center", alignItems: "center",
  },
  recipeBody: { flex: 1 },
  recipeTitle: { fontSize: 14, fontWeight: "600", color: "#1c1917", lineHeight: 19 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  tag: {
    backgroundColor: "#f5f5f4", borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  tagText: { fontSize: 10, color: "#57534e", fontWeight: "500" },
  tagOverflow: { fontSize: 10, color: "#a8a29e", alignSelf: "center" },

  // People search
  searchSection: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e5e4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1c1917",
  },
  searchResults: {
    marginTop: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e5e4",
    borderRadius: 10,
    overflow: "hidden",
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f5f5f4",
    gap: 8,
  },
  searchResultLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  searchResultAvatar: { width: 36, height: 36, borderRadius: 18 },
  searchResultAvatarFallback: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#e7e5e4", justifyContent: "center", alignItems: "center",
  },
  searchResultInitials: { fontSize: 12, fontWeight: "600", color: "#57534e" },
  searchResultInfo: { flex: 1 },
  searchResultName: { fontSize: 14, fontWeight: "600", color: "#1c1917" },
  searchResultBio: { fontSize: 12, color: "#78716c", marginTop: 1 },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e7e5e4",
    backgroundColor: "#fff",
    minWidth: 76,
    alignItems: "center",
  },
  followBtnActive: {
    backgroundColor: "#1c1917",
    borderColor: "#1c1917",
  },
  followBtnText: { fontSize: 13, fontWeight: "600", color: "#1c1917" },
  followBtnTextActive: { color: "#fff" },
  searchEmpty: {
    fontSize: 13, color: "#a8a29e",
    textAlign: "center", marginTop: 10, paddingBottom: 4,
  },
});
