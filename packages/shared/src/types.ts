// Core domain types — mirror the database schema shapes as they arrive over JSON.

export type Ingredient = {
  raw: string;
  amount?: string;
  quantity?: number;
  unit?: string;
  name?: string;
  notes?: string;
};

export type InstructionStep = {
  step: number;
  text: string;
};

export type NutritionalInfo = {
  calories?: number;
  protein?: number;
  fat?: number;
  carbohydrates?: number;
  fiber?: number;
};

export type Author = {
  id: string;
  name: string | null;
  image: string | null;
};

export type CookLog = {
  id: string;
  recipeId: string;
  userId: string;
  cookedOn: string;
  notes: string | null;
  rating: number | null;
  createdAt: string;
};

// Full recipe row as returned by GET /api/recipes and GET /api/recipes/[id].
// Does not include author — see RecipeDetailResponse in api.ts.
export type Recipe = {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  imageUrl: string | null;
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  tags: string[];
  isPublic: boolean;
  isAdapted: boolean;
  commentsUrl: string | null;
  notes: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  nutritionalInfo: NutritionalInfo | null;
  forkedFromRecipeId: string | null;
  createdAt: string;
  updatedAt: string;
};

// ── Import / Export ─────────────────────────────────────────────────────────

export type ImportFormat = "paprika" | "mela" | "aleppo";

export type AleppoExportRecipe = {
  _exportId: string;
  title: string;
  description: string | null;
  sourceUrl: string | null;
  sourceName: string | null;
  imageUrl: string | null;
  imageData: string | null;
  ingredients: Ingredient[];
  instructions: InstructionStep[];
  tags: string[];
  isPublic: boolean;
  isAdapted: boolean;
  notes: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  nutritionalInfo: NutritionalInfo | null;
  commentsUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AleppoExportCookLog = {
  _recipeExportId: string;
  cookedOn: string;
  notes: string | null;
  rating: number | null;
  createdAt: string;
};

export type AleppoExportV1 = {
  version: 1;
  exportedAt: string;
  app: "aleppo";
  user: { name: string | null; email: string };
  recipes: AleppoExportRecipe[];
  cookLogs: AleppoExportCookLog[];
};
