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

export default async function globalSetup() {
  loadEnvConfig(process.cwd());

  const connectionString = resolveTestDatabaseUrl();
  const pool = new Pool({ connectionString, max: 1 });

  try {
    const schemaPath = path.join(process.cwd(), "shared/db/sql/schema.sql");
    const fixturesPath = path.join(process.cwd(), "e2e/fixtures.sql");
    const [schemaSql, fixturesSql] = await Promise.all([
      readFile(schemaPath, "utf8"),
      readFile(fixturesPath, "utf8"),
    ]);

    await pool.query(schemaSql);
    await pool.query(`
      TRUNCATE TABLE
        auto_filter_jobs,
        collection_words,
        collections,
        japanese_dictionary_entries
      RESTART IDENTITY CASCADE
    `);
    await pool.query(fixturesSql);
  } finally {
    await pool.end();
  }
}
