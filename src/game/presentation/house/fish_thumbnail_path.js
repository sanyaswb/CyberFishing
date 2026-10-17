import { fishArtVariantPath } from "../fish/fish_art_variants.js";

// The 128 px thumbnail of a fish master (spec 100: one variant table in fish_art_variants.js).
export function fishThumbnailPath(imagePath) {
  return fishArtVariantPath(imagePath, "thumbnail");
}
