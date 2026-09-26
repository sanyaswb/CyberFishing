"use strict";

const espree = require("espree");
const { CanonicalActivationIdentity } = require("./cumulative_runtime_contract");

const RETIREMENT_REASON = "all-listed-legacy-consumers-migrated";
const PLACEHOLDER_KIND = "inert-classic-position";

// A retired activation keeps its legacy script position as an inert classic placeholder: the
// source provider holds one comment line and publishes no global.
class RetiredActivationPlaceholder {
  render(activation) {
    CanonicalActivationIdentity.object(activation);
    if (activation.id !== CanonicalActivationIdentity.id(activation)) {
      throw new Error(`Retired activation id is not canonical: ${activation.id}`);
    }
    return `// Retired Stage 3 activation ${activation.id}: ${activation.legacySymbol} is served only ` +
      `through ESM imports of ${activation.targetModule}.\n`;
  }

  validate({ code, activation }) {
    if (code !== this.render(activation)) {
      throw new Error(`Retired activation placeholder differs from contract: ${activation.id}`);
    }
    if (espree.parse(code, { ecmaVersion: "latest", sourceType: "script" }).body.length !== 0) {
      throw new Error(`Retired activation placeholder contains statements: ${activation.id}`);
    }
    return Object.freeze({ id: activation.id, sourceProvider: activation.sourceProvider });
  }
}

// Projects a batch's activation retirement onto the runtime contract and the classic index.
class ActivationRetirementProjection {
  contract(runtime, retiredActivations, retiredBy) {
    const retiring = new Set(retiredActivations.map((activation) => activation.id));
    for (const activation of retiredActivations) {
      const active = runtime.activationPositions.find((item) => item.id === activation.id);
      if (!active || JSON.stringify(active) !== JSON.stringify(activation)) {
        throw new Error(`Retired activation is not the active contract: ${activation.id}`);
      }
    }
    if (retiring.size === 0) return runtime;
    return {
      ...runtime,
      activationPositions: runtime.activationPositions.filter((activation) => !retiring.has(activation.id)),
      retiredActivations: [...(runtime.retiredActivations || []), ...retiredActivations.map((activation) => ({
        activation: { ...activation },
        placeholder: PLACEHOLDER_KIND,
        reason: RETIREMENT_REASON,
        retiredBy,
      }))].sort((left, right) => left.activation.id.localeCompare(right.activation.id)),
    };
  }

  index(html, outputDirectory, retiredActivations) {
    let result = html;
    for (const activation of retiredActivations) {
      const shimTag = `<script src="${outputDirectory}${activation.shimFile}"></script>`;
      if (result.split(shimTag).length !== 2) {
        throw new Error(`Retired activation shim tag is not unique: ${activation.id}`);
      }
      result = result.replace(shimTag, () => `<script src="${activation.sourceProvider}"></script>`);
    }
    return result;
  }
}

module.exports = {
  ActivationRetirementProjection,
  PLACEHOLDER_KIND,
  RETIREMENT_REASON,
  RetiredActivationPlaceholder,
};
