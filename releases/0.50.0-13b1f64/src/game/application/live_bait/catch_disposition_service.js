import { AquariumState } from "../../domain/live_bait/aquarium_state.js";
import { CaughtFishCollection } from "../../domain/live_bait/caught_fish_collection.js";
import { LiveBaitEligibilityPolicy } from "../../domain/live_bait/live_bait_eligibility_policy.js";
import { CaughtFishRarity } from "../../domain/live_bait/caught_fish_rarity.js";

export class CatchDispositionService {
  #config;
  #fishDb;
  #rng;
  #eligibility;

  constructor({ config, fishDb, rng }) {
    this.#config = config;
    this.#fishDb = new Map(fishDb.map((fish) => [fish.id, fish]));
    this.#rng = rng;
    this.#eligibility = new LiveBaitEligibilityPolicy(config);
  }

  canConvert(fish) { return this.#fishDb.has(fish?.speciesId ?? fish?.sourceSpeciesId ?? fish?.id) && !!this.#eligibility.resolve(fish); }

  resolve(state, catchId, fish, action) {
    if (!["claim", "release", "live_bait"].includes(action)) return "invalid_action";
    if (typeof catchId !== "string" || !catchId || Object.hasOwn(state.resolvedCatchIds, catchId)) return "already_resolved";
    const speciesId = fish?.speciesId ?? fish?.id;
    const weightKg = Number(fish?.weightKg ?? fish?.weight);
    if (!this.#fishDb.has(speciesId) || !Number.isFinite(weightKg) || weightKg <= 0) return "invalid_fish";
    const collection = new CaughtFishCollection(state.fish, state.resolvedCatchIds);
    if (action === "release") { collection.resolve(catchId, action); return null; }
    if (action === "live_bait" && !this.#eligibility.resolve(fish)) return "bait_ineligible";
    const aquarium = new AquariumState(state.aquarium, this.#config.capacities);
    const toAquarium = action === "live_bait" && aquarium.owned && collection.countAt("aquarium") < aquarium.capacity;
    const location = toAquarium ? "aquarium" : "keepnet";
    if (location === "keepnet" && collection.countAt("keepnet") + collection.countAt("hook") >= this.#config.keepnetCapacity) return "keepnet_full";
    const lifetime = action === "live_bait" ? this.#sampleLifetime() : null;
    collection.resolve(catchId, action, {
      id: catchId, speciesId, name: String(fish.name || this.#fishDb.get(speciesId).name), weightKg,
      level: Number.isFinite(fish.level) ? fish.level : 1,
      imagePath: typeof fish.imagePath === "string" ? fish.imagePath : "",
      rarity: CaughtFishRarity.capture(fish.rarity),
      anomaly: typeof fish.anomaly === "string" ? fish.anomaly : null,
      hasAnomaly: fish.hasAnomaly === true || (!!fish.anomaly && fish.anomaly !== "none"),
      isUnique: fish.isUnique === true || fish.hasAnomaly === true || (!!fish.anomaly && fish.anomaly !== "none"),
      purpose: action === "live_bait" ? "live_bait" : "catch", disposition: location,
      caughtAtMs: state.lastAppliedAtMs, sampledLifetimeMs: lifetime, remainingLifetimeMs: lifetime,
      starvationDeadlineMs: null,
    });
    return null;
  }

  convertStored(state, id) {
    const fish = state.fish.find((item) => item.id === id);
    if (!fish || fish.disposition !== "keepnet" || fish.purpose !== "catch") return "not_found";
    if (!this.#eligibility.resolve({ speciesId: fish.speciesId, weightKg: fish.weightKg })) return "bait_ineligible";
    fish.purpose = "live_bait";
    fish.sampledLifetimeMs = this.#sampleLifetime();
    fish.remainingLifetimeMs = fish.sampledLifetimeMs;
    const aquarium = new AquariumState(state.aquarium, this.#config.capacities);
    if (aquarium.owned && state.fish.filter((item) => item.disposition === "aquarium").length < aquarium.capacity) {
      fish.disposition = "aquarium";
    }
    return null;
  }

  #sampleLifetime() {
    return this.#config.lifetimeMinMs + Math.floor(this.#rng.next() *
      (this.#config.lifetimeMaxMs - this.#config.lifetimeMinMs + 1));
  }
}
