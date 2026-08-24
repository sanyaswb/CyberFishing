const espree = require("espree");

class LegacySourceParser {
  parse(source) {
    try {
      return {
        status: "parsed",
        sourceType: "script",
        syntaxTree: espree.parse(source, {
          ecmaVersion: "latest",
          sourceType: "script",
          loc: true,
          range: true,
        }),
      };
    } catch (scriptError) {
      try {
        return {
          status: "parsed",
          sourceType: "module",
          syntaxTree: espree.parse(source, {
            ecmaVersion: "latest",
            sourceType: "module",
            loc: true,
            range: true,
          }),
        };
      } catch (moduleError) {
        return {
          status: "failed",
          issue: {
            code: "parse-failure",
            message: "Source cannot be parsed as JavaScript script or module.",
          },
          diagnostic: {
            message: moduleError.message,
            line: Number.isInteger(moduleError.lineNumber)
              ? moduleError.lineNumber
              : null,
            column: Number.isInteger(moduleError.column)
              ? moduleError.column
              : null,
          },
        };
      }
    }
  }
}

module.exports = { LegacySourceParser };
