import { httpError } from "./services/pooling.js";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const MAX_BYTES = 3 * 1024 * 1024; // 3MB

export async function uploadLogo(c) {
  if (!c.env.LOGOS) throw httpError(500, "LOGOS R2 bucket is not bound. See wrangler.toml.");
  const user = c.get("user");

  const body = await c.req.parseBody();
  const file = body.logo;
  if (!file || typeof file === "string") throw httpError(400, "Attach a file under the 'logo' field");
  if (!ALLOWED_TYPES.has(file.type)) throw httpError(400, "Logo must be PNG, JPEG, WEBP or SVG");
  if (file.size > MAX_BYTES) throw httpError(400, "Logo must be under 3MB");

  const ext = file.type.split("/")[1].replace("svg+xml", "svg");
  const key = `${user.sub}/${crypto.randomUUID()}.${ext}`;

  await c.env.LOGOS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const origin = new URL(c.req.url).origin;
  return { url: `${origin}/api/uploads/${key}` };
}

export async function serveUpload(c, key) {
  if (!c.env.LOGOS) throw httpError(500, "LOGOS R2 bucket is not bound.");
  const obj = await c.env.LOGOS.get(key);
  if (!obj) throw httpError(404, "Not found");
  return new Response(obj.body, {
    headers: {
      "Content-Type": obj.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
