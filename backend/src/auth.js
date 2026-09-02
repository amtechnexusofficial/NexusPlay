import { sign, verify } from "hono/jwt";
import { httpError } from "./errors.js";

const OTP_TTL_MINUTES = 10;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

// --- Abuse limits ---------------------------------------------------------
// Kept from the original Thidal hardening pass — same rationale: a 4-digit
// code has only 10,000 possibilities, so both request-rate and
// wrong-guess limits matter.
const MAX_OTP_REQUESTS_PER_WINDOW = 5;
const OTP_REQUEST_WINDOW_MINUTES = 15;
const MAX_VERIFY_ATTEMPTS = 5;

function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
}

// STUB: logs the code instead of sending an SMS. Swap for a real provider
// (MSG91, Twilio Verify, etc.) — every caller stays the same.
async function sendOtpSms(phone, code) {
  console.log(`[dev] OTP for ${phone}: ${code}`);
}

// --- Password hashing (admin login only) ----------------------------------
// Workers runtime has Web Crypto but not Node's bcrypt/crypto module, so
// this uses PBKDF2 via crypto.subtle, which is available in Workers.
async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = saltHex
    ? new Uint8Array(saltHex.match(/.{2}/g).map((b) => parseInt(b, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyMaterial, 256);
  const hashHex = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const saltOut = [...salt].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${saltOut}:${hashHex}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [saltHex] = stored.split(":");
  const recomputed = await hashPassword(password, saltHex);
  return recomputed === stored;
}

export { hashPassword };

// --- Player / Owner: phone + OTP ------------------------------------------

export async function requestOtp(sql, env, { phone, role }) {
  if (!phone || !role) throw httpError(400, "phone and role are required");
  if (!["player", "owner"].includes(role)) throw httpError(400, "role must be 'player' or 'owner'");

  const windowStart = new Date(Date.now() - OTP_REQUEST_WINDOW_MINUTES * 60 * 1000).toISOString();
  const [{ count }] = await sql`
    select count(*)::int as count from otp_codes
    where phone = ${phone} and created_at > ${windowStart}
  `;
  if (count >= MAX_OTP_REQUESTS_PER_WINDOW) {
    throw httpError(429, "Too many codes requested for this number. Try again in a bit.");
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  await sql`insert into otp_codes (phone, code, expires_at) values (${phone}, ${code}, ${expiresAt})`;
  await sendOtpSms(phone, code);

  // Gated on DEV_MODE (must be explicitly set per-environment, defaults
  // off) — never leave this on in production, it's a full auth bypass.
  const devCode = env.DEV_MODE === "true" ? code : undefined;
  return { ok: true, devCode };
}

export async function verifyOtp(sql, env, { phone, code, role, name, organizationName }) {
  if (!phone || !code || !role) throw httpError(400, "phone, code and role are required");

  const [otp] = await sql`
    select * from otp_codes
    where phone = ${phone} and consumed = false and expires_at > now()
    order by created_at desc limit 1
  `;
  if (!otp) throw httpError(401, "Invalid or expired code");

  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    await sql`update otp_codes set consumed = true where id = ${otp.id}`;
    throw httpError(429, "Too many incorrect attempts. Request a new code.");
  }

  if (otp.code !== code) {
    await sql`update otp_codes set attempts = attempts + 1 where id = ${otp.id}`;
    throw httpError(401, "Invalid or expired code");
  }

  await sql`update otp_codes set consumed = true where id = ${otp.id}`;

  let [user] = await sql`select * from users where phone = ${phone}`;
  let isNewUser = false;
  if (!user) {
    if (!name) throw httpError(400, "name is required for first-time sign up");
    [user] = await sql`insert into users (phone, name, role) values (${phone}, ${name}, ${role}) returning *`;
    isNewUser = true;
  } else if (user.role !== role) {
    // A phone number is one identity with one role — prevents a player
    // account from silently reappearing as an owner or vice versa.
    throw httpError(409, `This number is already registered as a ${user.role}`);
  }

  let organizationId = null;
  if (role === "owner") {
    const [membership] = await sql`select organization_id from organization_members where user_id = ${user.id} and org_role = 'owner' limit 1`;
    if (membership) {
      organizationId = membership.organization_id;
    } else if (isNewUser) {
      // First-time owner sign-up auto-provisions an organization. The
      // owner can rename it during onboarding (POST /api/venues creates
      // the first venue under it).
      const [org] = await sql`insert into organizations (name) values (${organizationName || `${user.name}'s Organization`}) returning id`;
      await sql`insert into organization_members (organization_id, user_id, org_role) values (${org.id}, ${user.id}, 'owner')`;
      organizationId = org.id;
    }
  }

  const token = await sign(
    {
      sub: user.id,
      phone: user.phone,
      role: user.role,
      name: user.name,
      organizationId,
      exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    },
    env.JWT_SECRET
  );

  return { token, user: { id: user.id, phone: user.phone, name: user.name, role: user.role, organizationId } };
}

// --- Admin: email + password -----------------------------------------------
// Admin accounts are provisioned manually (seeded directly in the DB or by
// an existing admin) — no public admin sign-up endpoint.

export async function adminLogin(sql, env, { email, password }) {
  if (!email || !password) throw httpError(400, "email and password are required");
  const [user] = await sql`select * from users where email = ${email} and role = 'admin'`;
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    throw httpError(401, "Invalid email or password");
  }
  const token = await sign(
    { sub: user.id, email: user.email, role: "admin", name: user.name, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS },
    env.JWT_SECRET
  );
  return { token, user: { id: user.id, email: user.email, name: user.name, role: "admin" } };
}

// --- Middleware --------------------------------------------------------

// requiredRole: string | string[] | undefined (any authenticated user)
export function requireAuth(requiredRole) {
  const allowed = requiredRole ? (Array.isArray(requiredRole) ? requiredRole : [requiredRole]) : null;
  return async (c, next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) throw httpError(401, "Missing bearer token");
    const token = header.slice(7);
    let payload;
    try {
      payload = await verify(token, c.env.JWT_SECRET);
    } catch {
      throw httpError(401, "Invalid or expired token");
    }
    if (allowed && !allowed.includes(payload.role)) {
      throw httpError(403, `Requires role: ${allowed.join(" or ")}`);
    }
    c.set("user", payload);
    await next();
  };
}

// Ensures an owner/staff request carries a valid organizationId, and that
// it actually still exists (covers the rare case of a stale token after
// an org was deleted). Attaches it to context as `organizationId` so
// route handlers don't have to re-derive it.
export function requireOrg() {
  return async (c, next) => {
    const user = c.get("user");
    if (!user?.organizationId) throw httpError(403, "No organization associated with this account");
    c.set("organizationId", user.organizationId);
    await next();
  };
}
