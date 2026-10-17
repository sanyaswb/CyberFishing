// Fish art sized for its use (spec 100 D4): the masters in assets/fish/ (2752 px) are never drawn into small boxes.
// thumbnail: keepnet cards, aquarium; display: the victory panel (its 260 px box x the canvas pixel-ratio cap 2,
// with room for larger layouts). Variants are generated from the tracked masters with
// `node utils/convert-images.js --thumbnails --input <masters> --output <directory> --size <maxSize>`.
export const FISH_ART_VARIANTS = Object.freeze({
  thumbnail: Object.freeze({ directory: "assets/fish-thumbnails/", maxSize: 128 }),
  display: Object.freeze({ directory: "assets/fish-display/", maxSize: 768 }),
});

const MASTER_DIRECTORY = "assets/fish/";

// A master path's variant (WebP, same relative path); any other path (no fish master) is returned unchanged.
export function fishArtVariantPath(imagePath, variant) {
  const entry = FISH_ART_VARIANTS[variant];
  if (!entry) throw new Error(`Unknown fish art variant ${variant}`);
  return typeof imagePath === "string" && imagePath.startsWith(MASTER_DIRECTORY)
    ? imagePath.replace(MASTER_DIRECTORY, entry.directory).replace(/\.[^.]+$/, ".webp") : imagePath || "";
}

// The fish's master image: its own imagePath, or the species' default master for its level.
export function fishMasterImagePath(fish) {
  const id = String(fish?.id || "unknown");
  const level = Number(fish?.level) || 1;
  return fish?.imagePath || `${MASTER_DIRECTORY}${id}/${id}--${level}.webp`;
}

// The one victory image source (spec 100 D4): drawn by the outcome frame and preloaded by the asset coordinator.
export function fishDisplayImagePath(fish) {
  return fishArtVariantPath(fishMasterImagePath(fish), "display");
}
