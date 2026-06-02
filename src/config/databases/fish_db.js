/**
 * Fish species database aggregator.
 *
 * Public global `FISH_DB` is kept stable while species are split by category.
 * Add new fish to `src/config/databases/fish/species/*.js`, not to this file.
 */
const FISH_DB = Object.values(
  typeof FISH_CATEGORIES !== "undefined" ? FISH_CATEGORIES : {},
).flat();
