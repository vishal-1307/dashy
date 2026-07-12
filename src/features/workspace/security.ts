"use client";

/**
 * App-lock passcode handling. Only a salted PBKDF2-SHA-256 hash of the
 * passcode is ever stored — the passcode itself never leaves memory.
 */

const LOCK_STORAGE_KEY = "dashy-lock-v1";
const PBKDF2_ITERATIONS = 310_000;

type StoredLock = {
  salt: string;
  hash: string;
  iterations: number;
};

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

const fromHex = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

async function deriveHash(passcode: string, salt: Uint8Array, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passcode),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return toHex(new Uint8Array(bits));
}

function readLock(): StoredLock | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(LOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredLock;
    if (!parsed.salt || !parsed.hash || !parsed.iterations) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasPasscode() {
  return readLock() !== null;
}

export async function setPasscode(passcode: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveHash(passcode, salt, PBKDF2_ITERATIONS);
  window.localStorage.setItem(
    LOCK_STORAGE_KEY,
    JSON.stringify({ salt: toHex(salt), hash, iterations: PBKDF2_ITERATIONS } satisfies StoredLock)
  );
}

export async function verifyPasscode(passcode: string) {
  const lock = readLock();
  if (!lock) return false;
  const candidate = await deriveHash(passcode, fromHex(lock.salt), lock.iterations);
  if (candidate.length !== lock.hash.length) return false;
  // Constant-time comparison so timing doesn't leak matching prefixes.
  let mismatch = 0;
  for (let index = 0; index < candidate.length; index += 1) {
    mismatch |= candidate.charCodeAt(index) ^ lock.hash.charCodeAt(index);
  }
  return mismatch === 0;
}

export function clearPasscode() {
  window.localStorage.removeItem(LOCK_STORAGE_KEY);
}
