ALTER TABLE "recipes" ADD COLUMN "images" jsonb DEFAULT '[]'::jsonb;

-- Backfill: wrap existing imageUrl into images array
UPDATE recipes SET images = jsonb_build_array(jsonb_build_object('url', "imageUrl"))
WHERE "imageUrl" IS NOT NULL AND (images IS NULL OR images = '[]'::jsonb);