export const OVERLAY_MODULES = {
  echo: true,
  state: true,
  chancesDetail: false,
  chum: false,

  fishBalance: true,
  fishSummary: false,
  fishCurrentForce: false,
  fishDebuffsSummary: false,
  fishBase: false,
  debuffsLive: false,

  fightSummary: false,
  lineAndDragSummary: false,
  rodControlSummary: false,
  fishMovementSummary: false,

  staminaBalance: false,

  worstCase: false,
  playerMax: false,
  liveY: false,
  liveX: false,

  fightPhysics: false,
  fightCore: false,
  fightPlayerForce: false,
  fightLineDrag: false,
  fightStress: false,
  fightStroke: false,

  fightFish: false,
  fightMovement: false,
  fightRodHold: false,
  fightReelHold: false,
  fightAutoRecovery: false,
  fightDrag: false,
  fightLine: false,
  fightRodStroke: false,
  fightRodControl: false,
  fightRodControlInput: false,
  fightRodControlForce: false,
  fightRodControlGeometry: false,
  fightRodControlVisual: false,
  fightTension: false,
};

export const BALANCE_OVERLAY_MODULE_KEYS = [
  "state",
  "fishBalance",
  "fishBase",
  "debuffsLive",
  "fightSummary",
  "lineAndDragSummary",
  "staminaBalance",
  "worstCase",
  "playerMax",
  "liveY",
  "liveX",
];

export const OPTIONAL_OVERLAY_MODULE_KEYS = [
  "fishSummary",
  "fishCurrentForce",
  "fishDebuffsSummary",
  "rodControlSummary",
  "fishMovementSummary",
  "chum",
  "chancesDetail",
  "echo",
];

export const ADVANCED_OVERLAY_MODULE_KEYS = [
  "fightPhysics",
  "fightCore",
  "fightPlayerForce",
  "fightLineDrag",
  "fightStress",
  "fightStroke",
  "fightFish",
  "fightMovement",
  "fightRodHold",
  "fightReelHold",
  "fightAutoRecovery",
  "fightDrag",
  "fightLine",
  "fightRodStroke",
  "fightRodControl",
  "fightRodControlInput",
  "fightRodControlForce",
  "fightRodControlGeometry",
  "fightRodControlVisual",
  "fightTension",
];

export const OVERLAY_MODULE_GROUPS = Object.freeze([
  Object.freeze({
    label: "Balance",
    keys: Object.freeze(BALANCE_OVERLAY_MODULE_KEYS),
  }),
  Object.freeze({
    label: "Optional",
    keys: Object.freeze(OPTIONAL_OVERLAY_MODULE_KEYS),
  }),
  Object.freeze({
    label: "Advanced",
    keys: Object.freeze(ADVANCED_OVERLAY_MODULE_KEYS),
  }),
]);

export const OVERLAY_MODULE_LABELS = Object.freeze({
  fishBase: Object.freeze({
    label: "Базова сила риби",
    original: "fishBase",
  }),
  debuffsLive: Object.freeze({
    label: "Дебафи наживо",
    original: "debuffsLive",
  }),
  playerMax: Object.freeze({
    label: "Максимум гравця",
    original: "playerMax",
  }),
  liveY: Object.freeze({
    label: "Живі сили Y",
    original: "liveY",
  }),
  liveX: Object.freeze({
    label: "Живі сили X",
    original: "liveX",
  }),
});

export const FIGHT_PHYSICS_CATEGORY_KEYS = [
  "fightCore",
  "fightPlayerForce",
  "fightLineDrag",
  "fightRodControl",
  "fightStress",
  "fightStroke",
];

export const FIGHT_PHYSICS_SECTION_KEYS = [
  "fightFish",
  "fightMovement",
  "fightRodHold",
  "fightReelHold",
  "fightAutoRecovery",
  "fightDrag",
  "fightLine",
  "fightRodStroke",
  "fightRodControlInput",
  "fightRodControlForce",
  "fightRodControlGeometry",
  "fightRodControlVisual",
  "fightTension",
];

export const FIGHT_PHYSICS_RENDER_KEYS = [
  ...FIGHT_PHYSICS_CATEGORY_KEYS,
  ...FIGHT_PHYSICS_SECTION_KEYS,
];
