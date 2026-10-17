"use strict";

// Copies the pinned spine-webgl ESM bundle into vendor/ byte for byte and records its provenance (spec 099, D2).
//   node utils/vendor-spine.js          write vendor/spine-webgl/<version>/ and vendor/manifest.json
//   node utils/vendor-spine.js --check  fail when vendor/ differs from what the installed package would produce
// The architecture check verifies the manifest hashes and the single importer without node_modules.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const PACKAGE_NAME = "@esotericsoftware/spine-webgl";
const CORE_PACKAGE_NAME = "@esotericsoftware/spine-core";
const SOURCE_FILE = "dist/esm/spine-webgl.min.mjs";
const IMPORTER = "src/platform/browser/animation/spine_runtime_module.js";
const MANIFEST_FILE = "vendor/manifest.json";
const MODULE_TYPE_FILE = "vendor/package.json";
const EXACT_VERSION = /^\d+\.\d+\.\d+$/u;

class SpineVendorPlan {
  static resolve(rootDir) {
    const rootPackage = SpineVendorPlan.#readJson(rootDir, "package.json");
    const version = rootPackage.devDependencies?.[PACKAGE_NAME];
    if (!EXACT_VERSION.test(version ?? "")) {
      throw new Error(`package.json must pin ${PACKAGE_NAME} to an exact version, found ${JSON.stringify(version)}`);
    }
    const packageDir = path.join(rootDir, "node_modules", ...PACKAGE_NAME.split("/"));
    const installed = SpineVendorPlan.#readJson(packageDir, "package.json");
    if (installed.version !== version) {
      throw new Error(`installed ${PACKAGE_NAME} is ${installed.version}, package.json pins ${version}; run npm install`);
    }
    const lock = SpineVendorPlan.#readJson(rootDir, "package-lock.json").packages ?? {};
    const lockEntry = lock[`node_modules/${PACKAGE_NAME}`];
    const coreEntry = lock[`node_modules/${CORE_PACKAGE_NAME}`];
    if (lockEntry?.version !== version || !lockEntry.integrity) {
      throw new Error(`package-lock.json has no integrity for ${PACKAGE_NAME}@${version}`);
    }
    if (coreEntry?.version !== installed.dependencies?.[CORE_PACKAGE_NAME]) {
      throw new Error(`package-lock.json ${CORE_PACKAGE_NAME} does not match ${PACKAGE_NAME}'s dependency`);
    }
    const bundle = fs.readFileSync(path.join(packageDir, ...SOURCE_FILE.split("/")));
    const license = fs.readFileSync(path.join(packageDir, "LICENSE"));
    const directory = `vendor/spine-webgl/${version}`;
    const entry = {
      name: PACKAGE_NAME,
      version,
      integrity: lockEntry.integrity,
      bundles: [`${CORE_PACKAGE_NAME}@${coreEntry.version}`],
      source: SOURCE_FILE,
      file: `${directory}/spine-webgl.js`,
      sha256: SpineVendorPlan.sha256(bundle),
      license: `${directory}/LICENSE`,
      licenseSha256: SpineVendorPlan.sha256(license),
      importer: IMPORTER,
    };
    const manifest = { schemaVersion: 1, packages: [entry] };
    return new Map([
      [entry.file, bundle],
      [entry.license, license],
      [MANIFEST_FILE, Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8")],
      [MODULE_TYPE_FILE, Buffer.from(`${JSON.stringify({ type: "module" }, null, 2)}\n`, "utf8")],
    ]);
  }

  static sha256(bytes) {
    return crypto.createHash("sha256").update(bytes).digest("hex");
  }

  static #readJson(directory, file) {
    return JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
  }
}

function differences(rootDir, plan) {
  const found = [];
  for (const [file, bytes] of plan) {
    const target = path.join(rootDir, ...file.split("/"));
    if (!fs.existsSync(target)) found.push(`${file} is missing`);
    else if (!fs.readFileSync(target).equals(bytes)) found.push(`${file} differs`);
  }
  return found;
}

function main(args) {
  const plan = SpineVendorPlan.resolve(ROOT_DIR);
  if (args.includes("--check")) {
    const found = differences(ROOT_DIR, plan);
    if (found.length > 0) throw new Error(`vendor/ is out of date: ${found.join("; ")}; run node utils/vendor-spine.js`);
    console.log(`vendor/ matches the installed ${PACKAGE_NAME} (${plan.size} files).`);
    return;
  }
  for (const [file, bytes] of plan) {
    const target = path.join(ROOT_DIR, ...file.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  console.log(`Wrote ${[...plan.keys()].join(", ")}.`);
}

main(process.argv.slice(2));
