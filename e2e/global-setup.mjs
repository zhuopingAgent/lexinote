import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");
const { loadEnvConfig } = require("@next/env");

function resolveTestDatabaseUrl() {
  const connectionString = process.env.E2E_DATABASE_URL;
  if (!connectionString) {
    throw new Error("E2E_DATABASE_URL is required for Playwright E2E tests.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new Error("E2E_DATABASE_URL must be a valid PostgreSQL connection string.");
  }

  if (!["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
    throw new Error("E2E_DATABASE_URL must point to a local PostgreSQL instance.");
  }

  const databaseName = parsedUrl.pathname.replace(/^\//, "");
  if (!/_((e2e)|(test))$/.test(databaseName)) {
    throw new Error(
      "E2E_DATABASE_URL database name must end with '_e2e' or '_test'."
    );
  }

  return connectionString;
}

function stripPsqlInclude(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("\\i "))
    .join("\n")
    .trim();
}

export default async function globalSetup() {
  loadEnvConfig(process.cwd());

  const connectionString = resolveTestDatabaseUrl();
  const pool = new Pool({ connectionString, max: 1 });

  try {
    const schemaPath = path.join(process.cwd(), "shared/db/sql/schema.sql");
    const seedPath = path.join(process.cwd(), "shared/db/sql/seed.sql");
    const [schemaSql, rawSeedSql] = await Promise.all([
      readFile(schemaPath, "utf8"),
      readFile(seedPath, "utf8"),
    ]);

    await pool.query(schemaSql);
    await pool.query(stripPsqlInclude(rawSeedSql));
  } finally {
    await pool.end();
  }
}
