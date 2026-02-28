import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// In development, Next.js hot-reloads modules on every change, which would
// create a new postgres pool each time and quickly exhaust Railway's connection
// limit. Caching the client on the global object keeps a single pool alive
// across reloads. In production each worker process initialises once anyway.
declare global {
  // eslint-disable-next-line no-var
  var _pgClient: ReturnType<typeof postgres> | undefined;
}

const client =
  global._pgClient ??
  postgres(connectionString, {
    prepare: false, // required for PgBouncer / Railway transaction-mode pooling
    max: 3,         // keep the pool small — Railway Hobby allows ~20 total
  });

if (process.env.NODE_ENV !== "production") {
  global._pgClient = client;
}

export const db = drizzle(client, { schema });
