"use strict";

const espree = require("espree");
const {
  CanonicalActivationIdentity,
  EXACT_TRANSPORT_GLOBAL,
} = require("./cumulative_runtime_contract");

class ActivationShimRenderer {
  render(activation, transportSymbol = EXACT_TRANSPORT_GLOBAL) {
    CanonicalActivationIdentity.object(activation);
    if (transportSymbol !== EXACT_TRANSPORT_GLOBAL) {
      throw new Error("Activation shim requires the exact compatibility transport global");
    }
    return (
      `globalThis.${activation.legacySymbol} = ` +
      `globalThis.${transportSymbol}.modules` +
      `[${JSON.stringify(activation.targetModule)}]` +
      `[${JSON.stringify(activation.exportName)}];\n`
    );
  }
}

class ActivationShimContractValidator {
  validate({ code, activation, transportSymbol = EXACT_TRANSPORT_GLOBAL }) {
    const expected = new ActivationShimRenderer().render(activation, transportSymbol);
    if (code !== expected) {
      throw new Error(`Activation shim differs from exact contract: ${activation.id}`);
    }
    const tree = espree.parse(code, {
      ecmaVersion: "latest",
      sourceType: "script",
    });
    if (tree.body.length !== 1 || tree.body[0].type !== "ExpressionStatement") {
      throw new Error(`Activation shim contains non-contract statements: ${activation.id}`);
    }
    return Object.freeze({
      id: activation.id,
      legacyScriptIndex: activation.legacyScriptIndex,
      legacySymbol: activation.legacySymbol,
      targetModule: activation.targetModule,
      exportName: activation.exportName,
    });
  }
}

module.exports = { ActivationShimContractValidator, ActivationShimRenderer };
