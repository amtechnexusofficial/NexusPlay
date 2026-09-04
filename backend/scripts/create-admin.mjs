// One-time CLI to provision a platform admin account (amtechnexus staff
// only). There's no public admin sign-up by design — see auth.js's
// adminLogin() — so this is the only way to create one.
//
// Usage (run from backend/, with DATABASE_URL set to the same value as
// the Worker's DATABASE_URL secret):
//   DATABASE_URL="postgres://..." node scripts/create-admin.mjs you@amtechnexus.com "a-strong-password" "Your Name"
//
// Safe to re-run with a different email to add more admins later.

import { neon } from "@neondatabase/serverless";
import { hashPassword } from "../src/auth.js";

const [, , email, password, name] = process.argv;

if (!email || !password || !name) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> "<name>"');
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL in your environment first (same value as the Worker's DATABASE_URL secret).");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const cleanEmail = email.trim().toLowerCase();

const [existing] = await sql`select id from users where email = ${cleanEmail}`;
if (existing) {
  console.error(`A user with email ${cleanEmail} already exists.`);
  process.exit(1);
}

const passwordHash = await hashPassword(password);
const [user] = await sql`
  insert into users (email, password_hash, name, role)
  values (${cleanEmail}, ${passwordHash}, ${name.trim()}, 'admin')
  returning id, email, name
`;

console.log("Admin account created:", user);
console.log("Sign in at: <your Pages URL>/?admin=1");
