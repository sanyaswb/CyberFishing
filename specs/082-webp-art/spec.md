# Raster art as WebP; masters in asset-sources

Owner request, 2026-10-15: optimize the images with the `convert-images` utility, WebP at medium quality.

## Change

- `utils/convert-images.js` v1.4.0 gains a non-interactive mode with the dialogue's presets and naming:
  `node utils/convert-images.js --batch [--quality low|middle|high] [--format webp|avif|both] [--input assets]`.
  It converts the PNG/JPG files under one project folder next to their sources and leaves the sources in place.
  The interactive dialogue and `--thumbnails` are unchanged.
- Ran `--batch --quality middle --format webp --input assets` ("Middle" = WebP 80): all 19 PNG/JPG assets (15 House
  room backgrounds, the aquarium layer, the renovation art, the two bamboo rod skins). Same dimensions; transparency
  kept on the four PNG layers. Total 49.9 MB → 5.9 MB (a room background 2.4–3.3 MB → 0.21–0.59 MB).
- The sources move to `asset-sources/` with the same relative paths (spec 047's masters folder). A rename reuses the
  stored blobs; the Pages builder publishes only `assets/`, so masters never reach a release.
- References now name the WebP files: `HOUSE_CONFIG` backgrounds/aquarium/renovation, the House page preloads and
  renovation image, the bamboo rod skin in `ITEM_DB`, the UI catalog keepnet example, the Pages release check.
- The Pages release check rejects released PNG/JPG under `assets/` and any released `asset-sources/` file.

The depth map (a data image) was already WebP and is untouched. No gameplay, save or formula changes.

## Verification

House, UI catalog, inventory integration and Pages release checks; Architecture, Quick, Full. The owner compares the
art quality in the browser (House rooms at every level and time of day, renovation, aquarium, bamboo rod).
