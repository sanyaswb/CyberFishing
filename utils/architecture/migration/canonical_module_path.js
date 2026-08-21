const path = require("node:path");

class CanonicalModulePath {
  isSourcePath(candidate) {
    return this.isRepositoryPath(candidate) &&
      candidate.startsWith("src/") &&
      candidate.endsWith(".js");
  }

  isRepositoryPath(candidate) {
    if (typeof candidate !== "string" || candidate.length === 0) return false;
    if (candidate.includes("\\") || candidate.startsWith("./")) return false;
    if (path.posix.isAbsolute(candidate) || path.win32.isAbsolute(candidate)) {
      return false;
    }
    const segments = candidate.split("/");
    if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
      return false;
    }
    return path.posix.normalize(candidate) === candidate;
  }
}

module.exports = { CanonicalModulePath };
