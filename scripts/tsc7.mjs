import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const packageJsonPath = require.resolve("typescript-7/package.json");
const tscPath = path.join(path.dirname(packageJsonPath), "bin", "tsc");

const result = spawnSync(process.execPath, [tscPath, ...process.argv.slice(2)], {
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
