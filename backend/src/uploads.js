import { httpError } from "./errors.js";
import { getDb } from "./db.js";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB — venue/court photos run larger than a logo

// Generic image upload used for venue photos, court photos, and owner
// branding assets — one R2 bucket, keyed by uploader's user id.
export async function uploadImage(c) {
  if (!c.env.MEDIA) throw httpError(500, "MEDIA R2 bucket is not bound. See wrangler.toml.");
  const user = c.get("user");

  const body = await c.req.parseBody();
  const file = body.file;
  if (!file || typeof file === "string") throw httpError(400, "Attach a file under the 'file' field");
  if (!ALLOWED_TYPES.has(file.type)) throw httpError(400, "Logo must be PNG, JPEG, WEBP or SVG");
  if (file.size > MAX_BYTES) throw httpError(400, "Logo must be under 3MB");

  const ext = file.type.split("/")[1].replace("svg+xml", "svg");
  const key = `${user.sub}/${crypto.randomUUID()}.${ext}`;

  await c.env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const origin = new URL(c.req.url).origin;
  return { url: `${origin}/api/uploads/${key}` };
}

// Guest payment-screenshot upload — only allowed while the booking is still
// in pending_payment (the 10-minute hold). Stored under a proof/ key so
// owner UPI audit can open the image.
export async function uploadPaymentProof(c) {
  if (!c.env.MEDIA) throw httpError(500, "MEDIA R2 bucket is not bound. See wrangler.toml.");
  const sql = getDb(c.env);

  const body = await c.req.parseBody();
  const file = body.file;
  const bookingId = typeof body.bookingId === "string" ? body.bookingId.trim() : "";
  if (!bookingId) throw httpError(400, "bookingId is required");
  if (!file || typeof file === "string") throw httpError(400, "Attach a payment screenshot under the 'file' field");
  if (!ALLOWED_TYPES.has(file.type) || file.type === "image/svg+xml") {
    throw httpError(400, "Screenshot must be PNG, JPEG or WEBP");
  }
  if (file.size > MAX_BYTES) throw httpError(400, "Screenshot must be under 5MB");

  const [booking] = await sql`
    select id, status from bookings where id = ${bookingId}
  `;
  if (!booking) throw httpError(404, "Booking not found");
  if (booking.status !== "pending_payment") {
    throw httpError(409, "This booking is no longer awaiting payment proof");
  }

  const ext = file.type.split("/")[1];
  const key = `payment-proofs/${bookingId}/${crypto.randomUUID()}.${ext}`;

  await c.env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const origin = new URL(c.req.url).origin;
  return { url: `${origin}/api/uploads/${key}`, bookingId };
}

export async function serveUpload(c, key) {
  if (!c.env.MEDIA) throw httpError(500, "MEDIA R2 bucket is not bound.");
  const obj = await c.env.MEDIA.get(key);
  if (!obj) throw httpError(404, "Not found");
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
