import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { gzipSync } from "node:zlib";

const rootRequire = createRequire(import.meta.url);
const expoRequire = createRequire(rootRequire.resolve("expo/package.json"));
const expoMetroRequire = createRequire(expoRequire.resolve("@expo/metro/package.json"));
const metroRequire = createRequire(expoMetroRequire.resolve("metro/package.json"));
const { imageSize } = metroRequire("image-size");

function tarHeader(name, size, type) {
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "utf8");
  header.write("0000777\0", 100, 8, "ascii");
  header.write("0000000\0", 108, 8, "ascii");
  header.write("0000000\0", 116, 8, "ascii");
  header.write(`${size.toString(8).padStart(11, "0")}\0`, 124, 12, "ascii");
  header.write("00000000000\0", 136, 12, "ascii");
  header.fill(0x20, 148, 156);
  header.write(type, 156, 1, "ascii");
  header.write("ustar\0", 257, 6, "ascii");
  header.write("00", 263, 2, "ascii");
  const checksum = header.reduce((total, byte) => total + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, "0")}\0 `, 148, 8, "ascii");
  return header;
}

function padTarBody(body) {
  const padding = (512 - (body.length % 512)) % 512;
  return Buffer.concat([body, Buffer.alloc(padding)]);
}

function maliciousPayload(kind) {
  if (kind === "icns") {
    const input = Buffer.alloc(16);
    input.write("icns", 0);
    input.writeUInt32BE(16, 4);
    input.write("ic07", 8);
    input.writeUInt32BE(0, 12);
    return input;
  }

  if (kind === "jxl") {
    const input = Buffer.alloc(32);
    input.writeUInt32BE(12, 0);
    input.write("JXL ", 4);
    input.writeUInt32BE(12, 12);
    input.write("ftyp", 16);
    input.write("jxl ", 20);
    input.writeUInt32BE(0, 24);
    input.write("jxlp", 28);
    return input;
  }

  const input = Buffer.alloc(20);
  input.writeUInt32BE(12, 0);
  input.write("ftyp", 4);
  input.write("mif1", 8);
  input.writeUInt32BE(0, 12);
  input.write("meta", 16);
  return input;
}

if (!isMainThread) {
  try {
    imageSize(maliciousPayload(workerData.kind));
  } catch {
    // Rejecting the malformed image is the expected safe outcome.
  }
  parentPort.postMessage("completed");
} else {
  const png = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
  png.write("IHDR", 12);
  png.writeUInt32BE(2, 16);
  png.writeUInt32BE(3, 20);
  assert.deepEqual(imageSize(png), { height: 3, type: "png", width: 2 });

  for (const kind of ["icns", "jxl", "heif"]) {
    const worker = new Worker(new URL(import.meta.url), { workerData: { kind } });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.terminate();
        reject(new Error(`${kind} parser did not terminate`));
      }, 1000);
      worker.once("error", reject);
      worker.once("message", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    await worker.terminate();
  }

  const expoCliRequire = createRequire(expoRequire.resolve("@expo/cli/package.json"));
  const tarPackage = expoCliRequire("tar/package.json");
  assert.equal(tarPackage.version, "7.5.22");

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "thunkd-security-"));
  try {
    const longName = Buffer.from(`${"a/".repeat(12_000)}file.txt\0`);
    const archive = gzipSync(
      Buffer.concat([
        tarHeader("././@LongLink", longName.length, "L"),
        padTarBody(longName),
        tarHeader("file.txt", 0, "0"),
        Buffer.alloc(1024),
      ]),
    );
    const archivePath = join(temporaryDirectory, "hostile.tar.gz");
    await writeFile(archivePath, archive);
    const tarResult = spawnSync(
      process.execPath,
      [
        "-e",
        "const tar=require(process.argv[1]); tar.t({file:process.argv[2],gzip:true},['selected']).then(()=>process.stdout.write('completed')).catch(()=>process.stdout.write('rejected'));",
        expoCliRequire.resolve("tar"),
        archivePath,
      ],
      { encoding: "utf8", timeout: 2_000 },
    );
    assert.equal(tarResult.error, undefined, tarResult.error?.message);
    assert.equal(tarResult.status, 0, tarResult.stderr);
    assert.match(tarResult.stdout, /^(completed|rejected)$/);

    const babel = metroRequire("@babel/core");
    assert.equal(babel.version, "7.29.7");
    const babelConfig = rootRequire("../../babel.config.cjs")({ cache() {} });
    assert.equal(babelConfig.inputSourceMap, false);
    const sourceMapPath = join(temporaryDirectory, "private.map");
    const marker = "must-not-enter-babel-output";
    await writeFile(
      sourceMapPath,
      JSON.stringify({
        mappings: "",
        names: [],
        sources: ["private.ts"],
        sourcesContent: [marker],
        version: 3,
      }),
    );
    const transformed = babel.transformSync(
      `const value = 42;\n//# sourceMappingURL=${sourceMapPath}`,
      {
        ...babelConfig,
        babelrc: false,
        configFile: false,
        filename: join(temporaryDirectory, "input.js"),
        sourceMaps: true,
      },
    );
    assert.doesNotMatch(JSON.stringify(transformed), new RegExp(marker));

    const configPluginsRequire = createRequire(
      expoRequire.resolve("@expo/config-plugins/package.json"),
    );
    const xcodeRequire = createRequire(configPluginsRequire.resolve("xcode/package.json"));
    const uuid = xcodeRequire("uuid");
    assert.throws(
      () => uuid.v5("hostile", uuid.v5.URL, new Uint8Array(8), 4),
      RangeError,
    );
    assert.match(uuid.v5("valid", uuid.v5.URL), /^[0-9a-f-]{36}$/);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }

  console.log(
    "dependency malicious-input regressions and legitimate controls passed",
  );
}
