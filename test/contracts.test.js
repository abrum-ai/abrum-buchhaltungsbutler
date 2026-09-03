import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("../abrum.app.json", import.meta.url), "utf8"));
const backend = await readFile(new URL("../backend/buchhaltungsbutler.station.js", import.meta.url), "utf8");
const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");

test("manifest imports Secrets and declares one server-filled credential", () => {
  assert.ok(manifest.companions.includes("abrum.secrets"));
  assert.ok(manifest.imports.some((entry) => entry.appId === "abrum.secrets"));
  const secret = manifest.requiredSecrets.find((entry) => entry.id === "buchhaltungsbutler.credentials");
  assert.equal(secret.fillAs, "credentials");
  assert.ok(secret.functions.includes("uploadReceipt"));
});

test("upload uses the private Run artifact schema and download returns an embedded artifact", () => {
  const upload = manifest.functions.find((entry) => entry.id === "uploadReceipt");
  assert.equal(upload.input.properties.artifactRef.format, "abrum-run-artifact");
  assert.match(backend, /_meta: \{ embeddedArtifact: true \}/);
  assert.doesNotMatch(backend, /process\.env/);
});

test("network policy is restricted to BuchhaltungsButler TLS", () => {
  assert.deepEqual(manifest.network.allow, ["app.buchhaltungsbutler.de:443"]);
});

test("UI uses the ABRUM component library and host navigation contract", () => {
  assert.match(app, /useAbrumGlobalNavigation/);
  assert.match(app, /from "@abrum\/react\/ui"/);
  assert.match(app, /<Tabs/);
  assert.match(styles, /@import "@abrum\/react\/tailwind\.css"/);
  assert.doesNotMatch(styles, /radial-gradient|box-shadow:\s*0 1[26]px/);
});
