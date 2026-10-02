import { EVENT_FISH } from "../../raw/fish/event_fish.js";
import { PEACEFUL_FISH } from "../../raw/fish/peaceful_fish.js";
import { PREDATOR_FISH } from "../../raw/fish/predator_fish.js";
import { RARE_FISH } from "../../raw/fish/rare_fish.js";

/** Public category registry for fish database tooling and validation. */
export const FISH_CATEGORIES = Object.freeze({
  peaceful: typeof PEACEFUL_FISH !== "undefined" ? PEACEFUL_FISH : [],
  predator: typeof PREDATOR_FISH !== "undefined" ? PREDATOR_FISH : [],
  rare: typeof RARE_FISH !== "undefined" ? RARE_FISH : [],
  event: typeof EVENT_FISH !== "undefined" ? EVENT_FISH : [],
});
