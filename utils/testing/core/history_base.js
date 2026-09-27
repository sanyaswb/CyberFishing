"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

// History-only checks of batches up to BASE.batch replay a frozen past. They run in the exact
// reconstruction of release BASE.release (with the current tooling copied in) instead of the live
// tree, so their sealed inputs change only when their tooling changes. The reconstruction peels
// every newer batch with its recorded before-images; any drift fails the reconstruction itself.
const BASE = Object.freeze({ release: "0.24.63", batch: "025" });
const DATA = Object.freeze(["src", "architecture", "dist/stage-3-compat-runtime", "index.html", "package.json",
  "package-lock.json", "CHANGELOG.md", "refactor_Task.txt"]);
const { INFORMATIONAL_DOCUMENTS } = require("../../architecture/informational_documents");
const { DIRECTORY: REVIEW_QUEUE_DIRECTORY } = require("../../architecture/review_queue/review_queue_paths");
// Stage artifact directories recorded between two batches, keyed by the first batch they precede.
const { DIRECTORY: PREREQUISITE_DIRECTORY } = require("../../architecture/stage_three_prerequisites/core/prerequisite_ledger");
const { STAGE_3_36 } = require("../../architecture/post_freeze/post_freeze_review_profile");
// Prerequisite transitions are recorded after batch 034 or later; the Stage 3.36.0 review precedes 035.
const STAGE_DIRECTORIES = Object.freeze({ [`${REVIEW_QUEUE_DIRECTORY}/`]: "033", [`${PREREQUISITE_DIRECTORY}/`]: "035",
  [`${STAGE_3_36.directory}/`]: "035" });
const sha = value => crypto.createHash("sha256").update(value).digest("hex");

class HistoryBase {
  constructor(root) {
    this.root = path.resolve(root);
    // One base per project root: snapshot copies share node_modules with the live tree.
    this.cache = path.join(this.root, "node_modules", ".cache", "cyber-history-base", sha(this.root).slice(0, 12));
    this.directory = path.join(this.cache, BASE.release);
  }

  // Checks registered only in the history suite whose batch is not newer than the base.
  static covers(check) {
    if (check.suites.length !== 1 || check.suites[0] !== "history") return false;
    const batch = check.id.match(/^stage-3-batch-(\d{3})-/u)?.[1];
    return !batch || batch <= BASE.batch;
  }

  #walk(root, relative, visit) {
    const absolute = path.join(root, relative);
    if (!fs.existsSync(absolute)) return;
    if (fs.statSync(absolute).isFile()) { visit(relative); return; }
    for (const entry of fs.readdirSync(absolute, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const child = `${relative}/${entry.name}`;
      if (entry.isDirectory()) this.#walk(root, child, visit);
      else if (entry.isFile()) visit(child);
    }
  }

  // Fingerprint of the project data under root (the live tree or the base). Informational
  // documents are excluded: history replays use their frozen copy.
  fingerprint(root = this.root) {
    const lines = [];
    for (const item of DATA.filter(entry => !INFORMATIONAL_DOCUMENTS.includes(entry))) {
      this.#walk(root, item, file => lines.push(`${file}\0${sha(fs.readFileSync(path.join(root, file)))}`));
    }
    return sha(lines.join("\n"));
  }

  // Copies files only (like the historical workspaces), so a base copied from the live release and
  // a base reconstructed from a later tree have the same structure. Artifacts of batches newer than
  // the base are not part of the base release.
  #copyInto(sourceRoot, target) {
    fs.rmSync(target, { recursive: true, force: true });
    fs.mkdirSync(target, { recursive: true });
    const newer = file => {
      const batch = file.match(/^architecture\/migration\/stage_3_batch_(\d{3})_/u)?.[1] ??
        Object.entries(STAGE_DIRECTORIES).find(([directory]) => file.startsWith(directory))?.[1];
      return batch !== undefined && batch > BASE.batch;
    };
    for (const item of DATA) {
      this.#walk(sourceRoot, item, file => {
        if (newer(file)) return;
        const destination = path.join(target, file);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(path.join(sourceRoot, file), destination);
      });
    }
  }

  // The base fingerprint recorded while the live tree itself was the base release; a later
  // reconstruction must reproduce it exactly (the link check).
  #releaseRecord() { return path.join(path.dirname(this.cache), `release-${BASE.release}.json`); }

  async #reconstruct(target) {
    const state = JSON.parse(fs.readFileSync(path.join(this.root, "architecture/migration/stage_3_execution_state.json")));
    const atRelease = state.releaseVersion === BASE.release && state.activeBatchId === null &&
      !fs.readdirSync(path.join(this.root, "architecture/migration")).some(name =>
        (name.match(/^stage_3_batch_(\d{3})_/u)?.[1] || "000") > BASE.batch);
    if (atRelease) {
      this.#copyInto(this.root, target);
      fs.mkdirSync(path.dirname(this.#releaseRecord()), { recursive: true });
      fs.writeFileSync(this.#releaseRecord(), JSON.stringify({ base: this.fingerprint(target) }));
      return;
    }
    // The first shared batch after the base reverses itself and every newer batch.
    const { StageThreeBatchRegistry } = require("../../architecture/stage_three_batches/core/batch_definition");
    const { StageThreeHistoricalWorkspace } = require("../../architecture/stage_three_batches/lifecycle/historical_workspace");
    const next = String(Number(BASE.batch) + 1).padStart(3, "0");
    await new StageThreeHistoricalWorkspace(StageThreeBatchRegistry.load(next), StageThreeBatchRegistry)
      .run(this.root, prior => this.#copyInto(prior, target));
    const reconstructed = JSON.parse(fs.readFileSync(path.join(target, "architecture/migration/stage_3_execution_state.json")));
    if (reconstructed.releaseVersion !== BASE.release || reconstructed.activeBatchId !== null) {
      throw new Error(`History base reconstruction is not release ${BASE.release}`);
    }
    if (fs.existsSync(this.#releaseRecord())) {
      const expected = JSON.parse(fs.readFileSync(this.#releaseRecord(), "utf8")).base;
      if (this.fingerprint(target) !== expected) {
        throw new Error(`History base link check failed: the reconstruction differs from release ${BASE.release}`);
      }
    }
  }

  // Returns the base project root with the current tooling. The base is reused only while both the
  // live data and the base itself are byte-identical to the last reconstruction.
  async prepare() {
    const marker = path.join(this.cache, `${BASE.release}.json`);
    const head = this.fingerprint();
    const recorded = fs.existsSync(marker) ? JSON.parse(fs.readFileSync(marker, "utf8")) : null;
    const reusable = recorded && recorded.head === head && fs.existsSync(this.directory) &&
      this.fingerprint(this.directory) === recorded.base;
    if (!reusable) {
      await this.#reconstruct(this.directory);
      fs.mkdirSync(this.cache, { recursive: true });
      fs.writeFileSync(marker, JSON.stringify({ head, base: this.fingerprint(this.directory) }));
    }
    const utils = path.join(this.directory, "utils");
    fs.rmSync(utils, { recursive: true, force: true });
    fs.cpSync(path.join(this.root, "utils"), utils, { recursive: true });
    const modules = path.join(this.directory, "node_modules");
    if (!fs.existsSync(modules)) fs.symlinkSync(path.join(this.root, "node_modules"), modules, "junction");
    return this.directory;
  }
}

module.exports = { HistoryBase, BASE };
