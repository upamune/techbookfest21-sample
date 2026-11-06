import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const [tool, ...args] = process.argv.slice(2);
if (tool !== "cccc" && tool !== "similarity-ts") throw new Error("Unknown quality tool");
const executable = join(root, ".tools", "bin", tool);
if (!existsSync(executable)) throw new Error(`${tool} is missing. Run npm run tools:setup first.`);
const result = spawnSync(executable, args, { cwd: root, stdio: "inherit" });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
