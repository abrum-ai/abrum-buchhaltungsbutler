import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const forbidden = `x${"p"}0`;
const ignored = new Set([".git"]);
const textExtensions = new Set(["", ".css", ".html", ".js", ".json", ".md", ".mjs", ".ts", ".tsx"]);
const findings = [];

async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {
        await visit(path.join(file, "@abrum"));
        continue;
      }
      await visit(file);
      continue;
    }
    if (entry.name.toLowerCase().includes(forbidden)) findings.push(file);
    if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
      const bytes = await readFile(file);
      if (bytes.toString("utf8").toLowerCase().includes(forbidden)) findings.push(file);
    }
  }
}

await visit(process.cwd());
if (findings.length) {
  throw new Error(`Legacy product name found in:\n${[...new Set(findings)].join("\n")}`);
}
console.log("No legacy product names found.");
