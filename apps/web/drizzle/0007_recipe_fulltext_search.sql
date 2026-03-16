-- Add tsvector column for full-text recipe search
ALTER TABLE "recipes" ADD COLUMN "search_tsv" tsvector;

-- Trigger function: builds weighted tsvector from title, description, ingredients, instructions, notes
CREATE OR REPLACE FUNCTION recipes_search_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW."search_tsv" :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(
      (SELECT string_agg(elem->>'raw', ' ')
       FROM jsonb_array_elements(coalesce(NEW.ingredients, '[]'::jsonb)) AS elem),
      ''
    )), 'B') ||
    setweight(to_tsvector('english', coalesce(
      (SELECT string_agg(elem->>'text', ' ')
       FROM jsonb_array_elements(coalesce(NEW.instructions, '[]'::jsonb)) AS elem),
      ''
    )), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.notes, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Attach trigger
CREATE TRIGGER recipes_search_tsv_update
  BEFORE INSERT OR UPDATE ON "recipes"
  FOR EACH ROW
  EXECUTE FUNCTION recipes_search_tsv_trigger();

-- Backfill existing rows (no-op update fires the trigger)
UPDATE "recipes" SET "updatedAt" = "updatedAt";

-- GIN index for fast full-text queries
CREATE INDEX "recipes_search_tsv_idx" ON "recipes" USING gin ("search_tsv");
