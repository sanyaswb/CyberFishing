const OVERLAY_MODULES = {
  echo: true,
  chancesDetail: false,
  state: true,
  chum: false,
  fishBase: false,
  fishStates: true,
  worstCase: false,
  playerMax: false,
  liveY: false,
  liveX: false,
  debuffsLive: false,
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

const FIGHT_PHYSICS_CATEGORY_KEYS = [
  "fightCore",
  "fightPlayerForce",
  "fightLineDrag",
  "fightRodControl",
  "fightStress",
  "fightStroke",
];

const FIGHT_PHYSICS_SECTION_KEYS = [
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

const FIGHT_PHYSICS_RENDER_KEYS = [
  ...FIGHT_PHYSICS_CATEGORY_KEYS,
  ...FIGHT_PHYSICS_SECTION_KEYS,
];

window.OVERLAY_MODULES = OVERLAY_MODULES;
window.FIGHT_PHYSICS_CATEGORY_KEYS = FIGHT_PHYSICS_CATEGORY_KEYS;
window.FIGHT_PHYSICS_SECTION_KEYS = FIGHT_PHYSICS_SECTION_KEYS;
window.FIGHT_PHYSICS_RENDER_KEYS = FIGHT_PHYSICS_RENDER_KEYS;
