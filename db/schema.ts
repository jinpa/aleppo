import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  smallint,
  jsonb,
  date,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Auth.js required tables ────────────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
  // Extended profile
  passwordHash: text("passwordHash"),
  bio: text("bio"),
  isPublic: boolean("isPublic").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  })
);

export const sessions = pgTable("sessions", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationTokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  })
);

// ─── Password Reset Tokens ────────────────────────────────────────────────────

export const passwordResetTokens = pgTable("passwordResetTokens", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expires: timestamp("expires", { mode: "date" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Ingredient type ─────────────────────────────────────────────────────────

export type Ingredient = {
  raw: string;
  amount?: string;
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

// ─── Recipes ─────────────────────────────────────────────────────────────────

export const recipes = pgTable(
  "recipes",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    sourceUrl: text("sourceUrl"),
    sourceName: text("sourceName"),
    imageUrl: text("imageUrl"),
    ingredients: jsonb("ingredients").$type<Ingredient[]>().default([]),
    instructions: jsonb("instructions").$type<InstructionStep[]>().default([]),
    tags: text("tags").array().default([]),
    isPublic: boolean("isPublic").default(false).notNull(),
    notes: text("notes"),
    prepTime: integer("prepTime"),
    cookTime: integer("cookTime"),
    servings: integer("servings"),
    nutritionalInfo: jsonb("nutritionalInfo").$type<NutritionalInfo>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("recipes_userId_idx").on(table.userId),
    tagsIdx: index("recipes_tags_idx").on(table.tags),
  })
);

// ─── Cook Logs ───────────────────────────────────────────────────────────────

export const cookLogs = pgTable(
  "cookLogs",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    recipeId: text("recipeId")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cookedOn: date("cookedOn").notNull(),
    notes: text("notes"),
    rating: smallint("rating"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    recipeIdIdx: index("cookLogs_recipeId_idx").on(table.recipeId),
    userIdIdx: index("cookLogs_userId_idx").on(table.userId),
  })
);

// ─── Want to Cook Queue ───────────────────────────────────────────────────────

export const wantToCook = pgTable(
  "wantToCook",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    recipeId: text("recipeId")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    addedAt: timestamp("addedAt").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.recipeId] }),
  })
);

// ─── Follows ─────────────────────────────────────────────────────────────────

export const follows = pgTable(
  "follows",
  {
    followerId: text("followerId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("followingId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.followerId, table.followingId] }),
    followerIdx: index("follows_followerId_idx").on(table.followerId),
    followingIdx: index("follows_followingId_idx").on(table.followingId),
  })
);

// ─── Recipe Imports ───────────────────────────────────────────────────────────

export const recipeImports = pgTable("recipeImports", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  recipeId: text("recipeId").references(() => recipes.id, {
    onDelete: "set null",
  }),
  importType: text("importType").notNull().default("url"),
  sourceUrl: text("sourceUrl"),
  rawPayload: jsonb("rawPayload"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  recipes: many(recipes),
  cookLogs: many(cookLogs),
  wantToCook: many(wantToCook),
  following: many(follows, { relationName: "follower" }),
  followers: many(follows, { relationName: "following" }),
}));

export const recipesRelations = relations(recipes, ({ one, many }) => ({
  user: one(users, { fields: [recipes.userId], references: [users.id] }),
  cookLogs: many(cookLogs),
  wantToCook: many(wantToCook),
  imports: many(recipeImports),
}));

export const cookLogsRelations = relations(cookLogs, ({ one }) => ({
  recipe: one(recipes, {
    fields: [cookLogs.recipeId],
    references: [recipes.id],
  }),
  user: one(users, { fields: [cookLogs.userId], references: [users.id] }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: "follower",
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: "following",
  }),
}));
