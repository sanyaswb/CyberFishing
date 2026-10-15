// Cheapest first: what a cold start downloads to make a resource usable.
const COLD_ORDER = Object.freeze(["l", "legacy", "m", "h"]);
const LOW_ORDER = Object.freeze(["l", "legacy"]);
const MODES = new Set(["auto", "low", "high"]);

// Pure tier/format choice for one catalog asset (spec 083, rules in spec 047 "Variant Selection and Fallback").
// Formats are tried in the injected preference order; unsupported formats are never chosen.
export class AssetVariantSelector {
  // The variant that makes the asset usable now. A ready variant the mode allows wins over a new download (the best
  // one); otherwise the cheapest permitted tier. Low mode never chooses m/h for a new consumer.
  selectMinimum(asset, { mode = "auto", formats, isReady = () => false }) {
    const candidates = this.#candidates(asset, this.#mode(mode) === "low" ? LOW_ORDER : COLD_ORDER, formats);
    for (let index = candidates.length - 1; index >= 0; index -= 1)
      if (isReady(candidates[index])) return candidates[index];
    return candidates[0] ?? null;
  }

  // The quality the asset should reach when upgrades are allowed: High only with allowHigh (budget, conditions),
  // Middle when present and High is not allowed, otherwise the minimum tier. Low mode targets its minimum.
  selectTarget(asset, { mode = "auto", formats, allowHigh = false }) {
    const resolvedMode = this.#mode(mode);
    if (resolvedMode === "low") return this.#candidates(asset, LOW_ORDER, formats)[0] ?? null;
    const preferred = allowHigh || resolvedMode === "high" ? ["h", "m"] : ["m"];
    return this.#candidates(asset, preferred, formats)[0] ?? this.selectMinimum(asset, { mode: resolvedMode, formats });
  }

  // Candidates in tier order; within a tier the first supported format by preference.
  #candidates(asset, order, formats) {
    const result = [];
    for (const tier of order) {
      for (const format of formats) {
        const variant = asset.variants.find((entry) => entry.tier === tier && entry.format === format);
        if (variant) { result.push(variant); break; }
      }
    }
    return result;
  }

  #mode(mode) {
    if (!MODES.has(mode)) throw new Error(`AssetVariantSelector: unknown quality mode "${mode}"`);
    return mode;
  }
}
