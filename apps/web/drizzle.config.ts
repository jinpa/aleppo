import type { Config } from "drizzle-kit";
import { config } from "dotenv";
import { expand } from "dotenv-expand";

// Load .env.local for local dev. On Railway, DATABASE_URL is set in the
// environment directly — dotenv will silently skip missing files.
expand(config({ path: ".env.local", override: false }));
expand(config({ path: ".env", override: false }));

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set.\n" +
    "Local: add it to .env.local (see .env.example)\n" +
    "Railway: add it in the project Variables tab"
  );
}

export default {
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config;
