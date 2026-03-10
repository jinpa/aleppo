CREATE TABLE "accounts" (
	"userId" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"providerAccountId" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_providerAccountId_pk" PRIMARY KEY("provider","providerAccountId")
);
--> statement-breakpoint
CREATE TABLE "cookLogs" (
	"id" text PRIMARY KEY NOT NULL,
	"recipeId" text NOT NULL,
	"userId" text NOT NULL,
	"cookedOn" date NOT NULL,
	"notes" text,
	"rating" smallint,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "follows" (
	"followerId" text NOT NULL,
	"followingId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "follows_followerId_followingId_pk" PRIMARY KEY("followerId","followingId")
);
--> statement-breakpoint
CREATE TABLE "recipeImports" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"recipeId" text,
	"importType" text DEFAULT 'url' NOT NULL,
	"sourceUrl" text,
	"rawPayload" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"errorMessage" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"sourceUrl" text,
	"sourceName" text,
	"imageUrl" text,
	"ingredients" jsonb DEFAULT '[]'::jsonb,
	"instructions" jsonb DEFAULT '[]'::jsonb,
	"tags" text[] DEFAULT '{}',
	"isPublic" boolean DEFAULT false NOT NULL,
	"notes" text,
	"prepTime" integer,
	"cookTime" integer,
	"servings" integer,
	"nutritionalInfo" jsonb,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sessionToken" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"emailVerified" timestamp,
	"image" text,
	"passwordHash" text,
	"bio" text,
	"isPublic" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verificationTokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verificationTokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "wantToCook" (
	"userId" text NOT NULL,
	"recipeId" text NOT NULL,
	"addedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wantToCook_userId_recipeId_pk" PRIMARY KEY("userId","recipeId")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cookLogs" ADD CONSTRAINT "cookLogs_recipeId_recipes_id_fk" FOREIGN KEY ("recipeId") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cookLogs" ADD CONSTRAINT "cookLogs_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followerId_users_id_fk" FOREIGN KEY ("followerId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_followingId_users_id_fk" FOREIGN KEY ("followingId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipeImports" ADD CONSTRAINT "recipeImports_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipeImports" ADD CONSTRAINT "recipeImports_recipeId_recipes_id_fk" FOREIGN KEY ("recipeId") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wantToCook" ADD CONSTRAINT "wantToCook_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wantToCook" ADD CONSTRAINT "wantToCook_recipeId_recipes_id_fk" FOREIGN KEY ("recipeId") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cookLogs_recipeId_idx" ON "cookLogs" USING btree ("recipeId");--> statement-breakpoint
CREATE INDEX "cookLogs_userId_idx" ON "cookLogs" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "follows_followerId_idx" ON "follows" USING btree ("followerId");--> statement-breakpoint
CREATE INDEX "follows_followingId_idx" ON "follows" USING btree ("followingId");--> statement-breakpoint
CREATE INDEX "recipes_userId_idx" ON "recipes" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "recipes_tags_idx" ON "recipes" USING btree ("tags");