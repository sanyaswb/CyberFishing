"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { NativeDevelopmentRetirement } = require("../stage_six/native_development_retirement");

// Current native startup/install validation; historical builders have no startup responsibility.
class NativeRuntimeReadiness {
  static verify(projectRoot) {
    assert(NativeDevelopmentRetirement.read(projectRoot), "Native runtime requires the accepted development retirement");
    this.assertNoGeneratedOutput(file => fs.existsSync(path.join(projectRoot, file)));
    return Object.freeze({ status: "native-esm", outputs: Object.freeze([]) });
  }

  static assertNoGeneratedOutput(isPresent) {
    assert(!isPresent("dist"), "Native runtime must not have generated dist output");
  }
}

module.exports = { NativeRuntimeReadiness };
