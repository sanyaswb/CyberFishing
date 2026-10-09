import { FISH_CATEGORIES } from "./fish/fish_categories.js";

/**
 * Fish species database aggregator.
 *
 * Species are authored by category in `src/game/config/raw/fish/*.js`; add new fish there.
 */
export const FISH_DB = Object.values(FISH_CATEGORIES).flat();
