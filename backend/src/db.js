import { neon, Pool } from "@neondatabase/serverless";

// Creates a fresh tagged-template SQL client per request.
// Neon's HTTP driver is stateless/fetch-based, so it's safe and fast
// to create per-invocation in a Worker (no persistent connections).
// Use this for simple reads/writes that don't need to be atomic with
// anything else.
export function getDb(env) {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Run: wrangler secret put DATABASE_URL"
    );
  }
  return neon(env.DATABASE_URL);
}

// --- Transactions -------------------------------------------------------
// The plain `neon()` tagged-template client above talks HTTP, one
// request per query — there's no way to hold a row lock across two
// separate queries with it. For operations where we must read a row,
// decide something, and write it back without another request sneaking
// in between (booking a slot, joining a pool, refunding, etc.), we need
// a real session: BEGIN ... SELECT ... FOR UPDATE ... COMMIT.
//
// @neondatabase/serverless's Pool gives us that over a WebSocket, which
// works fine inside Cloudflare Workers.
//
// Usage:
//   await withTransaction(env, async (client) => {
//     const { rows } = await client.query(
//       "select * from slots where id = $1 for update",
//       [slotId]
//     );
//     ...
//     await client.query("update slots set status = $1 where id = $2", [status, slotId]);
//   });
//
// Note: this client uses node-postgres-style `client.query(text, params)`
// with $1/$2 placeholders, NOT the `sql\`...\`` tagged-template syntax
// used by getDb(). Don't mix the two calling conventions on the same client.
let pool;
function getPool(env) {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Run: wrangler secret put DATABASE_URL"
    );
  }
  if (!pool) {
    pool = new Pool({ connectionString: env.DATABASE_URL });
  }
  return pool;
}

export async function withTransaction(env, fn) {
  const client = await getPool(env).connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      // ignore rollback errors, surface the original error below
    }
    throw err;
  } finally {
    client.release();
  }
}
