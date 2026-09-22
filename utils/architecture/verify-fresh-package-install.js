const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

class FreshPackageInstallVerifier {
  constructor({ projectRoot = PROJECT_ROOT } = {}) { this.projectRoot = path.resolve(projectRoot); }

  run() {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-package-contract-"));
    try {
      this.#copyWorkspace(temporaryRoot);
      const copiedFiles = this.#snapshot(temporaryRoot);
      assert.deepEqual(copiedFiles, this.#snapshot(this.projectRoot), "Temporary source copy differs from the working tree");
      const steps = [];
      const packageJson = JSON.parse(fs.readFileSync(path.join(temporaryRoot, "package.json"), "utf8"));
      const expectedNpm = packageJson.packageManager.replace(/^npm@/u, "");
      const actualNpm = this.#runNpm(["--version"], temporaryRoot).trim();
      if (actualNpm !== expectedNpm) throw new Error(`packageManager requires npm ${expectedNpm}, received ${actualNpm}`);
      const lockPath = path.join(temporaryRoot, "package-lock.json");
      const lockBefore = fs.readFileSync(lockPath);
      // Acceptance needs build/test tooling even if npm inherits a production
      // install mode from the host. This does not change the locked graph.
      steps.push(this.#runNpm(["ci", "--include=dev", "--no-audit", "--no-fund"], temporaryRoot, "npm-ci"));
      if (!lockBefore.equals(fs.readFileSync(lockPath))) throw new Error("npm ci changed package-lock.json");
      for (const name of Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies })) {
        const installed = path.join(temporaryRoot, "node_modules", name, "package.json");
        if (!fs.existsSync(installed)) {
          throw new Error("Fresh npm ci did not install declared dependency " + name +
            " in the isolated workspace. npm output:\n" + steps[0].stdout + "\n" + steps[0].stderr);
        }
      }
      if (packageJson.scripts["build:stage-3-compat-runtime"]) {
        steps.push(this.#runNode(["utils/build/build_stage_3_compat_runtime.js"], temporaryRoot, "cumulative-build"));
      }
      steps.push(this.#runNode(["utils/run-checks.js", "--suite", "architecture"], temporaryRoot, "architecture"));
      steps.push(this.#runNode(["utils/run-checks.js", "--suite", "quick"], temporaryRoot, "quick"));
      steps.push(this.#runNode(["utils/run-checks.js", "--suite", "all"], temporaryRoot, "full"));
      const runtimeContractPath = path.join(temporaryRoot, "architecture/migration/stage_3_compatibility_runtime.json");
      let runtimeOutput = [];
      if (fs.existsSync(runtimeContractPath)) {
        const runtime = JSON.parse(fs.readFileSync(runtimeContractPath));
        const outputs = [`${runtime.output.directory}${runtime.output.runtimeFile}`,
          ...runtime.activationPositions.map((item) => `${runtime.output.directory}${item.shimFile}`)].sort();
        runtimeOutput = outputs.map((relative) => {
          const actual = fs.readFileSync(path.join(temporaryRoot, relative));
          assert.deepEqual(actual, fs.readFileSync(path.join(this.projectRoot, relative)),
            `Fresh build differs from the accepted working-tree output: ${relative}`);
          return { path: relative, sha256: this.#sha256(actual) };
        });
      }
      assert.deepEqual(this.#snapshot(temporaryRoot), copiedFiles, "Clean install/build/checks modified copied sources");
      assert.deepEqual(this.#snapshot(this.projectRoot), copiedFiles, "Working tree changed during fresh verification");
      console.log("Fresh package verification passed: npm ci reproduced the locked graph and Architecture, Quick, and Full suites passed in an isolated workspace.");
      return { status: "passed", node: process.version, npm: actualNpm, lockfileSha256: this.#sha256(lockBefore),
        lockfileChanged: false, dependenciesCopied: false, generatedOutputCopied: false,
        sourceCopy: { mode: "actual-working-tree-not-HEAD", files: copiedFiles.length,
          sha256: this.#sha256(Buffer.from(JSON.stringify(copiedFiles))), sourceBytesUnchanged: true },
        runtimeOutput, steps, temporaryWorkspaceRemoved: true };
    } finally {
      this.#removeVerifiedTemporaryRoot(temporaryRoot);
    }
  }

  #copyWorkspace(target) {
    fs.cpSync(this.projectRoot, target, {
      recursive: true,
      filter: (source) => {
        const relative = path.relative(this.projectRoot, source).replaceAll("\\", "/");
        return relative !== ".git" && !relative.startsWith(".git/") && relative !== "node_modules" && !relative.startsWith("node_modules/") && relative !== "dist" && !relative.startsWith("dist/");
      },
    });
  }

  #runNpm(argumentsList, cwd, label = null) {
    const invocation = this.#resolveNpmInvocation();
    if (label) console.log(`[fresh] ${label} started`);
    const startedAt = Date.now();
    const result = spawnSync(invocation.command, [...invocation.prefixArguments, ...argumentsList], { cwd, encoding: "utf8", shell: false, maxBuffer: 32 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`npm ${argumentsList.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
    if (!label) return result.stdout;
    console.log(`[fresh] ${label} passed`);
    return this.#step(label, argumentsList, result, startedAt);
  }

  #resolveNpmInvocation() {
    if (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) return { command: process.execPath, prefixArguments: [process.env.npm_execpath] };
    if (process.platform !== "win32") return { command: "npm", prefixArguments: [] };
    const lookup = spawnSync("where.exe", ["npm.cmd"], { encoding: "utf8", shell: false });
    const npmCommand = lookup.stdout?.split(/\r?\n/u).find((candidate) => candidate.trim().length > 0)?.trim();
    const npmCli = npmCommand ? path.join(path.dirname(npmCommand), "node_modules/npm/bin/npm-cli.js") : null;
    if (!npmCli || !fs.existsSync(npmCli)) throw new Error("Cannot locate npm CLI for fresh-install verification");
    return { command: process.execPath, prefixArguments: [npmCli] };
  }

  #runNode(argumentsList, cwd, label) {
    console.log(`[fresh] ${label} started`);
    const startedAt = Date.now();
    const result = spawnSync(process.execPath, argumentsList, { cwd, encoding: "utf8", shell: false, maxBuffer: 32 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`Fresh-install checks failed:\n${result.stdout}\n${result.stderr}`);
    console.log(`[fresh] ${label} passed`);
    return this.#step(label, argumentsList, result, startedAt);
  }

  #step(id, args, result, startedAt) {
    const stdout = result.stdout || "", stderr = result.stderr || "";
    const summary = stdout.match(/Passed (\d+) checks in ([\d.]+)s\./u);
    return { id, args, exitCode: result.status, durationMs: Date.now() - startedAt,
      passedChecks: summary ? Number(summary[1]) : null,
      stdout, stderr, stdoutSha256: this.#sha256(Buffer.from(stdout)), stderrSha256: this.#sha256(Buffer.from(stderr)) };
  }

  #sha256(bytes) { return crypto.createHash("sha256").update(bytes).digest("hex"); }

  #snapshot(root) {
    const walk = (relative) => fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
      const next = relative ? `${relative}/${entry.name}` : entry.name;
      if ([".git", "node_modules", "dist"].includes(next)) return [];
      assert(!entry.isSymbolicLink(), `Cannot attest a symlink in clean source copy: ${next}`);
      return entry.isDirectory() ? walk(next) : [{ path: next, sha256: this.#sha256(fs.readFileSync(path.join(root, next))) }];
    });
    return walk("").sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  }

  #removeVerifiedTemporaryRoot(temporaryRoot) {
    const resolved = path.resolve(temporaryRoot);
    const allowedParent = path.resolve(os.tmpdir());
    if (path.dirname(resolved) !== allowedParent || !path.basename(resolved).startsWith("cyber-fishing-package-contract-")) throw new Error(`Refusing to remove unverified temporary path: ${resolved}`);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

if (require.main === module) new FreshPackageInstallVerifier().run();
module.exports = { FreshPackageInstallVerifier };
