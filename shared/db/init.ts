import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "@/shared/db/pool";

let initPromise: Promise<void> | null = null;
let databaseSqlPromise: Promise<[string, string]> | null = null;

function parseBooleanEnv(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
}

export function shouldAutoInitializeDatabase(
  env: Record<string, string | undefined> = process.env
) {
  const explicitSetting = parseBooleanEnv(env.DATABASE_AUTO_INIT);
  if (explicitSetting !== null) {
    return explicitSetting;
  }

  return env.NODE_ENV !== "production" && !env.VERCEL;
}

async function loadDatabaseSql() {
  if (!databaseSqlPromise) {
    const schemaPath = path.join(process.cwd(), "shared/db/sql/schema.sql");
    const grammarContentPath = path.join(
      process.cwd(),
      "shared/db/sql/grammar-content.sql"
    );
    databaseSqlPromise = Promise.all([
      readFile(schemaPath, "utf8"),
      readFile(grammarContentPath, "utf8"),
    ]).catch((error) => {
      databaseSqlPromise = null;
      throw error;
    });
  }

  return databaseSqlPromise;
}

async function initializeDatabase() {
  const pool = await getPool();
  const [schemaSql, grammarContentSql] = await loadDatabaseSql();
  await pool.query(schemaSql);
  await pool.query(grammarContentSql);
}

export async function ensureDatabaseReady() {
  if (!shouldAutoInitializeDatabase()) {
    return;
  }

  if (!initPromise) {
    initPromise = initializeDatabase().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
}
