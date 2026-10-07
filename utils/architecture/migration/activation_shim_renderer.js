"use strict";

const { CanonicalActivationIdentity, EXACT_TRANSPORT_GLOBAL } = require("./compatibility_runtime_contract");

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

module.exports = { ActivationShimRenderer };
