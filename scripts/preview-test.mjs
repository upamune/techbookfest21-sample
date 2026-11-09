import { randomBytes } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";

const fixture = `BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\nPOCKET_AUTH_ENABLED=false\n`;
await writeFile(".env", fixture, { flag: "wx", mode: 0o600 });
const env = { ...process.env, POCKET_WORKERS_AI: "off" };
const build = spawn("npm", ["run", "build"], { stdio: "inherit", env });
const [buildCode] = await once(build, "exit");
if (buildCode !== 0) throw new Error("build failed");
const child = spawn("npm", ["run", "preview"], { stdio: "inherit", env });
const stop = () => child.kill("SIGTERM");
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
try {
  const [code] = await once(child, "exit");
  process.exitCode = typeof code === "number" ? code : 1;
} finally {
  process.removeListener("SIGTERM", stop);
  process.removeListener("SIGINT", stop);
  if ((await readFile(".env", "utf8")) === fixture) await unlink(".env");
}
