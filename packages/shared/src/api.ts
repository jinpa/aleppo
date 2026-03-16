// API response types — one type per endpoint (or per HTTP method where the shape differs).
// Endpoint paths are noted above each type.

import type { Author, CookLog, Recipe } from "./types";

// ─── Shared ───────────────────────────────────────────────────────────────────

// DELETE /api/recipes/[id]
// DELETE /api/cook-logs/[id]
// POST   /api/follows, DELETE /api/follows
// POST   /api/queue, PATCH /api/queue, DELETE /api/queue
// PATCH  /api/users/me
export type SuccessResponse = { success: true };

// ─── Recipes ─────────────────────────────────────────────────────────────────
// Provides access to the full data about a recipe.

// GET    /api/recipes       → Recipe[]
// GET    /api/recipes/[id]  → Recipe
// POST   /api/recipes       → Recipe  (201)
// PATCH  /api/recipes/[id]  → Recipe
export type { Recipe };

// GET /api/recipes/[id]/detail
export type RecipeDetailResponse = {
  recipe: Recipe & { author: Author };
  cookLogs: CookLog[];
  cookCount: number;
  inQueue: boolean;
  isOwner: boolean;
  forkedFrom: { recipeId: string; recipeTitle: string } | null;
};

// ─── Cook logs ────────────────────────────────────────────────────────────────

// POST /api/cook-logs → CookLog (201)
export type { CookLog };

// ─── Feed ─────────────────────────────────────────────────────────────────────

// GET /api/feed → FeedResponse
export type FeedItem = {
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

export type FollowedUser = {
  id: string;
  name: string | null;
  image: string | null;
};

export type FeedResponse = {
  items: FeedItem[];
  following: FollowedUser[];
};

// ─── Queue ────────────────────────────────────────────────────────────────────

// GET /api/queue → QueueItem[]
export type QueueItem = {
  recipe: Recipe;
  addedAt: string;
};

// ─── Users ────────────────────────────────────────────────────────────────────

// GET /api/users/me → UserSettings
export type UserSettings = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  bio: string | null;
  isPublic: boolean;
  defaultTagsEnabled: boolean;
  defaultRecipeIsPublic: boolean;
  createdAt: string;
  hasPassword: boolean;
  notifyOnNewFollower: boolean;
};

// GET /api/users/[id] → UserProfile
export type UserProfile = {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  isPublic: boolean;
  createdAt: string;
  recipeCount: number;
  cookCount: number;
  followerCount: number;
  followingCount: number;
  isFollowing: boolean;
  isOwner: boolean;
};

// GET /api/users/[id]/recipes → RecipeSummary[]
// Subset of Recipe attributes needed for a summary page.
export type RecipeSummary = {
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

// GET /api/users/search → UserSearchResult[]
export type UserSearchResult = {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  isFollowing: boolean;
  isSelf: boolean;
};

// ─── Notifications ───────────────────────────────────────────────────────────

export type Notification = {
  id: string;
  type: string;
  read: boolean;
  createdAt: string;
  actor: {
    id: string;
    name: string | null;
    image: string | null;
    isPublic: boolean;
  } | null;
};

export type NotificationsResponse = {
  notifications: Notification[];
  unreadCount: number;
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

// POST /api/auth/mobile/credentials → AuthResponse
export type AuthResponse = {
  token: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  };
};

// ─── Import ───────────────────────────────────────────────────────────────────

// POST /api/import → ImportResponse
// ScrapedRecipe is a partial shape — fields are optional because parsing may be incomplete.
// instructions have no step number yet; that is assigned when the user saves the recipe.
export type ScrapedRecipe = {
  title?: string;
  description?: string;
  ingredients?: { raw: string }[];
  instructions?: { text: string }[];
  tags?: string[];
  prepTime?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  sourceUrl?: string;
  sourceName?: string;
  imageUrl?: string;
};

export type ImportResponse = {
  importId: string;
  recipe: ScrapedRecipe | null;
  parseError: string | null;
  commentsUrl: string | null;
};
