import { BalanceFormRows } from "./balance_form_rows.js";

// What the overlay window «🐟 ACTIVE FISH» shows and edits (spec 168, owner answers Q1 (в), Q4 (б)):
// - in the fight: the hooked fish (HOOKED_FISH) — level and weight, force, stamina, movement, every behaviour state; a
//   change acts at once (DevTools.updateConfig → the fight), and «💾 Записати у вид» copies this fish's physics changes
//   into its species (FISH_DB), so every later fish of the kind has them;
// - outside the fight: the Fixed Catch species (FISH_DB) while Fixed Catch is on, edited directly.
// ↺ returns a value to the species' own (for the hooked fish) or to the value at start (for the species).
const PHYSICS_SECTIONS = Object.freeze([
  ["forceProfile", "Сила"],
  ["staminaProfile", "Витривалість"],
  ["movementProfile", "Рух"],
]);
const NOT_SAVED_TO_SPECIES = new Set(["forceProfile.levelBasePower"]);
// TK-254.1: every staminaProfile value the fight reads, shown with its effective value when the fish has none: the
// limits (FishEndurancePointsCalculator, FishStaminaPointsCalculator fall back to CONFIG.stamina.fish) and the activity
// and speed while tired (FishForceSystem, defaults 0.75 / 0.25).
const STAMINA_DEFAULTS = Object.freeze([
  ["baseStamina", (fish) => fish?.baseStamina ?? 500],
  ["staminaRatioFromEndurance", (fish) => fish?.staminaRatioFromEndurance ?? 0.1],
  ["staminaBossMultiplier", (fish) => fish?.staminaBossMultiplier ?? 1],
  ["minStaminaActivityMultiplier", () => 0.75],
  ["exhaustedSpeedRatio", () => 0.25],
]);

export class ActiveFishWindowContent {
  #config;
  #baseConfig;
  #fishes;
  #schema;
  #rows;
  #updateConfig;
  #startValues = new Map();
  #fishSerials = new WeakMap();
  #nextSerial = 1;
  #edited = new Map();
  #editedFish = null;
  #lastSaved = 0;
  #current = null;

  // config: the live CONFIG (Fixed Catch, stamina rules); baseConfig: the config without overrides (↺ of the rules);
  // fishes: FISH_DB; schema: FightBalanceParameterSchema; updateConfig(path, value): DevTools.updateConfig.
  constructor({ config, baseConfig, fishes, schema, updateConfig }) {
    this.#config = config;
    this.#baseConfig = baseConfig;
    this.#fishes = fishes;
    this.#schema = schema;
    this.#rows = new BalanceFormRows({ schema });
    this.#updateConfig = updateConfig;
  }

  build(liveData) {
    const hooked = liveData?.hookedFish ?? null;
    if (hooked) return this.#hookedForm(hooked, liveData);
    const fixed = this.#config.debug?.fixedCatch;
    const index = fixed?.enabled ? this.#fishes.findIndex((fish) => fish.id === fixed.fishId) : -1;
    if (index >= 0) return this.#speciesForm(index);
    this.#current = null;
    return { key: "none", readouts: [], actions: [], sections: [],
      note: "Риба не спіймана. Увімкніть Fixed Catch, щоб крутити вид до клювання." };
  }

  change(path, value) {
    this.#updateConfig(path, value);
    if (this.#current?.mode !== "hooked" || path[1] !== "physics") return;
    const physicsPath = path.slice(2).join(".");
    if (!NOT_SAVED_TO_SPECIES.has(physicsPath)) this.#edited.set(path.slice(1).join("\u0000"), { path: path.slice(1), value });
  }

  action(id) {
    if (id !== "save" || this.#current?.mode !== "hooked") return;
    const index = this.#current.index;
    if (index < 0) return;
    for (const { path, value } of this.#edited.values()) this.#updateConfig(["FISH_DB", index, ...path], value);
    this.#lastSaved = this.#edited.size;
    this.#edited.clear();
  }

  #hookedForm(fish, liveData) {
    if (this.#editedFish !== fish) {
      this.#editedFish = fish;
      this.#edited.clear();
      this.#lastSaved = 0;
    }
    const index = this.#fishes.findIndex((species) => species.id === fish.id);
    const species = index >= 0 ? this.#fishes[index] : null;
    this.#current = { mode: "hooked", index };
    const maxLevel = Number(fish.maxLevel) || Number(species?.weightConfig?.maxLevel) || 6;
    const level = {
      id: "fish.level", title: "Рівень і вага", sections: [],
      rows: [
        { path: ["HOOKED_FISH", "weight"], label: "weight (кг)", kind: "number", value: Number(fish.weight) || 0,
          limits: this.#schema.weightLimits(fish.weight) },
        { path: ["HOOKED_FISH", "level"], label: "level", kind: "number", value: Number(fish.level) || 1,
          limits: { min: 1, max: maxLevel, step: 1 } },
        { path: ["HOOKED_FISH", "hasAnomaly"], label: "hasAnomaly", kind: "boolean", value: fish.hasAnomaly === true },
      ],
    };
    const sections = [level, ...this.#physicsSections("fish", fish.physics, ["HOOKED_FISH", "physics"], species?.physics)];
    const serial = this.#serialOf(fish);
    const pending = this.#edited.size;
    return {
      key: BalanceFormRows.shapeKey(`hooked:${serial}`, sections),
      readouts: [
        { label: "риба", value: `${fish.name ?? fish.id} · рівень ${fish.level ?? "—"} · ${this.#kg(fish.weight)}` },
        { label: "стан", value: liveData.fishState ?? "—" },
        { label: "сила зараз", value: this.#kg(liveData.fishActiveKg) },
        { label: "протидія", value: this.#kg(liveData.fishOppositionKg) },
        { label: "фаза", value: liveData.fishConditionPhase ?? "—" },
        { label: "стаміна", value: this.#points(liveData.currentStamina, liveData.fishConditionMaxStamina) },
        { label: "витривалість", value: this.#points(liveData.currentExhaustion, liveData.fishConditionMaxEndurance) },
      ],
      note: pending > 0 ? `Змінено в цій рибі: ${pending}, ще не записано у вид.`
        : this.#lastSaved > 0 ? `Записано у вид: ${this.#lastSaved}.` : "Зміни діють на цю рибу одразу.",
      actions: index >= 0 ? [{ id: "save", label: "💾 Записати у вид" }] : [],
      sections,
    };
  }

  #speciesForm(index) {
    const species = this.#fishes[index];
    this.#current = { mode: "species", index };
    if (!this.#startValues.has(species.id)) this.#startValues.set(species.id, structuredClone(species.physics ?? {}));
    const sections = this.#physicsSections("species", species.physics, ["FISH_DB", index, "physics"],
      this.#startValues.get(species.id));
    return {
      key: BalanceFormRows.shapeKey(`species:${species.id}`, sections),
      readouts: [{ label: "вид (Fixed Catch)", value: species.name ?? species.id }],
      note: "Поза боєм: зміни йдуть у вид і діють на наступну рибу.",
      actions: [],
      sections,
    };
  }

  #physicsSections(prefix, physics, path, base) {
    const sections = PHYSICS_SECTIONS.map(([key, title]) => this.#rows.section({ id: `${prefix}.${key}`, title,
      value: key === "staminaProfile" ? this.#withStaminaDefaults(physics?.[key]) : physics?.[key], path: [...path, key],
      base: key === "staminaProfile" ? this.#withStaminaDefaults(base?.[key]) : base?.[key] }));
    const behaviors = physics?.behaviorProfile?.behaviors ?? {};
    const behaviorSections = Object.entries(behaviors).map(([state, behavior]) => this.#rows.section({
      id: `${prefix}.behavior.${state}`, title: state, value: behavior, path: [...path, "behaviorProfile", "behaviors", state],
      base: base?.behaviorProfile?.behaviors?.[state] }));
    sections.push({ id: `${prefix}.behavior`, title: "Поведінка", rows: [], sections: behaviorSections });
    // TK-254.1: the stamina rules of every fight (drain, regen, endurance, power loss, mastery, debuffs), read live.
    sections.push(this.#rows.section({ id: "stamina.rules", title: "Правила витривалості (усі риби, CONFIG.stamina)",
      value: this.#config.stamina, path: ["CONFIG", "stamina"], base: this.#baseConfig?.stamina }));
    return sections.filter((section) => section.rows.length > 0 || section.sections.length > 0);
  }

  // The fish's staminaProfile with every value the fight reads; a missing one shows its effective default.
  #withStaminaDefaults(profile) {
    const stamina = this.#config.stamina?.fish;
    const values = Object.fromEntries(STAMINA_DEFAULTS.map(([key, resolve]) => [key, resolve(stamina)]));
    return { ...values, ...(profile ?? {}) };
  }

  #points(current, max) {
    const now = Number(current);
    const limit = Number(max);
    if (!Number.isFinite(now) || !Number.isFinite(limit)) return "—";
    return `${Math.round(now)} / ${Math.round(limit)}${limit > 0 ? ` (${Math.round((now / limit) * 100)}%)` : ""}`;
  }

  #serialOf(fish) {
    if (!this.#fishSerials.has(fish)) this.#fishSerials.set(fish, this.#nextSerial++);
    return this.#fishSerials.get(fish);
  }

  #kg(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `${number.toFixed(2)} кг` : "—";
  }
}
