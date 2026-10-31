import { fishMasterAssetId } from "./fish_art_variants.js";

// The image of a caught fish (spec 157 R16): the species' visual names its art by asset-id patterns with "{level}"
// (imageAssetPattern, uniqueImageAssetPattern for a unique anomaly fish). The fish keeps the file in game state
// (imagePath, saved as before), so the resolver hands out the registry's file; an id the registry does not have gives
// no image ("", the fish is drawn without art) instead of a guessed path.
export class FishVisualVariantResolver {
  #noneAnomalyIds;
  #assets;

  constructor({ assets, noneAnomalyIds = ["", "none"] } = {}) {
    if (typeof assets?.pathOf !== "function") throw new TypeError("FishVisualVariantResolver requires assets");
    this.#assets = assets;
    this.#noneAnomalyIds = new Set(
      noneAnomalyIds.map((value) =>
        String(value || "").trim().toLowerCase(),
      ),
    );
  }

  resolveImagePath({
    visual = null,
    fishId = "unknown",
    level = 1,
    isUnique = false,
    anomaly = "none",
  } = {}) {
    const config = visual || {};
    const normalizedLevel = Math.max(1, Math.round(Number(level) || 1));
    const anomalyId = String(anomaly || "none").trim().toLowerCase();
    const uniquePattern = String(config.uniqueImageAssetPattern || "").trim();
    const pattern = isUnique === true && !this.#noneAnomalyIds.has(anomalyId) && uniquePattern
      ? uniquePattern
      : String(config.imageAssetPattern || "").trim() || fishMasterAssetId(fishId, "{level}");
    const assetId = pattern.replace("{level}", normalizedLevel);
    return this.#assets.has(assetId) ? this.#assets.pathOf(assetId) : "";
  }
}
