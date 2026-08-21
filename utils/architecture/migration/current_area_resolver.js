const path = require("node:path");

class CurrentAreaResolver {
  constructor({ sourcePrefix = "src/", rootValue = "root" } = {}) {
    this.sourcePrefix = sourcePrefix;
    this.rootValue = rootValue;
  }

  resolve(currentPath) {
    const relativeToSource = currentPath.startsWith(this.sourcePrefix)
      ? currentPath.slice(this.sourcePrefix.length)
      : currentPath;
    const directory = path.posix.dirname(relativeToSource);
    return directory === "." ? this.rootValue : directory;
  }
}

module.exports = { CurrentAreaResolver };
