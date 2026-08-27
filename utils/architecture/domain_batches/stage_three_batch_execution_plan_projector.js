"use strict";

const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
  StageThreeBatchExecutionPlanBuilder,
  StageThreeBatchExecutionPlanValidator,
} = require("./stage_three_batch_execution_plan");
const {
  LegacyScriptOrderReader,
} = require("../migration/legacy_script_order_reader");
const {
  StageTwoRuntimeScriptAliasResolver,
} = require("../migration/stage_two_runtime_script_alias_resolver");

class StageThreeBatchExecutionPlanProjector {
  #projectRoot;
  #profile;
  #paths;
  #rollbackFilePaths;

  constructor({ projectRoot, profile, paths, rollbackFilePaths }) {
    this.#projectRoot = path.resolve(projectRoot);
    this.#profile = profile;
    this.#paths = Object.freeze({ ...paths });
    this.#rollbackFilePaths = Object.freeze([...rollbackFilePaths]);
  }

  buildPlan() {
    const audit = this.#readJsonWithFingerprint(this.#paths.audit);
    const approvedPlan = this.#readJsonWithFingerprint(this.#paths.approvedPlan);
    const executionState = this.#readJsonWithFingerprint(this.#paths.executionState);
    const runtimeContract = this.#readJsonWithFingerprint(this.#paths.runtimeContract);
    const manifest = this.#readJsonWithFingerprint(this.#paths.manifest);
    const bridgeRegistry = this.#readJsonWithFingerprint(this.#paths.bridgeRegistry);
    for (const module of audit.document.scope.modules) {
      if (fs.existsSync(this.#absolute(module.targetPath))) {
        throw new Error(`Batch ${this.#profile.batchNumber} target already exists before cutover: ${module.targetPath}`);
      }
    }
    const plan = new StageThreeBatchExecutionPlanBuilder(this.#profile).build({
      audit: audit.document,
      auditSha256: audit.sha256,
      approvedPlan: approvedPlan.document,
      approvedPlanSha256: approvedPlan.sha256,
      executionState: executionState.document,
      executionStateSha256: executionState.sha256,
      runtimeContract: runtimeContract.document,
      runtimeContractSha256: runtimeContract.sha256,
      manifestSha256: manifest.sha256,
      bridgeRegistry: bridgeRegistry.document,
      bridgeRegistrySha256: bridgeRegistry.sha256,
      scmCheckpoint: this.#scmCheckpoint({
        audit: audit.sha256,
        approvedPlan: approvedPlan.sha256,
        executionState: executionState.sha256,
        runtimeContract: runtimeContract.sha256,
        manifest: manifest.sha256,
        bridgeRegistry: bridgeRegistry.sha256,
      }),
      runtimeFacts: this.runtimeFacts({
        approvedPlan: approvedPlan.document,
        executionState: executionState.document,
        runtimeContract: runtimeContract.document,
      }),
      rollbackEvidence: this.rollbackEvidence(),
    });
    new StageThreeBatchExecutionPlanValidator(this.#profile).validate(plan);
    return plan;
  }

  runtimeFacts({ approvedPlan, executionState, runtimeContract }) {
    const completedCount = executionState.completedBatchIds.length;
    const selectedBatch = approvedPlan.batches[completedCount - 1];
    if (!selectedBatch) throw new Error("Current completed Stage 3 batch is missing");
    const html = this.#bytes(this.#paths.index).toString("utf8");
    const scriptTags = [...html.matchAll(/<script\b([^>]*)\bsrc=["']([^"']+)["'][^>]*>/giu)];
    const moduleScriptCount = scriptTags.filter((match) => /\btype=["']module["']/iu.test(match[1])).length;
    const aliases = new StageTwoRuntimeScriptAliasResolver().loadProject(this.#projectRoot);
    const logical = new LegacyScriptOrderReader(this.#absolute(this.#paths.index), {
      scriptAliases: aliases,
    }).read();
    const runtimeScriptCount = scriptTags.filter((match) =>
      match[2].split("?")[0] === `${runtimeContract.output.directory}${runtimeContract.output.runtimeFile}`).length;
    if (runtimeScriptCount !== 1) throw new Error("Expected exactly one active cumulative runtime script");
    return Object.freeze({
      projectModuleCount: selectedBatch.cumulativeRuntimeTopology.moduleRecordCount,
      activationCount: runtimeContract.activationPositions.length,
      scriptTopology: Object.freeze({
        physicalClassicScriptCount: scriptTags.length - moduleScriptCount,
        logicalLegacyPositionCount: logical.length,
        moduleScriptCount,
        cumulativeRuntimeScriptCount: runtimeScriptCount,
        isolatedIifeScriptCount: scriptTags.filter((match) =>
          match[2].includes("dist/legacy-bridges/")).length,
      }),
    });
  }

  rollbackEvidence() {
    return Object.freeze({
      files: this.#rollbackFilePaths.map((relativePath) => ({
        path: relativePath,
        sha256: this.#sha256(this.#bytes(relativePath)),
      })).sort((left, right) => left.path.localeCompare(right.path)),
      runtimeOutput: this.#runtimeOutputEvidence(),
    });
  }

  serialize(plan) {
    return Buffer.from(`${JSON.stringify(plan, null, 2)}\n`, "utf8");
  }

  writePlan(plan) {
    fs.writeFileSync(this.#absolute(this.#paths.output), this.serialize(plan));
  }

  #runtimeOutputEvidence() {
    const root = this.#absolute(this.#paths.runtimeOutput);
    const files = [];
    const walk = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const child = path.join(directory, entry.name);
        if (entry.isDirectory()) walk(child);
        else if (entry.isFile()) {
          const relativePath = path.relative(this.#projectRoot, child).replaceAll("\\", "/");
          files.push({ path: relativePath, sha256: this.#sha256(fs.readFileSync(child)) });
        }
      }
    };
    walk(root);
    files.sort((left, right) => left.path.localeCompare(right.path));
    return Object.freeze({
      path: this.#paths.runtimeOutput,
      files,
      fingerprint: this.#sha256(Buffer.from(JSON.stringify(files), "utf8")),
    });
  }

  #scmCheckpoint(currentEvidence) {
    if (!this.#profile.scmCheckpointRequired) return null;
    if (!fs.existsSync(path.join(this.#projectRoot, ".git"))) {
      return this.#archivedScmCheckpoint(currentEvidence);
    }
    const git = this.#resolveGit();
    const commit = this.#runGit(git, ["rev-list", "-n", "1", this.#profile.sourceReleaseTag]);
    const tagType = this.#runGit(git, ["cat-file", "-t", this.#profile.sourceReleaseTag]);
    if (tagType !== "tag") {
      throw new Error(`Source release checkpoint must be an annotated tag: ${this.#profile.sourceReleaseTag}`);
    }
    return Object.freeze({
      tag: this.#profile.sourceReleaseTag,
      commitSha: commit,
      tagType,
      rollbackMode: "exact-source-release-tag-plus-batch-delta",
    });
  }

  #archivedScmCheckpoint(currentEvidence) {
    if (!fs.existsSync(this.#absolute(this.#paths.output))) {
      throw new Error("Source archive has no Git metadata or committed execution-plan checkpoint evidence");
    }
    const archivedPlan = JSON.parse(this.#bytes(this.#paths.output).toString("utf8"));
    const checkpoint = archivedPlan?.sourceEvidence?.scmCheckpoint;
    const errors = [];
    if (checkpoint?.tag !== this.#profile.sourceReleaseTag) errors.push("checkpoint tag differs");
    if (!/^[a-f0-9]{40}$/u.test(checkpoint?.commitSha)) errors.push("checkpoint commit SHA is invalid");
    if (checkpoint?.tagType !== "tag") errors.push("checkpoint is not an annotated tag");
    if (checkpoint?.rollbackMode !== "exact-source-release-tag-plus-batch-delta") {
      errors.push("checkpoint rollback mode differs");
    }
    for (const [key, sha256] of Object.entries(currentEvidence)) {
      if (archivedPlan?.sourceEvidence?.[key]?.sha256 !== sha256) {
        errors.push(`${key} content differs from archived checkpoint evidence`);
      }
    }
    if (errors.length > 0) {
      throw new Error(`Archived SCM checkpoint verification failed:\n- ${errors.join("\n- ")}`);
    }
    return Object.freeze({ ...checkpoint });
  }

  #resolveGit() {
    const candidates = process.platform === "win32"
      ? [process.env.GIT_EXECUTABLE, "C:/Program Files/Git/cmd/git.exe", "git"]
      : [process.env.GIT_EXECUTABLE, "git"];
    for (const candidate of candidates.filter(Boolean)) {
      const result = spawnSync(candidate, ["--version"], { cwd: this.#projectRoot, encoding: "utf8" });
      if (result.status === 0) return candidate;
    }
    throw new Error("Cannot locate Git for Stage 3 SCM checkpoint verification");
  }

  #runGit(git, argumentsList) {
    const result = spawnSync(git, argumentsList, {
      cwd: this.#projectRoot,
      encoding: "utf8",
      shell: false,
    });
    if (result.status !== 0) {
      throw new Error(`Git checkpoint verification failed: git ${argumentsList.join(" ")}\n${result.stderr}`);
    }
    return result.stdout.trim();
  }

  #readJsonWithFingerprint(relativePath) {
    const value = this.#bytes(relativePath);
    return Object.freeze({
      document: JSON.parse(value.toString("utf8")),
      sha256: this.#sha256(value),
    });
  }

  #absolute(relativePath) {
    return path.join(this.#projectRoot, relativePath);
  }

  #bytes(relativePath) {
    return fs.readFileSync(this.#absolute(relativePath));
  }

  #sha256(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
  }
}

module.exports = { StageThreeBatchExecutionPlanProjector };
