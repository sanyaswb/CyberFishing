const fs = require("node:fs");

// Tracked expected output of a behavior-reference check. A difference fails the check and names the first changed
// line; `update` rewrites the file and is only used by an explicit baseline command, never by the check runner.
class OutputBaseline {
  #file;

  constructor({ file }) {
    this.#file = file;
  }

  verify(output, { update = false } = {}) {
    if (update) {
      fs.writeFileSync(this.#file, output, "utf8");
      process.stderr.write("baseline updated: " + this.#file + "\n");
      return;
    }
    if (!fs.existsSync(this.#file)) {
      throw new Error("Missing baseline " + this.#file + " (create it with the baseline command)");
    }
    const expected = fs.readFileSync(this.#file, "utf8").replace(/\r\n/gu, "\n");
    if (expected === output) return;
    const expectedLines = expected.split("\n");
    const actualLines = output.split("\n");
    let index = 0;
    while (index < expectedLines.length && expectedLines[index] === actualLines[index]) index++;
    throw new Error("Output differs from baseline " + this.#file + " at line " + (index + 1) +
      "\n  expected: " + (expectedLines[index] ?? "<end>") +
      "\n  actual:   " + (actualLines[index] ?? "<end>") +
      "\nReview the behavior change; re-baseline only when it is intended.");
  }
}

module.exports = { OutputBaseline };
