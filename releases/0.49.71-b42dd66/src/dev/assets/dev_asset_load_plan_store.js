import { AssetLoadPlan } from "../../engine/assets/asset_load_plan.js";

const STORAGE_KEY = "cyber-fishing:dev-asset-load-plan";

// DEV edits of the asset load plan (spec 157 D6, TK-177 item 8): an edited plan is validated against the registry and
// the game's sources, kept in local storage and used from the next start; export gives the module text to paste into
// src/game/config/raw/assets/asset_load_plan.js. An invalid or unreadable stored plan is ignored (the configured plan
// runs) and reported once.
export class DevAssetLoadPlanStore {
  #cache;
  #basePlan;
  #registry;
  #sources;
  #logger;

  // cache: LocalStorageCache; basePlan: ASSET_LOAD_PLAN; registry: AssetRegistry; sources: the plan's named sources.
  constructor({ cache, basePlan, registry, sources, logger }) {
    this.#cache = cache;
    this.#basePlan = basePlan;
    this.#registry = registry;
    this.#sources = sources;
    this.#logger = logger;
  }

  // The plan the next start uses: the stored edit when it is valid, else the configured plan.
  plan() {
    const stored = this.#cache.get(STORAGE_KEY);
    if (!stored) return this.#basePlan;
    const errors = this.validate(stored);
    if (errors.length === 0) return stored;
    this.#logger?.warn?.(`[DevTools] The stored asset load plan is invalid and is ignored:\n${errors.join("\n")}`);
    return this.#basePlan;
  }

  isEdited() {
    return Boolean(this.#cache.get(STORAGE_KEY));
  }

  validate(plan) {
    return AssetLoadPlan.validate({ plan, registry: this.#registry, sources: this.#sources });
  }

  // Saves a plan for the next start; returns its problems (nothing is saved when there are any).
  save(plan) {
    const errors = this.validate(plan);
    if (errors.length === 0) this.#cache.set(STORAGE_KEY, plan);
    return errors;
  }

  reset() {
    this.#cache.remove(STORAGE_KEY);
  }

  // The plan as the configuration module's text.
  exportText(plan = this.plan()) {
    return `export const ASSET_LOAD_PLAN = ${JSON.stringify(plan, null, 2)};\n`;
  }
}
