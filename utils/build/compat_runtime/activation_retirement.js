"use strict";

const espree = require("espree");
const { CanonicalActivationIdentity } = require("./cumulative_runtime_contract");

const RETIREMENT_REASON = "all-listed-legacy-consumers-migrated";
const PLACEHOLDER_KIND = "inert-classic-position";
// A source that keeps other active activations (batch 045) loses only the retired activation's shim
// line and tag; its classic position stays held by the remaining activations.
const SHARED_SOURCE_KIND = "shared-source-line-removed";

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

  // One classic source that served several activations holds one comment line per activation, in
  // activation-id order; a source with one activation renders exactly as `render`.
  renderProvider(activations) {
    const provider = RetiredActivationPlaceholder.provider(activations);
    return RetiredActivationPlaceholder.ordered(activations).map((activation) => {
      if (activation.sourceProvider !== provider) throw new Error(`Retired placeholder mixes sources: ${activation.id}`);
      return this.render(activation);
    }).join("");
  }

  validateProvider({ code, activations }) {
    const provider = RetiredActivationPlaceholder.provider(activations);
    if (code !== this.renderProvider(activations)) {
      throw new Error(`Retired activation placeholder differs from contract: ${provider}`);
    }
    if (espree.parse(code, { ecmaVersion: "latest", sourceType: "script" }).body.length !== 0) {
      throw new Error(`Retired activation placeholder contains statements: ${provider}`);
    }
    return RetiredActivationPlaceholder.ordered(activations)
      .map((activation) => Object.freeze({ id: activation.id, sourceProvider: activation.sourceProvider }));
  }

  // Retiring activations grouped by classic source, in source order.
  static byProvider(activations) {
    const groups = new Map();
    for (const activation of activations) {
      groups.set(activation.sourceProvider, [...(groups.get(activation.sourceProvider) || []), activation]);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right))
      .map(([sourceProvider, members]) => ({ sourceProvider, activations: RetiredActivationPlaceholder.ordered(members) }));
  }

  static ordered(activations) {
    return [...activations].sort((left, right) => left.id.localeCompare(right.id));
  }

  static provider(activations) {
    if (!Array.isArray(activations) || activations.length === 0) {
      throw new Error("Retired placeholder needs at least one activation");
    }
    return activations[0].sourceProvider;
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
    // A classic source retires as a whole (inert placeholder) unless another activation of the same
    // source stays active: then only the retired shim line and tag are removed.
    const shared = ActivationRetirementProjection.sharedSources(runtime, retiredActivations);
    if (retiring.size === 0) return runtime;
    return {
      ...runtime,
      activationPositions: runtime.activationPositions.filter((activation) => !retiring.has(activation.id)),
      retiredActivations: [...(runtime.retiredActivations || []), ...retiredActivations.map((activation) => ({
        activation: { ...activation },
        placeholder: shared.has(activation.sourceProvider) ? SHARED_SOURCE_KIND : PLACEHOLDER_KIND,
        reason: RETIREMENT_REASON,
        retiredBy,
      }))].sort((left, right) => left.activation.id.localeCompare(right.activation.id)),
    };
  }

  // Sources whose other activations stay active after the retirement.
  static sharedSources(runtime, retiredActivations) {
    const retiring = new Set(retiredActivations.map((activation) => activation.id));
    return new Set(runtime.activationPositions.filter((activation) => !retiring.has(activation.id) &&
      retiredActivations.some((retired) => retired.sourceProvider === activation.sourceProvider))
      .map((activation) => activation.sourceProvider));
  }

  // Each retired source gets back its single classic tag: the first of its shim tags becomes the
  // source tag and the source's other shim tags (one legacy position) are removed with their line.
  // A shared source (sharedSources) keeps its remaining shim tags; only the retired ones are removed.
  index(html, outputDirectory, retiredActivations, sharedSources = new Set()) {
    let result = html;
    for (const { sourceProvider, activations } of RetiredActivationPlaceholder.byProvider(retiredActivations)) {
      const tags = activations.map((activation) => {
        const shimSource = `${outputDirectory}${activation.shimFile}`;
        const escapedSource = shimSource.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        // Split legacy slots add data-legacy-slot after src. Match the complete tag and preserve
        // those reviewed attributes when the classic provider tag is restored.
        const pattern = new RegExp(`<script\\b[^>]*\\bsrc="${escapedSource}"[^>]*></script>`, "gu");
        const matches = [...result.matchAll(pattern)];
        if (matches.length !== 1) {
          throw new Error(`Retired activation shim tag is not unique: ${activation.id}`);
        }
        return { shimTag: matches[0][0], shimSource, position: matches[0].index };
      }).sort((left, right) => left.position - right.position);
      const [first, ...rest] = tags;
      for (const { shimTag } of sharedSources.has(sourceProvider) ? tags : rest) {
        const line = new RegExp(`\\r?\\n[ \\t]*${shimTag.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}`, "gu");
        if ([...result.matchAll(line)].length !== 1) throw new Error(`Retired shim tag is not on its own line: ${shimTag}`);
        result = result.replace(line, "");
      }
      if (sharedSources.has(sourceProvider)) continue;
      result = result.replace(first.shimTag,
        () => first.shimTag.replace(`src="${first.shimSource}"`, `src="${sourceProvider}"`));
    }
    return result;
  }
}

module.exports = {
  ActivationRetirementProjection,
  PLACEHOLDER_KIND,
  RETIREMENT_REASON,
  SHARED_SOURCE_KIND,
  RetiredActivationPlaceholder,
};
