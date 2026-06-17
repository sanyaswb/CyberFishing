const RENDER_ORDER = Object.freeze({
  BACKGROUND: 100,
  WORLD_DEBUG: 200,
  WORLD_ENTITIES: 300,
  CASTING_GUIDES: 400,
  FIGHT_AREAS: 500,
  FISHING_EQUIPMENT: 600,
  HUD: 700,
  OUTCOME: 800,
});

const RENDER_SEQUENCE = Object.freeze([
  "world",
  "casting",
  "fishing",
  "hud",
  "outcome",
]);

class RenderOrder {
  static get values() {
    return RENDER_ORDER;
  }

  static get sequence() {
    return RENDER_SEQUENCE;
  }

  static compare(leftOrder, rightOrder) {
    return (Number(leftOrder) || 0) - (Number(rightOrder) || 0);
  }

  static createPassList(passByName) {
    return RENDER_SEQUENCE.map((name) => {
      const pass = passByName?.[name];
      if (!pass || typeof pass.render !== "function") {
        throw new TypeError(`RenderOrder requires the "${name}" pass`);
      }
      return pass;
    });
  }
}
