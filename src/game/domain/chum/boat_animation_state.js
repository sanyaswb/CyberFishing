export const BOAT_ANIMATION_CLIPS = Object.freeze({
  IMMERSION: "boat3--immersion",
  MOVE_START: "boat3--move-forvard_start",
  MOVE_LOOP: "boat3--move-forvard1",
  OPEN_SECTION_1: "boat3--open-section-1",
  OPEN_SECTION_2: "boat3--open-section-2",
  OPEN_SECTION_3: "boat3--open-section-3",
});

// The clips' lengths in the export (assets/animations/boats/boat-lvl--3.json); the boat's timers use them, and the
// bait-boat-spine-animation check compares them with the export (TK-160).
export const BOAT_ANIMATION_DURATIONS = Object.freeze({
  [BOAT_ANIMATION_CLIPS.IMMERSION]: 1.25,
  [BOAT_ANIMATION_CLIPS.MOVE_START]: 1.333,
  [BOAT_ANIMATION_CLIPS.MOVE_LOOP]: 1.333,
  [BOAT_ANIMATION_CLIPS.OPEN_SECTION_1]: 1.583,
  [BOAT_ANIMATION_CLIPS.OPEN_SECTION_2]: 1.583,
  [BOAT_ANIMATION_CLIPS.OPEN_SECTION_3]: 1.583,
});

export const BOAT_LIGHT_SLOTS = Object.freeze([
  "boat-light",
  "boat3-night_light",
  "boat3-night_light2",
  "boat3-night_light3",
]);

export const BOAT_BAIT_SLOTS = Object.freeze({
  1: "section--1-bait",
  2: "section--1-bait2",
  3: "section--1-bait3",
});

export const BOAT_SECTION_CLIPS = Object.freeze({
  1: BOAT_ANIMATION_CLIPS.OPEN_SECTION_1,
  2: BOAT_ANIMATION_CLIPS.OPEN_SECTION_2,
  3: BOAT_ANIMATION_CLIPS.OPEN_SECTION_3,
});
