import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const lock = JSON.parse(readFileSync(join(root, "quality-tools.lock.json"), "utf8"));
const destination = join(root, ".tools", "bin");
mkdirSync(destination, { recursive: true });

for (const tool of lock.tools) {
  const asset = tool.assets.find(
    ({ platform, arch }) => platform === process.platform && arch === process.arch,
  );
  if (!asset)
    throw new Error(`${tool.name}: no pinned binary for ${process.platform}/${process.arch}`);
  const temporary = mkdtempSync(join(tmpdir(), "quality-tools-"));
  try {
    const archive = join(temporary, "tool.tar.gz");
    execFileSync(
      "curl",
      [
        "--fail",
        "--location",
        "--proto",
        "=https",
        "--tlsv1.2",
        "--connect-timeout",
        "15",
        "--max-time",
        "180",
        "--output",
        archive,
        asset.url,
      ],
      { stdio: "inherit" },
    );
    const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
    if (digest !== asset.sha256) throw new Error(`${tool.name}: archive SHA-256 mismatch`);
    const entries = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" }).trim().split("\n");
    const binaries = entries.filter(
      (entry) => basename(entry) === tool.name && !entry.endsWith("/"),
    );
    if (binaries.length !== 1) throw new Error(`${tool.name}: expected exactly one binary`);
    const executable = join(destination, tool.name);
    writeFileSync(
      executable,
      execFileSync("tar", ["-xOzf", archive, binaries[0]], { maxBuffer: 128 * 1024 * 1024 }),
      { mode: 0o755 },
    );
    const version = execFileSync(executable, ["--version"], { encoding: "utf8" }).trim();
    if (!version.endsWith(` ${tool.version}`))
      throw new Error(`${tool.name}: unexpected version ${version}`);
    process.stdout.write(`${version}\n`);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
