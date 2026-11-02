import { DevicePowerPolicy } from "../../domain/items/power/device_power_policy.js";
import { ItemPercentStatePolicy } from "../../domain/items/metrics/item_percent_state_policy.js";

// Spec 143: reads a battery's charge and writes the charge a device consumed into its chargeState. The only writer of
// battery charge; it never raises a percent. Runs inside the caller's inventory transaction.
export class ApplyBatteryDrainService {
  #repository;
  #hydrator;
  #chargeResolver;
  #statePolicy;
  #powerPolicy;

  constructor({
    repository,
    hydrator,
    chargeResolver,
    statePolicy = new ItemPercentStatePolicy({ stateName: "chargeState" }),
    powerPolicy = new DevicePowerPolicy(),
  } = {}) {
    if (!repository?.update || !repository?.get) throw new TypeError("ApplyBatteryDrainService requires repository");
    if (!hydrator?.hydrate) throw new TypeError("ApplyBatteryDrainService requires hydrator");
    if (!chargeResolver?.resolve) throw new TypeError("ApplyBatteryDrainService requires chargeResolver");
    this.#repository = repository;
    this.#hydrator = hydrator;
    this.#chargeResolver = chargeResolver;
    this.#statePolicy = statePolicy;
    this.#powerPolicy = powerPolicy;
  }

  // { percent, capacityUnits } of a battery, or null when the instance is not a battery.
  read(instanceId) {
    const raw = instanceId ? this.#repository.get(instanceId) : null;
    if (!raw) return null;
    const item = this.#hydrator.hydrate(raw, this.#repository);
    const charge = this.#chargeResolver.resolve(item);
    const capacityUnits = Number(item?.effectiveStats?.capacityUnits);
    if (!charge?.available || !(capacityUnits > 0)) return null;
    return Object.freeze({ percent: Number(charge.percent), capacityUnits });
  }

  drain(instanceId, units) {
    const reading = this.read(instanceId);
    if (!reading) return null;
    const percent = this.#powerPolicy.drain(reading.percent, reading.capacityUnits, units);
    const chargeState = this.#statePolicy.create(Math.min(reading.percent, percent), { omitDefault: true });
    this.#repository.update(instanceId, (source) => {
      const next = { ...source };
      if (chargeState) next.chargeState = chargeState;
      else delete next.chargeState;
      return next;
    });
    return Object.freeze({ percent: chargeState?.percent ?? 100, capacityUnits: reading.capacityUnits });
  }
}
