export const OWNER_PROFILE = {
  name: 'DirectorMira',
  email: 'netcity888netcity@gmail.com',
  role: 'Owner Architect',
} as const;

const CREDENTIAL_KEY = 'kvp.owner.credential.v1';
const encoder = new TextEncoder();

interface StoredCredential {
  salt: string;
  hash: string;
}

const bytesToBase64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes));

const base64ToBytes = (value: string) =>
  Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 210_000 },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export function hasOwnerCredential() {
  return localStorage.getItem(CREDENTIAL_KEY) !== null;
}

export async function initializeOwnerPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(password, salt);
  localStorage.setItem(
    CREDENTIAL_KEY,
    JSON.stringify({ salt: bytesToBase64(salt), hash: bytesToBase64(hash) }),
  );
}

export async function verifyOwnerPassword(password: string) {
  const raw = localStorage.getItem(CREDENTIAL_KEY);
  if (!raw) return false;
  const credential = JSON.parse(raw) as StoredCredential;
  const actual = await derive(password, base64ToBytes(credential.salt));
  const expected = base64ToBytes(credential.hash);
  if (actual.length !== expected.length) return false;
  return actual.every((byte, index) => byte === expected[index]);
}
