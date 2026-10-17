import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const excluded = new Set(["simulation.ts", "simulationCore.ts"]);
const extensions = new Set([".ts", ".tsx"]);
const violations = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (!extensions.has(path.extname(entry.name)) || excluded.has(entry.name) || entry.name.endsWith(".test.ts")) continue;
    const content = await readFile(fullPath, "utf8");
    if (/from\s*["'][^"']*simulationCore["']|import\s*\(["'][^"']*simulationCore["']\)/.test(content)) {
      violations.push(path.relative(sourceRoot, fullPath));
    }
  }
}

await walk(sourceRoot);
if (violations.length) {
  console.error("Truth-core import boundary violated. UI code must import the trainee-safe ./simulation facade instead:");
  for (const file of violations) console.error(` - ${file}`);
  process.exitCode = 1;
} else {
  console.log("Simulation boundary check passed: UI source does not import simulationCore directly.");
}
