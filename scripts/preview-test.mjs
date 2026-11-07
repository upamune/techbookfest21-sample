import { randomBytes } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";

const fixture = `BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}\nTASK_AUTH_ENABLED=false\n`;
await writeFile(".env", fixture, { flag: "wx", mode: 0o600 });
const child = spawn("npm", ["run", "preview"], { stdio: "inherit", env: process.env });
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
