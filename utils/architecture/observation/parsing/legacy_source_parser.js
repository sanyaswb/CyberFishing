const espree = require("espree");

class LegacySourceParser {
  parse(source) {
    try {
      return {
        status: "parsed",
        syntaxTree: espree.parse(source, {
          ecmaVersion: "latest",
          sourceType: "script",
          loc: true,
          range: true,
        }),
      };
    } catch (error) {
      return {
        status: "failed",
        issue: {
          code: "parse-failure",
          message: "Source cannot be parsed as a browser classic script.",
        },
        diagnostic: {
          message: error.message,
          line: Number.isInteger(error.lineNumber) ? error.lineNumber : null,
          column: Number.isInteger(error.column) ? error.column : null,
        },
      };
    }
  }
}

module.exports = { LegacySourceParser };
