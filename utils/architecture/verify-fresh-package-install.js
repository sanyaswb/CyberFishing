const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const PROJECT_ROOT = path.resolve(__dirname, "../..");

class FreshPackageInstallVerifier {
  run() {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cyber-fishing-package-contract-"));
    try {
      this.#copyWorkspace(temporaryRoot);
      const packageJson = JSON.parse(fs.readFileSync(path.join(temporaryRoot, "package.json"), "utf8"));
      const expectedNpm = packageJson.packageManager.replace(/^npm@/u, "");
      const actualNpm = this.#runNpm(["--version"], temporaryRoot).trim();
      if (actualNpm !== expectedNpm) throw new Error(`packageManager requires npm ${expectedNpm}, received ${actualNpm}`);
      const lockPath = path.join(temporaryRoot, "package-lock.json");
      const lockBefore = fs.readFileSync(lockPath);
      this.#runNpm(["ci", "--no-audit", "--no-fund"], temporaryRoot);
      if (!lockBefore.equals(fs.readFileSync(lockPath))) throw new Error("npm ci changed package-lock.json");
      this.#runNode(["utils/run-checks.js", "--suite", "architecture"], temporaryRoot);
      this.#runNode(["utils/run-checks.js", "--suite", "quick"], temporaryRoot);
      this.#runNode(["utils/run-checks.js", "--suite", "all"], temporaryRoot);
      console.log("Fresh package verification passed: npm ci reproduced the locked graph and Architecture, Quick, and Full suites passed in an isolated workspace.");
    } finally {
      this.#removeVerifiedTemporaryRoot(temporaryRoot);
    }
  }

  #copyWorkspace(target) {
    fs.cpSync(PROJECT_ROOT, target, {
      recursive: true,
      filter: (source) => {
        const relative = path.relative(PROJECT_ROOT, source).replaceAll("\\", "/");
        return relative !== ".git" && !relative.startsWith(".git/") && relative !== "node_modules" && !relative.startsWith("node_modules/") && relative !== "dist" && !relative.startsWith("dist/");
      },
    });
  }

  #runNpm(argumentsList, cwd) {
    const invocation = this.#resolveNpmInvocation();
    const result = spawnSync(invocation.command, [...invocation.prefixArguments, ...argumentsList], { cwd, encoding: "utf8", shell: false, maxBuffer: 32 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`npm ${argumentsList.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
    return result.stdout;
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

  #runNode(argumentsList, cwd) {
    const result = spawnSync(process.execPath, argumentsList, { cwd, encoding: "utf8", shell: false, maxBuffer: 32 * 1024 * 1024 });
    if (result.status !== 0) throw new Error(`Fresh-install checks failed:\n${result.stdout}\n${result.stderr}`);
  }

  #removeVerifiedTemporaryRoot(temporaryRoot) {
    const resolved = path.resolve(temporaryRoot);
    const allowedParent = path.resolve(os.tmpdir());
    if (path.dirname(resolved) !== allowedParent || !path.basename(resolved).startsWith("cyber-fishing-package-contract-")) throw new Error(`Refusing to remove unverified temporary path: ${resolved}`);
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}

new FreshPackageInstallVerifier().run();
