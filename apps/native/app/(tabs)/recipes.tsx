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
  Modal,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";
import { API_URL } from "@/constants/api";
import { RecipeCard } from "@/components/RecipeCard";
import type { Recipe } from "@aleppo/shared";

type SortKey = "date" | "title" | "cooks" | "lastCooked" | "updated" | "totalTime";
type SortDir = "asc" | "desc";

const SORT_OPTIONS: { key: SortKey; label: string; defaultDir: SortDir }[] = [
  { key: "date", label: "Date added", defaultDir: "desc" },
  { key: "title", label: "A-Z", defaultDir: "asc" },
  { key: "cooks", label: "# Cooked", defaultDir: "desc" },
  { key: "lastCooked", label: "Last cooked", defaultDir: "desc" },
  { key: "updated", label: "Updated", defaultDir: "desc" },
  { key: "totalTime", label: "Total time", defaultDir: "asc" },
];

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
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Edit mode state
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const fetchRecipes = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!token) return;
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (activeTag) params.set("tag", activeTag);
        params.set("sort", sortKey);
        params.set("dir", sortDir);
        const qs = params.toString();

        const res = await fetch(
          `${API_URL}/api/recipes${qs ? `?${qs}` : ""}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (res.status === 401 && token) {
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
    [token, search, activeTag, sortKey, sortDir, signOut]
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

  const exitEditMode = () => {
    setSelectedIds(new Set());
    setEditMode(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(recipes.map((r) => r.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const allSelected = recipes.length > 0 && recipes.every((r) => selectedIds.has(r.id));

  const handleBulkDelete = async () => {
    setDeleting(true);
    const ids = Array.from(selectedIds);
    setRecipes((prev) => prev.filter((r) => !selectedIds.has(r.id)));
    try {
      const res = await fetch(`${API_URL}/api/recipes/batch`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error();
    } catch {
      fetchRecipes({ silent: true });
    } finally {
      setSelectedIds(new Set());
      setEditMode(false);
      setDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  };

  const allTags = Array.from(new Set(recipes.flatMap((r) => r.tags))).sort();
  const TAG_COLLAPSE_THRESHOLD = 5;
  const shouldCollapse = allTags.length > TAG_COLLAPSE_THRESHOLD;
  const visibleTags =
    shouldCollapse && !tagsExpanded ? allTags.slice(0, TAG_COLLAPSE_THRESHOLD) : allTags;

  const listHeader = (
    <View>
      <View style={styles.header}>
        {editMode ? (
          <>
            <TouchableOpacity onPress={exitEditMode}>
              <Text style={styles.editModeButton}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.editModeTitle}>
              {selectedIds.size} selected
            </Text>
            <TouchableOpacity onPress={allSelected ? deselectAll : selectAll}>
              <Text style={styles.editModeButton}>
                {allSelected ? "Deselect All" : "Select All"}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.headerLeft}>
              <Text style={styles.heading}>My Recipes</Text>
              <Text style={styles.count}>{recipes.length}</Text>
              {recipes.length > 0 ? (
                <TouchableOpacity
                  onPress={() => setEditMode(true)}
                  style={styles.editButton}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              ) : null}
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
          </>
        )}
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

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        {SORT_OPTIONS.map((opt) => {
          const isActive = sortKey === opt.key;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortPill, isActive && styles.sortPillActive]}
              onPress={() => {
                if (isActive) {
                  setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                } else {
                  setSortKey(opt.key);
                  setSortDir(opt.defaultDir);
                }
              }}
            >
              <Text
                style={[
                  styles.sortPillText,
                  isActive && styles.sortPillTextActive,
                ]}
              >
                {opt.label}
              </Text>
              {isActive && (
                <Text style={styles.sortArrow}>
                  {sortDir === "asc" ? "↑" : "↓"}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
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
    <>
      <FlatList
        style={styles.container}
        data={recipes}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <RecipeCard
            recipe={item}
            onPress={() => router.push(`/recipes/${item.id}`)}
            editMode={editMode}
            selected={selectedIds.has(item.id)}
            onToggleSelect={() => toggleSelect(item.id)}
          />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[
          styles.list,
          editMode && selectedIds.size > 0 && { paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1c1917"
          />
        }
      />

      {/* Bottom action bar */}
      {editMode && selectedIds.size > 0 ? (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => setShowBulkDeleteConfirm(true)}
          >
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.deleteButtonText}>
              Delete ({selectedIds.size})
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Bulk delete confirmation modal */}
      <Modal
        visible={showBulkDeleteConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setShowBulkDeleteConfirm(false)}
      >
        <Pressable
          style={styles.centeredModalBackdrop}
          onPress={() => !deleting && setShowBulkDeleteConfirm(false)}
        />
        <View style={styles.centeredModalWrapper} pointerEvents="box-none">
          <View style={styles.centeredModalCard}>
            <Text style={styles.centeredModalTitle}>
              Delete {selectedIds.size} recipe{selectedIds.size === 1 ? "" : "s"}
            </Text>
            <Text style={styles.centeredModalBody}>
              This cannot be undone.
            </Text>
            <View style={styles.centeredModalActions}>
              <TouchableOpacity
                style={styles.centeredModalCancel}
                onPress={() => setShowBulkDeleteConfirm(false)}
                disabled={deleting}
              >
                <Text style={styles.centeredModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.centeredModalDestructive,
                  deleting && styles.buttonDisabled,
                ]}
                onPress={handleBulkDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.centeredModalDestructiveText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
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
  editButton: {
    marginLeft: 4,
    marginTop: 4,
  },
  editButtonText: {
    fontSize: 14,
    color: "#78716c",
    fontWeight: "500",
  },
  editModeButton: {
    fontSize: 15,
    color: "#1c1917",
    fontWeight: "600",
  },
  editModeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1c1917",
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
  sortRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 6,
  },
  sortLabel: {
    fontSize: 12,
    color: "#a8a29e",
    fontWeight: "500",
    marginRight: 2,
  },
  sortPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d6d3d1",
    backgroundColor: "transparent",
  },
  sortPillActive: {
    backgroundColor: "#44403c",
    borderColor: "#44403c",
  },
  sortPillText: {
    fontSize: 11,
    color: "#78716c",
    fontWeight: "500",
  },
  sortPillTextActive: {
    color: "#fff",
  },
  sortArrow: {
    fontSize: 11,
    color: "#fff",
    marginLeft: 3,
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
  // Bottom action bar
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e7e5e4",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 32 : 16,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#b91c1c",
    borderRadius: 10,
    paddingVertical: 13,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  // Confirmation modal
  centeredModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  centeredModalWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  centeredModalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  centeredModalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1c1917",
    marginBottom: 8,
  },
  centeredModalBody: {
    fontSize: 14,
    color: "#57534e",
    lineHeight: 20,
    marginBottom: 20,
  },
  centeredModalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  centeredModalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e7e5e4",
  },
  centeredModalCancelText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#57534e",
  },
  centeredModalDestructive: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#b91c1c",
    minWidth: 70,
    alignItems: "center",
  },
  centeredModalDestructiveText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
