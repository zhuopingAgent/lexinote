import { ensureDatabaseReady } from "@/shared/db/init";
import { getPool, type PgClient } from "@/shared/db/pool";

export async function query<T = unknown>(
  text: string,
  values: readonly unknown[] = []
): Promise<T[]> {
  await ensureDatabaseReady();
  const pool = await getPool();
  const result = await pool.query<T>(text, values);
  return result.rows;
}

export async function withTransaction<T>(
  operation: (client: PgClient) => Promise<T>
): Promise<T> {
  await ensureDatabaseReady();
  const pool = await getPool();
  const client = await pool.connect();
  let discardConnection = false;
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      discardConnection = true;
    }
    throw error;
  } finally {
    client.release(discardConnection);
  }
}
