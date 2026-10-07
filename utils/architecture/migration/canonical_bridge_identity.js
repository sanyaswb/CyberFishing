"use strict";

const crypto = require("node:crypto");
const path = require("node:path");

class CanonicalBridgeIdentity {
  static normalizePath(value) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("Bridge identity path must be a non-empty string");
    }
    if (
      value.includes("\\") ||
      /[*?[\]]/.test(value) ||
      path.isAbsolute(value) ||
      /^[A-Za-z]:/.test(value) ||
      value.split("/").some((part) =>
        part === "" || part === "." || part === "..")
    ) {
      throw new Error(`Bridge identity path is not canonical: ${value}`);
    }
    return value;
  }

  static object(record) {
    return {
      bridge: this.normalizePath(record.bridge),
      owner: this.#requireText(record.owner, "owner"),
      source: this.normalizePath(record.source),
      target: this.normalizePath(record.target),
    };
  }

  static serialize(record) {
    const identity = this.object(record);
    return JSON.stringify({
      bridge: identity.bridge,
      owner: identity.owner,
      source: identity.source,
      target: identity.target,
    });
  }

  static id(record) {
    const digest = crypto
      .createHash("sha256")
      .update(Buffer.from(this.serialize(record), "utf8"))
      .digest("hex");
    return `bridge-${digest.slice(0, 12)}`;
  }

  static #requireText(value, field) {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new Error(`Bridge identity ${field} must be a non-empty string`);
    }
    return value;
  }
}

module.exports = { CanonicalBridgeIdentity };
