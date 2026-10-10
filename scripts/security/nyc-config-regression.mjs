import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const rootRequire = createRequire(import.meta.url);
const presetRequire = createRequire(rootRequire.resolve("babel-preset-expo/package.json"));
const istanbulRequire = createRequire(presetRequire.resolve("babel-plugin-istanbul/package.json"));
const loaderPath = istanbulRequire.resolve("@istanbuljs/load-nyc-config");
const loaderRequire = createRequire(loaderPath);
const { loadNycConfig } = loaderRequire(loaderPath);
assert.equal(loaderRequire("js-yaml/package.json").version, "4.3.2");

const folder = await mkdtemp(join(tmpdir(), "thunkd-nyc-config-"));
try {
  await writeFile(join(folder, "package.json"), JSON.stringify({ name: "fixture", nyc: { all: true } }));
  await writeFile(join(folder, "base.yml"), "reporter: &reporters\n  - text\n  - json\nexclude: [\"**/*.test.ts\"]\n");
  await writeFile(join(folder, ".nycrc.yaml"), "extends: ./base.yml\ninclude: [\"app/**/*.tsx\"]\ncheck-coverage: true\nbranches: 80\n");
  const config = await loadNycConfig({ cwd: folder });
  assert.equal(config.all, true);
  assert.equal(config.checkCoverage, true);
  assert.equal(config.branches, 80);
  assert.deepEqual(config.reporter, ["text", "json"]);
  assert.deepEqual(config.exclude, ["**/*.test.ts"]);
  assert.deepEqual(config.include, ["app/**/*.tsx"]);
  await writeFile(join(folder, "nyc.json"), JSON.stringify({ include: ["src/**"], branches: 75 }));
  const jsonConfig = await loadNycConfig({ cwd: folder, nycrcPath: join(folder, "nyc.json") });
  assert.equal(jsonConfig.branches, 75);
  assert.deepEqual(jsonConfig.include, ["src/**"]);
  await writeFile(join(folder, "bad.yaml"), "reporter: [broken\n");
  await assert.rejects(loadNycConfig({ cwd: folder, nycrcPath: join(folder, "bad.yaml") }));
  console.log("Istanbul YAML/JSON configuration, inheritance and invalid-input checks passed");
} finally {
  await rm(folder, { recursive: true, force: true });
}
