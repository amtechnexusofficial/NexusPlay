import { neon } from "@neondatabase/serverless";

// Creates a fresh tagged-template SQL client per request.
// Neon's serverless driver is HTTP-based, so it's safe and fast
// to create per-invocation in a Worker (no persistent connections).
export function getDb(env) {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Run: wrangler secret put DATABASE_URL"
    );
  }
  return neon(env.DATABASE_URL);
}
