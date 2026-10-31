// Fish art sized for its use (spec 100 D4): the masters (2752 px) are never drawn into small boxes. thumbnail: keepnet
// cards, aquarium; display: the victory panel (its 260 px box x the canvas pixel-ratio cap 2, with room for larger
// layouts). Variants are generated from the tracked masters with
// `node utils/convert-images.js --thumbnails --input <masters> --output <directory> --size <maxSize>`.
// By asset id (spec 157 R16): a master `fish.<species>.<…>` has its variants at the same rest of the id under the
// variant's prefix.
export const FISH_ART_VARIANTS = Object.freeze({
  thumbnail: Object.freeze({ assetPrefix: "fish-thumbnails.", maxSize: 128 }),
  display: Object.freeze({ assetPrefix: "fish-display.", maxSize: 768 }),
});

const MASTER_PREFIX = "fish.";

// The one place that composes a fish master's asset id: the species' standard art for a level.
export function fishMasterAssetId(fishId, level) {
  return `${MASTER_PREFIX}${fishId}.standart.${fishId}--${level}`;
}

// A caught fish keeps its master's file in game state (`imagePath`, saved); these map it to the variant files.
export class FishArtVariants {
  #assets;

  constructor({ assets }) {
    if (typeof assets?.idOfPath !== "function") throw new TypeError("FishArtVariants requires assets");
    this.#assets = assets;
  }

  // A master's variant file; any other path (no registered fish master) is returned unchanged.
  variantPath(imagePath, variant) {
    const entry = FISH_ART_VARIANTS[variant];
    if (!entry) throw new Error(`Unknown fish art variant ${variant}`);
    if (typeof imagePath !== "string" || !imagePath) return "";
    const masterId = this.#assets.idOfPath(imagePath);
    const variantId = masterId?.startsWith(MASTER_PREFIX) ? `${entry.assetPrefix}${masterId.slice(MASTER_PREFIX.length)}` : null;
    return variantId && this.#assets.has(variantId) ? this.#assets.pathOf(variantId) : imagePath;
  }

  // The fish's master image: its own imagePath, or the species' standard master for its level ("" without one).
  masterImagePath(fish) {
    if (fish?.imagePath) return fish.imagePath;
    const masterId = fishMasterAssetId(String(fish?.id || "unknown"), Number(fish?.level) || 1);
    return this.#assets.has(masterId) ? this.#assets.pathOf(masterId) : "";
  }

  // The one victory image source (spec 100 D4): drawn by the outcome frame and preloaded by the asset coordinator.
  displayImagePath(fish) {
    return this.variantPath(this.masterImagePath(fish), "display");
  }

  thumbnailPath(imagePath) {
    return this.variantPath(imagePath, "thumbnail");
  }
}
