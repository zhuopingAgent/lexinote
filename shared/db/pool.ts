import { ConfigurationError } from "@/shared/utils/errors";

type PgPool = {
  query: <T = unknown>(
    text: string,
    values?: readonly unknown[]
  ) => Promise<{ rows: T[] }>;
  end: () => Promise<void>;
};

// `pg` has no bundled types in this environment, so keep the dependency explicit
// without reintroducing a handwritten ambient module declaration.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require("pg") as {
  Pool: new (config: { connectionString?: string; max?: number }) => PgPool;
};

let poolPromise: Promise<PgPool> | null = null;

async function createPool(): Promise<PgPool> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new ConfigurationError("DATABASE_URL is not configured");
  }

  return new Pool({
    connectionString,
    max: 10,
  });
}

export async function getPool(): Promise<PgPool> {
  if (!poolPromise) {
    poolPromise = createPool().catch((error) => {
      poolPromise = null;
      throw error;
    });
  }

  return poolPromise;
}
