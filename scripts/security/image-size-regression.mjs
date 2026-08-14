import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

const rootRequire = createRequire(import.meta.url);
const expoRequire = createRequire(rootRequire.resolve("expo/package.json"));
const expoMetroRequire = createRequire(expoRequire.resolve("@expo/metro/package.json"));
const metroRequire = createRequire(expoMetroRequire.resolve("metro/package.json"));
const { imageSize } = metroRequire("image-size");

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

  console.log("image-size malicious-loop regression and legitimate PNG control passed");
}
