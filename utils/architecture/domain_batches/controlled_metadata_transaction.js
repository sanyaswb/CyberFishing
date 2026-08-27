"use strict";

const fs = require("node:fs");
const path = require("node:path");

class ControlledMetadataTransaction {
  #projectRoot;
  #failureInjector;

  constructor({ projectRoot, failureInjector = null }) {
    this.#projectRoot = path.resolve(projectRoot);
    this.#failureInjector = failureInjector;
  }

  commit(writes, validateCommittedState) {
    const records = writes.map((write, index) => this.#record(write, index));
    try {
      for (const record of records) {
        fs.writeFileSync(record.stagingPath, record.bytes, { flag: "wx" });
      }
      this.#inject("after-staging", 0);
      for (const [index, record] of records.entries()) {
        if (record.originalExists) fs.renameSync(record.targetPath, record.backupPath);
        fs.renameSync(record.stagingPath, record.targetPath);
        record.replaced = true;
        this.#inject("after-replacement", index + 1);
      }
      validateCommittedState();
      this.#inject("after-final-validation", records.length);
      for (const record of records) {
        if (fs.existsSync(record.backupPath)) fs.unlinkSync(record.backupPath);
      }
    } catch (error) {
      this.#rollback(records);
      throw error;
    } finally {
      this.#cleanup(records);
    }
  }

  #record(write, index) {
    const relativePath = this.#normalize(write.relativePath);
    const targetPath = path.resolve(this.#projectRoot, relativePath);
    const expectedPath = path.join(this.#projectRoot, ...relativePath.split("/"));
    if (targetPath !== path.resolve(expectedPath) || !targetPath.startsWith(`${this.#projectRoot}${path.sep}`)) {
      throw new Error(`Controlled metadata target escapes project root: ${relativePath}`);
    }
    const parent = path.dirname(targetPath);
    if (!fs.existsSync(parent) || !fs.statSync(parent).isDirectory()) {
      throw new Error(`Controlled metadata parent is missing: ${relativePath}`);
    }
    const token = `${process.pid}-${index}`;
    const stagingPath = path.join(parent, `.${path.basename(targetPath)}.stage-${token}`);
    const backupPath = path.join(parent, `.${path.basename(targetPath)}.backup-${token}`);
    for (const controlledPath of [stagingPath, backupPath]) {
      if (path.dirname(controlledPath) !== parent || fs.existsSync(controlledPath)) {
        throw new Error(`Unsafe or occupied transaction path: ${controlledPath}`);
      }
    }
    const originalExists = fs.existsSync(targetPath);
    return {
      targetPath,
      stagingPath,
      backupPath,
      bytes: Buffer.isBuffer(write.bytes) ? write.bytes : Buffer.from(write.bytes),
      originalExists,
      originalBytes: originalExists ? fs.readFileSync(targetPath) : null,
      replaced: false,
    };
  }

  #rollback(records) {
    for (const record of [...records].reverse()) {
      if (record.replaced && fs.existsSync(record.targetPath)) fs.unlinkSync(record.targetPath);
      if (fs.existsSync(record.backupPath)) fs.renameSync(record.backupPath, record.targetPath);
      if (record.originalExists && !fs.existsSync(record.targetPath)) {
        fs.writeFileSync(record.targetPath, record.originalBytes, { flag: "wx" });
      }
      if (!record.originalExists && fs.existsSync(record.targetPath)) fs.unlinkSync(record.targetPath);
    }
    for (const record of records) {
      if (record.originalExists && !record.originalBytes.equals(fs.readFileSync(record.targetPath))) {
        throw new Error(`Transaction rollback changed original bytes: ${record.targetPath}`);
      }
      if (!record.originalExists && fs.existsSync(record.targetPath)) {
        throw new Error(`Transaction rollback retained a new file: ${record.targetPath}`);
      }
    }
  }

  #cleanup(records) {
    for (const record of records) {
      for (const controlledPath of [record.stagingPath, record.backupPath]) {
        if (fs.existsSync(controlledPath)) fs.unlinkSync(controlledPath);
      }
    }
  }

  #normalize(relativePath) {
    if (typeof relativePath !== "string" || relativePath.length === 0 ||
        relativePath.includes("\\") || relativePath.includes("*") ||
        relativePath.split("/").some((part) => part === "" || part === "." || part === "..")) {
      throw new Error(`Invalid controlled metadata path: ${relativePath}`);
    }
    return relativePath;
  }

  #inject(phase, count) {
    if (this.#failureInjector) this.#failureInjector({ phase, count });
  }
}

module.exports = { ControlledMetadataTransaction };
