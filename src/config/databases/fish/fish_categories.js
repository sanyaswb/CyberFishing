/** Public category registry for fish database tooling and validation. */
const FISH_CATEGORIES = Object.freeze({
  peaceful: typeof PEACEFUL_FISH !== "undefined" ? PEACEFUL_FISH : [],
  predator: typeof PREDATOR_FISH !== "undefined" ? PREDATOR_FISH : [],
  rare: typeof RARE_FISH !== "undefined" ? RARE_FISH : [],
  event: typeof EVENT_FISH !== "undefined" ? EVENT_FISH : [],
});
