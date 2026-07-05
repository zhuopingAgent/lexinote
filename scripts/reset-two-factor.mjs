#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const DEFAULT_ACCOUNT = "lexinote-admin";
const DEFAULT_ISSUER = "LexiNote";

function base32Encode(bytes) {
  let bits = 0;
  let bitCount = 0;
  let output = "";

  for (const byte of bytes) {
    bits = (bits << 8) | byte;
    bitCount += 8;

    while (bitCount >= 5) {
      output += BASE32_ALPHABET[(bits >>> (bitCount - 5)) & 31];
      bitCount -= 5;
      bits &= (1 << bitCount) - 1;
    }
  }

  if (bitCount > 0) {
    output += BASE32_ALPHABET[(bits << (5 - bitCount)) & 31];
  }

  return output;
}

function getOptionValue(args, name, fallback) {
  const index = args.indexOf(name);

  if (index === -1) {
    return fallback;
  }

  return args[index + 1] || fallback;
}

function updateEnvFile(path, updates) {
  const existingLines = existsSync(path)
    ? readFileSync(path, "utf8").split(/\n/u)
    : [];
  const seen = new Set();
  const nextLines = existingLines.map((line) => {
    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      return line;
    }

    const key = line.slice(0, separatorIndex);

    if (!Object.hasOwn(updates, key)) {
      return line;
    }

    seen.add(key);
    return `${key}=${updates[key]}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) {
      nextLines.push(`${key}=${value}`);
    }
  }

  writeFileSync(path, nextLines.join("\n").replace(/\n*$/u, "\n"));
}

function createOtpAuthUri({ account, issuer, secret }) {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`;
  const params = new URLSearchParams({
    algorithm: "SHA1",
    digits: "6",
    issuer,
    period: "30",
    secret,
  });

  return `otpauth://totp/${label}?${params.toString()}`;
}

const args = process.argv.slice(2);
const account = getOptionValue(args, "--account", DEFAULT_ACCOUNT);
const issuer = getOptionValue(args, "--issuer", DEFAULT_ISSUER);
const shouldWriteLocal = args.includes("--write-local");
const totpSecret = base32Encode(randomBytes(20));
const cookieSecret = randomBytes(32).toString("base64url");
const setupToken = randomBytes(24).toString("base64url");
const otpAuthUri = createOtpAuthUri({ account, issuer, secret: totpSecret });
const setupPath = `/auth/two-factor/setup?token=${encodeURIComponent(
  setupToken
)}`;

if (shouldWriteLocal) {
  updateEnvFile(".env.local", {
    APP_TWO_FACTOR_COOKIE_SECRET: cookieSecret,
    APP_TWO_FACTOR_SETUP_TOKEN: setupToken,
    APP_TWO_FACTOR_TOTP_SECRET: totpSecret,
  });
}

console.log("Two-factor reset generated. Treat this output as sensitive.");
console.log("");
console.log(`APP_TWO_FACTOR_TOTP_SECRET=${totpSecret}`);
console.log(`APP_TWO_FACTOR_COOKIE_SECRET=${cookieSecret}`);
console.log(`APP_TWO_FACTOR_SETUP_TOKEN=${setupToken}`);
console.log(`otpauth=${otpAuthUri}`);
console.log(`setupPath=${setupPath}`);
console.log("");

if (shouldWriteLocal) {
  console.log("Updated .env.local with the new two-factor secrets.");
} else {
  console.log("Run with --write-local to update .env.local automatically.");
}

console.log("");
console.log(
  "For Vercel, remove old values, add the three new values, then redeploy."
);
console.log(
  "After the administrator scans the QR code and verifies a code, remove APP_TWO_FACTOR_SETUP_TOKEN and redeploy."
);
