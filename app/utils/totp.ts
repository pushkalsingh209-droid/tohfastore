// app/utils/totp.ts
// RFC 6238 TOTP (the 6-digit codes an authenticator app like Google
// Authenticator/Authy shows), implemented directly on Node's crypto instead
// of pulling in a dependency -- proxy.ts and the login route both run on the
// Node.js runtime, so `crypto` is always available there.
import crypto from "crypto";

const STEP_SECONDS = 30;
const DIGITS = 6;
const DEFAULT_WINDOW = 1; // accept the previous/next 30s step to absorb clock drift

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function hotp(secret: Buffer, counter: number): string {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", secret).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binCode % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Checks a 6-digit code against the current 30s step and, by default, the
// step immediately before/after it -- so a code doesn't get rejected just
// because the admin's phone clock or the server clock is a few seconds off.
export function verifyTOTP(
  base32Secret: string,
  token: string,
  opts?: { window?: number; timestamp?: number }
): boolean {
  const cleanToken = token.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(cleanToken)) return false;
  if (!base32Secret) return false;

  const window = opts?.window ?? DEFAULT_WINDOW;
  const timestamp = opts?.timestamp ?? Date.now();
  const secretBuf = base32Decode(base32Secret);
  const counter = Math.floor(timestamp / 1000 / STEP_SECONDS);

  for (let errorWindow = -window; errorWindow <= window; errorWindow++) {
    const candidate = hotp(secretBuf, counter + errorWindow);
    if (timingSafeEqualStr(candidate, cleanToken)) return true;
  }
  return false;
}

// Only used by the one-off secret-provisioning script, not at request time.
export function generateTOTP(base32Secret: string, timestamp = Date.now()): string {
  const counter = Math.floor(timestamp / 1000 / STEP_SECONDS);
  return hotp(base32Decode(base32Secret), counter);
}
