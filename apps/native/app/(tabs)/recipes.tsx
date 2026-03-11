import { useState, useCallback } from "react";
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

type Recipe = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  tags: string[];
  prepTime: number | null;
  cookTime: number | null;
  isPublic: boolean;
  sourceName: string | null;
  createdAt: string;
};

function totalTime(recipe: Recipe): string | null {
  const mins = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  if (!mins) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const router = useRouter();
  const time = totalTime(recipe);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/recipes/${recipe.id}`)}
      activeOpacity={0.7}
    >
      {recipe.imageUrl ? (
        <Image
          source={{ uri: recipe.imageUrl }}
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
          {recipe.title}
        </Text>
        {recipe.description ? (
          <Text style={styles.cardDescription} numberOfLines={2}>
            {recipe.description}
          </Text>
        ) : null}
        <View style={styles.cardMeta}>
          {time ? (
            <Text style={styles.cardMetaText}>{time}</Text>
          ) : null}
          {recipe.sourceName ? (
            <Text style={styles.cardMetaText} numberOfLines={1}>
              {recipe.sourceName}
            </Text>
          ) : null}
        </View>
        {recipe.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {recipe.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
            {recipe.tags.length > 3 ? (
              <Text style={styles.tagOverflow}>+{recipe.tags.length - 3}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function RecipesScreen() {
  const { token, user, signOut } = useAuth();
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagsExpanded, setTagsExpanded] = useState(false);

  const fetchRecipes = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (activeTag) params.set("tag", activeTag);
        const qs = params.toString();

        const res = await fetch(
          `${API_URL}/api/recipes${qs ? `?${qs}` : ""}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (res.status === 401) {
          await signOut();
          return;
        }
        if (!res.ok) throw new Error("Failed to load recipes");
        const data = await res.json();
        setRecipes(data);
      } catch {
        setError("Could not load recipes");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, search, activeTag, signOut]
  );

  useFocusEffect(
    useCallback(() => {
      fetchRecipes();
    }, [fetchRecipes])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchRecipes({ silent: true });
  };

  const allTags = Array.from(new Set(recipes.flatMap((r) => r.tags))).sort();
  const TAG_COLLAPSE_THRESHOLD = 5;
  const shouldCollapse = allTags.length > TAG_COLLAPSE_THRESHOLD;
  const visibleTags =
    shouldCollapse && !tagsExpanded ? allTags.slice(0, TAG_COLLAPSE_THRESHOLD) : allTags;

  const listHeader = (
    <View>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.heading}>My Recipes</Text>
          <Text style={styles.count}>{recipes.length}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.navigate("/profile")}
          style={styles.avatarButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {user?.image ? (
            <Image
              source={{ uri: user.image }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={styles.avatarFallback}>
              {user?.name ? (
                <Text style={styles.avatarInitials}>
                  {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </Text>
              ) : (
                <Ionicons name="person" size={16} color="#78716c" />
              )}
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes…"
          placeholderTextColor="#a8a29e"
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {allTags.length > 0 ? (
        <View style={styles.tagFilterRow}>
          {visibleTags.map((tag) => (
            <TouchableOpacity
              key={tag}
              style={[
                styles.tagFilter,
                activeTag === tag && styles.tagFilterActive,
              ]}
              onPress={() => setActiveTag(activeTag === tag ? null : tag)}
            >
              <Text
                style={[
                  styles.tagFilterText,
                  activeTag === tag && styles.tagFilterTextActive,
                ]}
              >
                {tag}
              </Text>
            </TouchableOpacity>
          ))}
          {shouldCollapse && (
            <TouchableOpacity
              style={styles.tagFilterToggle}
              onPress={() => setTagsExpanded((v) => !v)}
            >
              <Text style={styles.tagFilterToggleText}>
                {tagsExpanded
                  ? "Show less"
                  : `+ ${allTags.length - TAG_COLLAPSE_THRESHOLD} more`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );

  const listEmpty = loading ? (
    <View style={styles.emptyContainer}>
      <ActivityIndicator size="large" color="#1c1917" />
    </View>
  ) : error ? (
    <View style={styles.emptyContainer}>
      <Text style={styles.errorText}>{error}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => fetchRecipes()}
      >
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>No recipes yet</Text>
      <Text style={styles.emptySubtitle}>
        Import a recipe from a URL to get started.
      </Text>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      data={recipes}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => <RecipeCard recipe={item} />}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#1c1917"
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fafaf9",
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 24,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heading: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1c1917",
  },
  count: {
    fontSize: 14,
    color: "#78716c",
    marginTop: 4,
  },
  avatarButton: {
    borderRadius: 20,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#e7e5e4",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: "600",
    color: "#57534e",
  },
  searchWrapper: {
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e7e5e4",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: "#1c1917",
  },
  tagFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 10,
    gap: 6,
  },
  tagFilter: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#f5f5f4",
    borderWidth: 1,
    borderColor: "#e7e5e4",
    alignItems: "center",
    justifyContent: "center",
  },
  tagFilterActive: {
    backgroundColor: "#1c1917",
    borderColor: "#1c1917",
  },
  tagFilterText: {
    fontSize: 13,
    color: "#57534e",
    fontWeight: "500",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  tagFilterTextActive: {
    color: "#fff",
  },
  tagFilterToggle: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d6d3d1",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  tagFilterToggleText: {
    fontSize: 13,
    color: "#a8a29e",
    fontWeight: "500",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  list: {
    paddingBottom: 32,
  },
  separator: {
    height: 12,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e7e5e4",
    overflow: "hidden",
    flexDirection: "row",
  },
  cardImage: {
    width: 90,
    height: 90,
  },
  cardImagePlaceholder: {
    width: 90,
    height: 90,
    backgroundColor: "#fef3c7",
    justifyContent: "center",
    alignItems: "center",
  },
  cardImagePlaceholderText: {
    fontSize: 28,
  },
  cardBody: {
    flex: 1,
    padding: 10,
    gap: 3,
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1c1917",
    lineHeight: 20,
  },
  cardDescription: {
    fontSize: 12,
    color: "#78716c",
    lineHeight: 16,
  },
  cardMeta: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  cardMetaText: {
    fontSize: 11,
    color: "#a8a29e",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
  },
  tag: {
    backgroundColor: "#f5f5f4",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 10,
    color: "#57534e",
    fontWeight: "500",
  },
  tagOverflow: {
    fontSize: 10,
    color: "#a8a29e",
    alignSelf: "center",
  },
  errorText: {
    fontSize: 15,
    color: "#b91c1c",
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d6d3d1",
  },
  retryText: {
    fontSize: 14,
    color: "#57534e",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1c1917",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#78716c",
    textAlign: "center",
  },
});
