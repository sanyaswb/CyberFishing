const OVERLAY_MODULES = {
  echo: false,
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
  fightFish: false,
  fightRodHold: false,
  fightReelHold: false,
  fightDrag: false,
  fightLine: false,
  fightRodStroke: false,
  fightAutoRecovery: false,
  fightMovement: false,
  fightTension: false,
};

const FIGHT_PHYSICS_SECTION_KEYS = [
  "fightFish",
  "fightRodHold",
  "fightReelHold",
  "fightDrag",
  "fightLine",
  "fightRodStroke",
  "fightAutoRecovery",
  "fightMovement",
  "fightTension",
];

window.OVERLAY_MODULES = OVERLAY_MODULES;
window.FIGHT_PHYSICS_SECTION_KEYS = FIGHT_PHYSICS_SECTION_KEYS;
