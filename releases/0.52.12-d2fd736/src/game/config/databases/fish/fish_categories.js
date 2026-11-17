import { EVENT_FISH } from "../../raw/fish/event_fish.js";
import { PEACEFUL_FISH } from "../../raw/fish/peaceful_fish.js";
import { PREDATOR_FISH } from "../../raw/fish/predator_fish.js";
import { RARE_FISH } from "../../raw/fish/rare_fish.js";

/** Public category registry for fish database tooling and validation. */
export const FISH_CATEGORIES = Object.freeze({
  peaceful: PEACEFUL_FISH,
  predator: PREDATOR_FISH,
  rare: RARE_FISH,
  event: EVENT_FISH,
});
