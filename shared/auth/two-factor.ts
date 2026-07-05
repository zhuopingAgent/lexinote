const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEFAULT_SESSION_SECONDS = 12 * 60 * 60;
const SESSION_COOKIE_VERSION = 1;
const TOTP_DIGITS = 6;
const TOTP_STEP_SECONDS = 30;
const TOTP_WINDOW = 1;
const DEFAULT_ISSUER = "LexiNote";
const DEFAULT_ACCOUNT = "lexinote-admin";

export const TWO_FACTOR_COOKIE_NAME = "lexinote_2fa";
export const TWO_FACTOR_REQUIRED_CODE = "TWO_FACTOR_REQUIRED";
export const TWO_FACTOR_REQUIRED_MESSAGE = "two-factor authentication required";

type EnvLike = Record<string, string | undefined>;

export type TwoFactorSettings = {
  cookieSecret: string;
  sessionSeconds: number;
  totpSecret: string;
};

type TwoFactorSessionPayload = {
  exp: number;
  fp: string;
  iat: number;
  v: typeof SESSION_COOKIE_VERSION;
};

function getSubtleCrypto() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is required for two-factor authentication");
  }

  return globalThis.crypto.subtle;
}

function normalizeBase32Secret(secret: string) {
  return secret.replace(/[\s=-]/g, "").toUpperCase();
}

function parseSessionSeconds(value: string | undefined) {
  if (!value) {
    return DEFAULT_SESSION_SECONDS;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_SESSION_SECONDS;
}

export function getTwoFactorSettings(
  env: EnvLike = process.env
): TwoFactorSettings | null {
  const totpSecret = normalizeBase32Secret(env.APP_TWO_FACTOR_TOTP_SECRET ?? "");

  if (!totpSecret) {
    return null;
  }

  const cookieSecret =
    env.APP_TWO_FACTOR_COOKIE_SECRET?.trim() ||
    env.APP_BASIC_AUTH_PASSWORD?.trim() ||
    totpSecret;

  return {
    cookieSecret,
    sessionSeconds: parseSessionSeconds(env.APP_TWO_FACTOR_SESSION_SECONDS),
    totpSecret,
  };
}

export function createTotpOtpAuthUri({
  account = DEFAULT_ACCOUNT,
  issuer = DEFAULT_ISSUER,
  secret,
}: {
  account?: string;
  issuer?: string;
  secret: string;
}) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    issuer,
    period: String(TOTP_STEP_SECONDS),
    secret,
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}

export function getTwoFactorSetupProfile(env: EnvLike = process.env) {
  return {
    account:
      env.APP_TWO_FACTOR_ACCOUNT_NAME?.trim() ||
      env.APP_TWO_FACTOR_ACCOUNT?.trim() ||
      DEFAULT_ACCOUNT,
    issuer: env.APP_TWO_FACTOR_ISSUER?.trim() || DEFAULT_ISSUER,
  };
}

export function verifyTwoFactorSetupToken(
  token: string | null | undefined,
  env: EnvLike = process.env
) {
  const expectedToken = env.APP_TWO_FACTOR_SETUP_TOKEN?.trim();

  return Boolean(
    expectedToken &&
      token &&
      token.length === expectedToken.length &&
      constantTimeEqual(token, expectedToken)
  );
}

export function sanitizeTwoFactorRedirect(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  try {
    const url = new URL(value, "http://lexinote.local");

    if (url.pathname === "/auth/two-factor") {
      return "/";
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

export function decodeBase32Secret(secret: string) {
  const normalized = normalizeBase32Secret(secret);
  const bytes: number[] = [];
  let bits = 0;
  let bitCount = 0;

  for (const char of normalized) {
    const value = BASE32_ALPHABET.indexOf(char);

    if (value === -1) {
      throw new Error("APP_TWO_FACTOR_TOTP_SECRET must be a base32 value");
    }

    bits = (bits << 5) | value;
    bitCount += 5;

    while (bitCount >= 8) {
      bytes.push((bits >>> (bitCount - 8)) & 0xff);
      bitCount -= 8;
      bits &= (1 << bitCount) - 1;
    }
  }

  if (bytes.length < 10) {
    throw new Error("APP_TWO_FACTOR_TOTP_SECRET must contain at least 80 bits");
  }

  return new Uint8Array(bytes);
}

function createCounterBuffer(counter: number) {
  const buffer = new Uint8Array(8);
  let value = counter;

  for (let index = buffer.length - 1; index >= 0; index -= 1) {
    buffer[index] = value & 0xff;
    value = Math.floor(value / 256);
  }

  return buffer;
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

async function hmacSha1(key: Uint8Array, data: Uint8Array) {
  const cryptoKey = await getSubtleCrypto().importKey(
    "raw",
    toArrayBuffer(key),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  const signature = await getSubtleCrypto().sign(
    "HMAC",
    cryptoKey,
    toArrayBuffer(data)
  );

  return new Uint8Array(signature);
}

async function hmacSha256(key: string, data: string) {
  const encoder = new TextEncoder();
  const cryptoKey = await getSubtleCrypto().importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await getSubtleCrypto().sign(
    "HMAC",
    cryptoKey,
    encoder.encode(data)
  );

  return new Uint8Array(signature);
}

async function sha256(value: string) {
  const digest = await getSubtleCrypto().digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return new Uint8Array(digest);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    "="
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

async function generateTotpCodeForCounter(secret: string, counter: number) {
  const key = decodeBase32Secret(secret);
  const hash = await hmacSha1(key, createCounterBuffer(counter));
  const offset = hash[hash.length - 1] & 0x0f;
  const binary =
    (((hash[offset] & 0x7f) << 24) |
      (hash[offset + 1] << 16) |
      (hash[offset + 2] << 8) |
      hash[offset + 3]) >>>
    0;

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export async function generateTotpCode(secret: string, nowMs = Date.now()) {
  const counter = Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);

  return generateTotpCodeForCounter(secret, counter);
}

export async function verifyTotpCode(
  secret: string,
  value: string,
  nowMs = Date.now()
) {
  const normalizedValue = value.replace(/\s+/gu, "");

  if (!/^\d{6}$/u.test(normalizedValue)) {
    return false;
  }

  const counter = Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS);

  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const expected = await generateTotpCodeForCounter(secret, counter + offset);

    if (constantTimeEqual(expected, normalizedValue)) {
      return true;
    }
  }

  return false;
}

async function getSecretFingerprint(secret: string) {
  return base64UrlEncode(await sha256(normalizeBase32Secret(secret)));
}

async function signSessionPayload(cookieSecret: string, payload: string) {
  return base64UrlEncode(await hmacSha256(cookieSecret, payload));
}

export async function createTwoFactorSessionCookie(
  settings: TwoFactorSettings,
  nowMs = Date.now()
) {
  const issuedAt = Math.floor(nowMs / 1000);
  const payload: TwoFactorSessionPayload = {
    exp: issuedAt + settings.sessionSeconds,
    fp: await getSecretFingerprint(settings.totpSecret),
    iat: issuedAt,
    v: SESSION_COOKIE_VERSION,
  };
  const encodedPayload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify(payload))
  );
  const signature = await signSessionPayload(
    settings.cookieSecret,
    encodedPayload
  );

  return `${encodedPayload}.${signature}`;
}

export async function verifyTwoFactorSessionCookie(
  value: string | undefined,
  settings: TwoFactorSettings,
  nowMs = Date.now()
) {
  if (!value) {
    return false;
  }

  const [encodedPayload, signature, extra] = value.split(".");

  if (!encodedPayload || !signature || extra !== undefined) {
    return false;
  }

  const expectedSignature = await signSessionPayload(
    settings.cookieSecret,
    encodedPayload
  );

  if (!constantTimeEqual(signature, expectedSignature)) {
    return false;
  }

  try {
    const payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(encodedPayload))
    ) as Partial<TwoFactorSessionPayload>;
    const nowSeconds = Math.floor(nowMs / 1000);

    if (
      payload.v !== SESSION_COOKIE_VERSION ||
      typeof payload.exp !== "number" ||
      typeof payload.fp !== "string" ||
      payload.exp <= nowSeconds
    ) {
      return false;
    }

    return payload.fp === (await getSecretFingerprint(settings.totpSecret));
  } catch {
    return false;
  }
}
