ALTER TABLE "users" ADD COLUMN "defaultTagsEnabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "defaultRecipeIsPublic" boolean DEFAULT false NOT NULL;