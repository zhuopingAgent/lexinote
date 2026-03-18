import { ensureDatabaseReady } from "@/shared/db/init";
import { getPool } from "@/shared/db/pool";

export async function query<T = unknown>(
  text: string,
  values: readonly unknown[] = []
): Promise<T[]> {
  await ensureDatabaseReady();
  const pool = await getPool();
  const result = await pool.query<T>(text, values);
  return result.rows;
}
