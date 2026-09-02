import { sign, verify } from "hono/jwt";
import { httpError } from "./services/pooling.js";

const OTP_TTL_MINUTES = 10;
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function generateCode() {
  return String(Math.floor(1000 + Math.random() * 9000)); // 4-digit
}

// --- OTP -------------------------------------------------------------
// STUB: logs the code instead of sending an SMS. Swap this function's
// body for a real provider (MSG91, Twilio Verify, etc.) — everything
// that calls it stays the same.
async function sendOtpSms(phone, code) {
  console.log(`[dev] OTP for ${phone}: ${code}`);
}

export async function requestOtp(sql, env, { phone, role }) {
  if (!phone || !role) throw httpError(400, "phone and role are required");
  if (!["player", "owner"].includes(role)) throw httpError(400, "role must be 'player' or 'owner'");

  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  await sql`insert into otp_codes (phone, code, expires_at) values (${phone}, ${code}, ${expiresAt})`;
  await sendOtpSms(phone, code);

  // In dev, hand the code back so you can test without a real SMS provider wired up.
  // Remove this in production once sendOtpSms actually sends something.
  const devCode = env.DEV_MODE === "true" ? code : undefined;
  return { ok: true, devCode };
}

export async function verifyOtp(sql, env, { phone, code, role, name }) {
  if (!phone || !code || !role) throw httpError(400, "phone, code and role are required");

  const [otp] = await sql`
    select * from otp_codes
    where phone = ${phone} and code = ${code} and consumed = false and expires_at > now()
    order by created_at desc limit 1
  `;
  if (!otp) throw httpError(401, "Invalid or expired code");

  await sql`update otp_codes set consumed = true where id = ${otp.id}`;

  let [user] = await sql`select * from users where phone = ${phone}`;
  if (!user) {
    if (!name) throw httpError(400, "name is required for first-time sign up");
    [user] = await sql`insert into users (phone, name, role) values (${phone}, ${name}, ${role}) returning *`;
  }

  const token = await sign(
    { sub: user.id, phone: user.phone, role: user.role, name: user.name, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS },
    env.JWT_SECRET
  );

  return { token, user: { id: user.id, phone: user.phone, name: user.name, role: user.role } };
}

// --- middleware --------------------------------------------------------
export function requireAuth(requiredRole) {
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
    if (requiredRole && payload.role !== requiredRole) throw httpError(403, `Requires ${requiredRole} role`);
    c.set("user", payload);
    await next();
  };
}
