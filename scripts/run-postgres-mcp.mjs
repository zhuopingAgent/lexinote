import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import pg from "pg";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const { loadEnvConfig } = nextEnv;
const { Pool } = pg;
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..");

loadEnvConfig(repoRoot);

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  process.stderr.write("DATABASE_URL is required for PostgreSQL MCP.\n");
  process.exit(1);
}

const pool = new Pool({
  connectionString: databaseUrl,
});

const resourceBaseUrl = new URL(databaseUrl);
resourceBaseUrl.protocol = "postgres:";
resourceBaseUrl.password = "";

const server = new Server(
  {
    name: "lexinote-postgres",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

function buildSchemaUri(tableName) {
  return new URL(`${tableName}/schema`, resourceBaseUrl).href;
}

function isReadOnlyQuery(sql) {
  return /^(select|show|explain|with)\b/i.test(sql.trim());
}

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const result = await pool.query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `
  );

  return {
    resources: result.rows.map((row) => ({
      uri: buildSchemaUri(row.table_name),
      mimeType: "application/json",
      name: `"${row.table_name}" database schema`,
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const resourceUrl = new URL(request.params.uri);
  const pathComponents = resourceUrl.pathname.split("/");
  const resourceType = pathComponents.pop();
  const tableName = pathComponents.pop();

  if (resourceType !== "schema" || !tableName) {
    throw new Error("Invalid resource URI.");
  }

  const result = await pool.query(
    `
      SELECT
        column_name,
        data_type,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `,
    [tableName]
  );

  return {
    contents: [
      {
        uri: request.params.uri,
        mimeType: "application/json",
        text: JSON.stringify(result.rows, null, 2),
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "query_readonly",
        description:
          "Run a read-only SQL query against the configured PostgreSQL database.",
        inputSchema: {
          type: "object",
          properties: {
            sql: {
              type: "string",
              description:
                "A read-only SQL statement starting with SELECT, SHOW, EXPLAIN, or WITH.",
            },
          },
          required: ["sql"],
          additionalProperties: false,
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "query_readonly") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const sql = request.params.arguments?.sql;
  if (typeof sql !== "string" || !sql.trim()) {
    throw new Error("Tool 'query_readonly' requires a non-empty sql string.");
  }

  if (!isReadOnlyQuery(sql)) {
    throw new Error(
      "Only read-only SQL is allowed. Use SELECT, SHOW, EXPLAIN, or WITH."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN TRANSACTION READ ONLY");
    const result = await client.query(sql);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              rowCount: result.rowCount ?? result.rows.length,
              rows: result.rows,
            },
            null,
            2
          ),
        },
      ],
      isError: false,
    };
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);

  try {
    await pool.end();
  } finally {
    process.exit(1);
  }
});

process.on("SIGINT", async () => {
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await pool.end();
  process.exit(0);
});
