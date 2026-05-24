/**
 * Canonical physics units and naming convention.
 *
 * Runtime code can reference this object for tooling/debug help. The detailed
 * human-readable guide lives in docs/physics_units_and_naming.md.
 */
const PHYSICS_UNITS_AND_NAMING = Object.freeze({
  gameplayLoadUnit: Object.freeze({
    suffix: "Kg",
    meaning:
      "Gameplay load unit calibrated to tackle max-load kilograms; not a real Newton force.",
  }),
  suffixes: Object.freeze({
    Px: "screen/world pixels",
    Meters: "game-world meters",
    MetersPerSecond: "game-world meters per second",
    PxPerSec: "pixels per second",
    Kg: "gameplay load kilograms",
    Ratio: "normalized 0..1 ratio unless explicitly documented otherwise",
    Percent: "0..100 percentage",
    Ms: "milliseconds",
    PerSecond: "per-second rate",
  }),
  requiredPhysicsSuffixes: Object.freeze([
    "Px",
    "PxPerSec",
    "Meters",
    "MetersPerSecond",
    "Kg",
    "Ratio",
    "Percent",
    "Ms",
    "PerSecond",
  ]),
  allowedContextWords: Object.freeze([
    "Multiplier",
    "Coefficient",
    "Enabled",
    "Chance",
    "Power",
    "Level",
    "Count",
    "Duration",
    "AngleDeg",
    "Direction",
  ]),
});
