import { assetIdForPath } from "../../../engine/assets/asset_registry_sync.js";

// Fish art (spec 100 D4, TK-180): one runtime image per fish, sized for the victory panel (768 px: its 260 px box x the
// canvas pixel-ratio cap 2, with room for larger layouts), named fish-display.<species>.<variant>.<file>; keepnet cards
// and the aquarium show its generated low-quality copy (spec 157 R17, about 192 px). The 2752 px masters live in
// asset-sources/ and are never released. The art has no empty edges (convert-images --thumbnails --trim, TK-222): each place
// draws it whole (contain) and sets its own margin.
const DISPLAY_PREFIX = "fish-display.";
// Saves written before TK-180 hold the master's (or a thumbnail's) path: the same file under another top folder.
const FORMER_PREFIXES = Object.freeze(["fish.", "fish-thumbnails."]);

// The one place that composes a fish image's asset id: the species' standard art for a level.
export function fishDisplayAssetId(fishId, level) {
  return `${DISPLAY_PREFIX}${fishId}.standart.${fishId}--${level}`;
}

// A caught fish keeps its image's file in game state (`imagePath`, saved); these map it to the files to show.
export class FishArtVariants {
  #assets;

  constructor({ assets }) {
    if (typeof assets?.idOfPath !== "function") throw new TypeError("FishArtVariants requires assets");
    this.#assets = assets;
  }

  // The fish image's asset id for a saved path (today's display file, or a former master or thumbnail), or null.
  displayIdOf(imagePath) {
    if (typeof imagePath !== "string" || !imagePath) return null;
    const id = this.#assets.idOfPath(imagePath) ?? assetIdForPath(imagePath);
    if (id.startsWith(DISPLAY_PREFIX)) return this.#assets.has(id) ? id : null;
    const former = FORMER_PREFIXES.find((prefix) => id.startsWith(prefix));
    const candidate = former ? `${DISPLAY_PREFIX}${id.slice(former.length)}` : null;
    return candidate && this.#assets.has(candidate) ? candidate : null;
  }

  // The image for the victory panel; any other path (no registered fish image) is returned unchanged.
  displayPath(imagePath) {
    const id = this.displayIdOf(imagePath);
    return id ? this.#assets.pathOf(id) : imagePath || "";
  }

  // The small image for keepnet cards and the aquarium: the display image's low copy.
  thumbnailPath(imagePath) {
    const id = this.displayIdOf(imagePath);
    return id ? this.#assets.lowPathOf(id) ?? this.#assets.pathOf(id) : imagePath || "";
  }

  // The fish's image: its own imagePath, or the species' standard image for its level ("" without one).
  imagePathOf(fish) {
    if (fish?.imagePath) return fish.imagePath;
    const id = fishDisplayAssetId(String(fish?.id || "unknown"), Number(fish?.level) || 1);
    return this.#assets.has(id) ? this.#assets.pathOf(id) : "";
  }

  // The one victory image source (spec 100 D4): drawn by the outcome frame and preloaded by the asset coordinator.
  displayImagePath(fish) {
    return this.displayPath(this.imagePathOf(fish));
  }
}
