import { BalanceFormRows } from "./balance_form_rows.js";

// What the overlay window «🎣 ACTIVE ROD» shows and edits (spec 168, owner answers Q2 (а), Q3 (б)): the equipped rod's
// catalog item (ITEM_DB.rods.<id>.gameplayStats: every rod of this kind; the inventory and the fight refresh) and the
// shared rod rules of the fight (CONFIG.physics.fight rodHold, rodStroke, rodControl: live overrides, exported by
// DevTools). ↺ returns a value to the catalog item at first sight / the base config.
const FIGHT_RULES = Object.freeze([
  ["rodHold", "Утримання вудилищем (rodHold)"],
  ["rodStroke", "Ривок вудилищем (rodStroke)"],
  ["rodControl", "Керування вудилищем (rodControl)"],
]);
const ITEM_STATS_SKIPPED = new Set(["durability"]);

export class ActiveRodWindowContent {
  #config;
  #baseConfig;
  #items;
  #rows;
  #updateConfig;
  #startStats = new Map();

  // config: the live CONFIG; baseConfig: the base config without overrides; items: ITEM_DB;
  // schema: FightBalanceParameterSchema; updateConfig(path, value): DevTools.updateConfig.
  constructor({ config, baseConfig, items, schema, updateConfig }) {
    this.#config = config;
    this.#baseConfig = baseConfig;
    this.#items = items;
    this.#rows = new BalanceFormRows({ schema });
    this.#updateConfig = updateConfig;
  }

  build(liveData) {
    const rod = liveData?.eq?.rod ?? liveData?.equipment?.rod ?? null;
    const itemId = rod?.itemId ?? null;
    const item = itemId ? this.#items.rods?.[itemId] : null;
    const sections = [];
    if (item) {
      if (!this.#startStats.has(itemId)) this.#startStats.set(itemId, structuredClone(item.gameplayStats ?? {}));
      sections.push(this.#rows.section({ id: "rod.item", title: `Вудилище: ${item.name ?? itemId}`, value: item.gameplayStats,
        path: ["ITEM_DB", "rods", itemId, "gameplayStats"], base: this.#startStats.get(itemId),
        skip: (path) => ITEM_STATS_SKIPPED.has(path.at(-1)) }));
    }
    for (const [key, title] of FIGHT_RULES) {
      sections.push(this.#rows.section({ id: `rod.${key}`, title, value: this.#config.physics?.fight?.[key],
        path: ["CONFIG", "physics", "fight", key], base: this.#baseConfig?.physics?.fight?.[key] }));
    }
    const effective = rod?.effectiveStats ?? {};
    const visible = sections.filter((section) => section.rows.length > 0 || section.sections.length > 0);
    return {
      key: BalanceFormRows.shapeKey(`rod:${itemId ?? "none"}`, visible),
      readouts: [
        { label: "вудилище", value: item ? item.name ?? itemId : "не споряджене" },
        { label: "макс. навантаження зараз", value: this.#number(effective.maxLoadKg, " кг") },
        { label: "утримання натягу зараз", value: this.#number(effective.holdTensionRatio, "") },
      ],
      note: item ? "Зміни предмета діють на всі такі вудилища; правила бою — на будь-яке вудилище."
        : "Споряджіть вудилище, щоб крутити його параметри; правила бою діють і без нього.",
      actions: [],
      sections: visible,
    };
  }

  change(path, value) {
    this.#updateConfig(path, value);
  }

  action() {}

  #number(value, unit) {
    const number = Number(value);
    return Number.isFinite(number) ? `${Math.round(number * 100) / 100}${unit}` : "—";
  }
}
