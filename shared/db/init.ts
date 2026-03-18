import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPool } from "@/shared/db/pool";

let initPromise: Promise<void> | null = null;
let schemaSqlPromise: Promise<string> | null = null;

async function loadSchemaSql() {
  if (!schemaSqlPromise) {
    const schemaPath = path.join(process.cwd(), "shared/db/sql/schema.sql");
    schemaSqlPromise = readFile(schemaPath, "utf8").catch((error) => {
      schemaSqlPromise = null;
      throw error;
    });
  }

  return schemaSqlPromise;
}

async function initializeDatabase() {
  const pool = await getPool();
  const schemaSql = await loadSchemaSql();
  await pool.query(schemaSql);
}

export async function ensureDatabaseReady() {
  if (!initPromise) {
    initPromise = initializeDatabase().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
}
