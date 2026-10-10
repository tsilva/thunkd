import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Worker, isMainThread, parentPort } from "node:worker_threads";

const rootRequire = createRequire(import.meta.url);
const expoRequire = createRequire(rootRequire.resolve("expo/package.json"));
const cliRequire = createRequire(expoRequire.resolve("@expo/cli/package.json"));
const certificatesPath = cliRequire.resolve("@expo/code-signing-certificates");
const certificates = cliRequire(certificatesPath);
const forge = createRequire(certificatesPath)("node-forge");
const presetRequire = createRequire(rootRequire.resolve("babel-preset-expo/package.json"));
const istanbulRequire = createRequire(presetRequire.resolve("babel-plugin-istanbul"));
const excludeRequire = createRequire(istanbulRequire.resolve("test-exclude"));
const micromatchPath = excludeRequire.resolve("micromatch");
const micromatch = excludeRequire(micromatchPath);
const braces = createRequire(micromatchPath)("braces");

if (!isMainThread) {
  const rejectDepth = (operation) => assert.throws(operation, {
    name: "SyntaxError", code: "BRACES_MAX_DEPTH",
  });
  for (const pattern of ["{".repeat(4000) + "a,b" + "}".repeat(4000), "(".repeat(4000) + "x", "{".repeat(4000)]) {
    for (const operation of [braces.parse, braces.compile, braces.expand, braces.stringify]) {
      rejectDepth(() => operation(pattern));
    }
  }
  const root = { type: "root", nodes: [] };
  let node = root;
  for (let depth = 0; depth < 10000; depth++) {
    const child = { type: "brace", nodes: [] };
    node.nodes.push(child);
    node = child;
  }
  for (const operation of [braces.compile, braces.expand, braces.stringify]) {
    rejectDepth(() => operation(root));
  }
  const cyclic = { type: "root", nodes: [] };
  cyclic.nodes.push(cyclic);
  for (const operation of [braces.compile, braces.expand, braces.stringify]) {
    rejectDepth(() => operation(cyclic));
  }
  parentPort.postMessage("rejected");
} else {
  // Exercise real Expo signing consumers, not an independently installed copy.
  const keyPair = certificates.generateKeyPair();
  const certificate = certificates.generateSelfSignedCodeSigningCertificate({
    keyPair, commonName: "thunkd-security-fixture",
    validityNotBefore: new Date(Date.now() - 60000),
    validityNotAfter: new Date(Date.now() + 60000),
  });
  certificates.validateSelfSignedCertificate(certificate, keyPair);
  assert.ok(certificates.signBufferRSASHA256AndVerify(keyPair.privateKey, certificate, Buffer.from("valid Expo update")));
  const md = forge.md.sha256.create();
  md.update("nested DigestInfo regression");
  const digest = md.digest().getBytes();
  const { asn1 } = forge;
  const universal = asn1.Class.UNIVERSAL;
  const oid = () => asn1.create(universal, asn1.Type.OID, false, asn1.oidToDer(forge.pki.oids.sha256).getBytes());
  const nullValue = () => asn1.create(universal, asn1.Type.NULL, false, "");
  const nested = () => asn1.create(universal, asn1.Type.SEQUENCE, true, [nullValue()]);
  const signDigestInfo = (algorithm) => keyPair.privateKey.sign(asn1.toDer(
    asn1.create(universal, asn1.Type.SEQUENCE, true, [
      asn1.create(universal, asn1.Type.SEQUENCE, true, algorithm),
      asn1.create(universal, asn1.Type.OCTETSTRING, false, digest),
    ]),
  ).getBytes(), "NONE");
  // Standard AlgorithmIdentifier forms remain supported.
  for (const algorithm of [[oid()], [oid(), nullValue()]]) {
    assert.equal(keyPair.publicKey.verify(digest, signDigestInfo(algorithm)), true);
  }
  // Extra inner fields previously escaped the nested length validator.
  for (const algorithm of [[oid(), nullValue(), nested()], [oid(), nested()], [oid(), nullValue(), oid()]]) {
    assert.throws(() => keyPair.publicKey.verify(digest, signDigestInfo(algorithm)), /valid RSASSA-PKCS1-v1_5 DigestInfo/);
  }
  assert.deepEqual(braces.expand("src/{a,{b,c}}.{js,ts}"), ["src/a.js", "src/a.ts", "src/b.js", "src/b.ts", "src/c.js", "src/c.ts"]);
  assert.deepEqual(braces.expand("item-{01..03}"), ["item-01", "item-02", "item-03"]);
  assert.equal(braces.compile("a/{b,c}/d"), "a/(b|c)/d");
  assert.equal(braces.stringify(braces.parse("a/{b,c}/d")), "a/{b,c}/d");
  assert.deepEqual(braces.expand("a/\\{b,c\\}"), ["a/{b,c}"]);
  assert.deepEqual(braces.expand("a/{b,c"), ["a/{b,c"]);
  assert.deepEqual(micromatch(["app/a.ts", "app/b.tsx", "app/c.test.ts", "other/d.ts"], ["app/*.{ts,tsx}", "!**/*.test.ts"]), ["app/a.ts", "app/b.tsx"]);
  const worker = new Worker(new URL(import.meta.url));
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Hostile AST validation timed out")), 3000);
      worker.once("message", (message) => { clearTimeout(timer); assert.equal(message, "rejected"); resolve(); });
      worker.once("error", (error) => { clearTimeout(timer); reject(error); });
      worker.once("exit", (code) => { clearTimeout(timer); if (code !== 0) reject(new Error(`AST worker exited ${code}`)); });
    });
  } finally {
    await worker.terminate();
  }
  console.log("Expo signatures, malformed DigestInfo, normal globs and hostile AST checks passed");
}
