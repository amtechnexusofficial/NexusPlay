/**
 * Local round-trip check for the hand-rolled HS256 helpers in auth.js.
 * Run: npm run test:jwt  (from backend/)
 *
 * Does not import auth.js directly (that pulls Workers-only env patterns);
 * it mirrors the same Web Crypto steps so a broken runtime/encoding shows
 * up here before you redeploy.
 */
import { webcrypto } from "node:crypto";

const crypto = webcrypto;

function base64UrlEncodeBytes(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return Buffer.from(str, "binary").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecodeToBytes(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return new Uint8Array(Buffer.from(str, "base64"));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function signToken(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const encodedHeader = base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

async function verifyToken(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecodeToBytes(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );
  if (!valid) throw new Error("Signature mismatch");
  return JSON.parse(new TextDecoder().decode(base64UrlDecodeToBytes(encodedPayload)));
}

const secret = "test-secret-at-least-16-chars";
const token = await signToken(
  { sub: "user-1", role: "owner", organizationId: "org-1", exp: Math.floor(Date.now() / 1000) + 3600 },
  secret
);
const payload = await verifyToken(token, secret);
if (payload.role !== "owner") throw new Error("payload mismatch");

let rejected = false;
try {
  await verifyToken(token, "wrong-secret-xxxxxx");
} catch {
  rejected = true;
}
if (!rejected) throw new Error("wrong secret was accepted");

console.log("ok — HS256 sign/verify round-trip passed");
console.log("sample token length:", token.length);
