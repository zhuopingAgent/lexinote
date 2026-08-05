import { ConfigurationError } from "@/shared/utils/errors";

export type PgClient = {
  query: <T = unknown>(
    text: string,
    values?: readonly unknown[]
  ) => Promise<{ rows: T[] }>;
  release: (error?: Error | boolean) => void;
};

type PgPool = {
  query: PgClient["query"];
  connect: () => Promise<PgClient>;
  end: () => Promise<void>;
};

type PgPoolConfig = {
  connectionString?: string;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
};

// `pg` has no bundled types in this environment, so keep the dependency explicit
// without reintroducing a handwritten ambient module declaration.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Pool } = require("pg") as {
  Pool: new (config: PgPoolConfig) => PgPool;
};

let poolPromise: Promise<PgPool> | null = null;

function parsePositiveInteger(
  value: string | undefined,
  fallback: number,
  minimum = 1
) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= minimum ? parsed : fallback;
}

export function createPoolConfig(
  env: Record<string, string | undefined> = process.env
): PgPoolConfig {
  const defaultMax = env.VERCEL ? 1 : 10;

  return {
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: parsePositiveInteger(
      env.PG_CONNECTION_TIMEOUT_MS,
      5_000
    ),
    idleTimeoutMillis: parsePositiveInteger(env.PG_IDLE_TIMEOUT_MS, 10_000),
    max: parsePositiveInteger(env.PG_POOL_MAX, defaultMax),
  };
}

async function createPool(): Promise<PgPool> {
  const config = createPoolConfig();
  if (!config.connectionString) {
    throw new ConfigurationError("DATABASE_URL is not configured");
  }

  return new Pool(config);
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
