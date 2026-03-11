import { useState, useEffect, useCallback } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/contexts/auth";
import { API_URL } from "@/constants/api";
import { UserAvatar } from "@/components/UserAvatar";
import { TagRow } from "@/components/TagRow";
import { formatTime } from "@/utils/format";

type UserProfile = {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  isPublic: boolean;
  recipeCount: number;
  cookCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isOwner: boolean;
};

type PublicRecipe = {
  id: string;
  title: string;
  imageUrl: string | null;
  tags: string[];
  prepTime: number | null;
  cookTime: number | null;
  isPublic: boolean;
  sourceName: string | null;
};


export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { token, user: currentUser, signOut } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recipes, setRecipes] = useState<PublicRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);

  const fetchProfile = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true);
      setError(null);
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [profileRes, recipesRes] = await Promise.all([
          fetch(`${API_URL}/api/users/${id}`, { headers }),
          fetch(`${API_URL}/api/users/${id}/recipes`, { headers }),
        ]);
        if (profileRes.status === 401 && token) {
          await signOut();
          return;
        }
        if (!profileRes.ok) throw new Error("Profile not found");
        const profileData: UserProfile = await profileRes.json();
        const recipesData: PublicRecipe[] = recipesRes.ok ? await recipesRes.json() : [];
        setProfile(profileData);
        setIsFollowing(profileData.isFollowing);
        setFollowerCount(profileData.followerCount);
        setRecipes(recipesData);
      } catch (e: any) {
        setError(e?.message ?? "Could not load profile");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id, token, signOut]
  );

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const toggleFollow = async () => {
    if (!profile || followLoading || profile.isOwner) return;
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowerCount((c) => c + (wasFollowing ? -1 : 1));
    try {
      const res = await fetch(`${API_URL}/api/follows`, {
        method: wasFollowing ? "DELETE" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ followingId: profile.id }),
      });
      if (!res.ok) {
        setIsFollowing(wasFollowing);
        setFollowerCount((c) => c + (wasFollowing ? 1 : -1));
      }
    } catch {
      setIsFollowing(wasFollowing);
      setFollowerCount((c) => c + (wasFollowing ? 1 : -1));
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1c1917" />
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error ?? "Profile not found"}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const listHeader = (
    <View>
      {/* Nav row */}
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.navButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#1c1917" />
        </TouchableOpacity>
        {profile.isOwner && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push("/settings")}
          >
            <Ionicons name="pencil-outline" size={16} color="#57534e" />
            <Text style={styles.editButtonText}>Edit profile</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Identity */}
      <View style={styles.identity}>
        <View style={{ marginBottom: 12 }}><UserAvatar name={profile.name} image={profile.image} size={80} /></View>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile.name ?? "Unknown"}</Text>
          <View style={styles.visibilityBadge}>
            <Ionicons
              name={profile.isPublic ? "globe-outline" : "lock-closed-outline"}
              size={12}
              color="#78716c"
            />
            <Text style={styles.visibilityText}>
              {profile.isPublic ? "Public" : "Private"}
            </Text>
          </View>
        </View>
        {profile.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : null}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{profile.recipeCount}</Text>
            <Text style={styles.statLabel}>Recipes</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{profile.cookCount}</Text>
            <Text style={styles.statLabel}>Cooks</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{followerCount}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{profile.followingCount}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
        </View>

        {/* Follow button */}
        {!profile.isOwner && (
          <TouchableOpacity
            style={[styles.followButton, isFollowing && styles.followButtonActive]}
            onPress={toggleFollow}
            disabled={followLoading}
          >
            {followLoading ? (
              <ActivityIndicator size="small" color={isFollowing ? "#fff" : "#1c1917"} />
            ) : (
              <>
                <Ionicons
                  name={isFollowing ? "person-remove-outline" : "person-add-outline"}
                  size={16}
                  color={isFollowing ? "#fff" : "#1c1917"}
                />
                <Text
                  style={[styles.followButtonText, isFollowing && styles.followButtonTextActive]}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Recipes header */}
      {recipes.length > 0 && (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recipes</Text>
        </View>
      )}
    </View>
  );

  const listEmpty = recipes.length === 0 ? (
    <View style={styles.emptyRecipes}>
      <Text style={styles.emptyRecipesText}>
        {profile.isOwner ? "You haven't added any recipes yet." : "No public recipes yet."}
      </Text>
    </View>
  ) : null;

  return (
    <FlatList
      style={styles.container}
      data={recipes}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={listHeader}
      ListEmptyComponent={listEmpty}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchProfile({ silent: true }); }}
          tintColor="#1c1917"
        />
      }
      renderItem={({ item }) => {
        const totalMins = (item.prepTime ?? 0) + (item.cookTime ?? 0);
        return (
          <TouchableOpacity
            style={styles.recipeCard}
            onPress={() => router.push(`/recipes/${item.id}`)}
            activeOpacity={0.7}
          >
            {item.imageUrl ? (
              <Image
                source={{ uri: item.imageUrl }}
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
              <Text style={styles.recipeTitle} numberOfLines={2}>{item.title}</Text>
              {(totalMins > 0 || item.sourceName) && (
                <View style={styles.recipeMeta}>
                  {totalMins > 0 && <Text style={styles.recipeMetaText}>{formatTime(totalMins)}</Text>}
                  {item.sourceName && <Text style={styles.recipeMetaText}>{item.sourceName}</Text>}
                </View>
              )}
              <TagRow tags={item.tags} />
            </View>
            <Ionicons name="chevron-forward" size={16} color="#d6d3d1" style={{ alignSelf: "center" }} />
          </TouchableOpacity>
        );
      }}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafaf9" },
  list: { paddingBottom: 48 },
  centered: {
    flex: 1, backgroundColor: "#fafaf9",
    justifyContent: "center", alignItems: "center", gap: 12, paddingHorizontal: 32,
  },
  errorText: { fontSize: 15, color: "#b91c1c", textAlign: "center" },
  retryButton: {
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: "#d6d3d1",
  },
  retryText: { fontSize: 14, color: "#57534e" },

  navRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingTop: Platform.OS === "ios" ? 60 : 24, paddingBottom: 8,
  },
  navButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e7e5e4",
    justifyContent: "center", alignItems: "center",
  },
  editButton: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, borderWidth: 1, borderColor: "#e7e5e4", backgroundColor: "#fff",
  },
  editButtonText: { fontSize: 14, fontWeight: "500", color: "#57534e" },

  identity: { alignItems: "center", paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  name: { fontSize: 22, fontWeight: "700", color: "#1c1917" },
  visibilityBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "#f5f5f4", borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  visibilityText: { fontSize: 11, color: "#78716c" },
  bio: { fontSize: 14, color: "#57534e", textAlign: "center", lineHeight: 20, marginBottom: 16 },

  statsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1, borderColor: "#e7e5e4",
    marginTop: 8, marginBottom: 16, paddingVertical: 12, paddingHorizontal: 8,
    width: "100%",
  },
  stat: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 18, fontWeight: "700", color: "#1c1917" },
  statLabel: { fontSize: 11, color: "#78716c", marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: "#e7e5e4" },

  followButton: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 24, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: "#e7e5e4",
    backgroundColor: "#fff", marginBottom: 8,
  },
  followButtonActive: { backgroundColor: "#1c1917", borderColor: "#1c1917" },
  followButtonText: { fontSize: 15, fontWeight: "600", color: "#1c1917" },
  followButtonTextActive: { color: "#fff" },

  sectionHeader: {
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
    borderTopWidth: 1, borderTopColor: "#e7e5e4", marginTop: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#1c1917" },

  emptyRecipes: { paddingTop: 32, alignItems: "center", paddingHorizontal: 32 },
  emptyRecipesText: { fontSize: 14, color: "#78716c", textAlign: "center" },

  recipeCard: {
    marginHorizontal: 16, backgroundColor: "#fff",
    borderRadius: 12, borderWidth: 1, borderColor: "#e7e5e4",
    flexDirection: "row", alignItems: "center", overflow: "hidden", padding: 10, gap: 10,
  },
  recipeImage: { width: 64, height: 64, borderRadius: 8 },
  recipeImagePlaceholder: {
    width: 64, height: 64, borderRadius: 8,
    backgroundColor: "#fef3c7", justifyContent: "center", alignItems: "center",
  },
  recipeBody: { flex: 1 },
  recipeTitle: { fontSize: 15, fontWeight: "600", color: "#1c1917", lineHeight: 20 },
  recipeMeta: { flexDirection: "row", gap: 8, marginTop: 2 },
  recipeMetaText: { fontSize: 11, color: "#a8a29e" },
});
