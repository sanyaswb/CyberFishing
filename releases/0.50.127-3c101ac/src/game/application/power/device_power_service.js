import { DevicePowerPolicy } from "../../domain/items/power/device_power_policy.js";

// Spec 143: the one owner of battery consumption. Devices (the bait boat, later the radio) report how long they ran
// at which rate; the service accumulates the units per battery and writes them into the inventory every
// saveIntervalSeconds of consumption, when a battery runs out and on flush() (the page hides or closes), so a reload
// returns at most that interval. Time comes from the caller's monotonic step (the game loop's dt, never the wall
// clock) and one step is clamped to maxStepSeconds. Readings include the pending units, so a device stops as soon as
// its battery is empty. The ledger keeps what each device consumed this session for a future server check.
export class DevicePowerService {
  #batteries;
  #config;
  #policy;
  #pending = new Map();
  #stored = new Map();
  #readings = new Map();
  #ledger = new Map();

  // batteries: { attachedBattery(deviceInstanceId), readBattery(instanceId), drainBattery(instanceId, units) };
  // config: () => CONFIG.power.
  constructor({ batteries, config, policy = new DevicePowerPolicy() }) {
    for (const method of ["attachedBattery", "readBattery", "drainBattery"]) {
      if (typeof batteries?.[method] !== "function") {
        throw new TypeError(`DevicePowerService requires batteries.${method}`);
      }
    }
    if (typeof config !== "function") throw new TypeError("DevicePowerService requires config");
    this.#batteries = batteries;
    this.#config = config;
    this.#policy = policy;
  }

  // The battery in a device's battery slot, or null.
  batteryOf(deviceInstanceId) {
    return this.#batteries.attachedBattery(deviceInstanceId)?.instanceId || null;
  }

  // { hasBattery, percent, empty } for a battery, pending consumption included; one reused object per battery. Reads
  // the inventory again (a battery may have been inserted, removed or replaced).
  read(batteryInstanceId) {
    this.#stored.delete(batteryInstanceId || "");
    return this.#current(batteryInstanceId);
  }

  // The reading over the last stored charge: the per-frame path, no inventory read while the charge is known.
  #current(batteryInstanceId) {
    const reading = this.#reading(batteryInstanceId);
    const stored = this.#storedCharge(batteryInstanceId);
    if (!stored) {
      reading.hasBattery = false;
      reading.percent = 0;
      reading.empty = true;
      return reading;
    }
    const pendingUnits = this.#pending.get(batteryInstanceId)?.units || 0;
    reading.hasBattery = true;
    reading.percent = this.#policy.drain(stored.percent, stored.capacityUnits, pendingUnits);
    reading.empty = reading.percent <= 0;
    return reading;
  }

  // A device ran `seconds` at `unitsPerSecond` from a battery; returns the battery's reading. A device that runs in a
  // hidden page (the radio's background play, whose timers the browser throttles to about a minute) may ask for a
  // longer step, never beyond maxBackgroundStepSeconds.
  consume({ deviceId, batteryInstanceId, unitsPerSecond, seconds, background = false }) {
    const cfg = this.#config() || {};
    const limit = background ? Number(cfg.maxBackgroundStepSeconds) || 65 : Number(cfg.maxStepSeconds) || 1;
    const step = Math.max(0, Math.min(Number(seconds) || 0, limit));
    const rate = Math.max(0, Number(unitsPerSecond) || 0);
    if (!batteryInstanceId || step === 0 || rate === 0) return this.#current(batteryInstanceId);
    // An empty (or missing) battery gives nothing more.
    if (this.#current(batteryInstanceId).empty) return this.#current(batteryInstanceId);
    const pending = this.#pending.get(batteryInstanceId) || { units: 0, seconds: 0 };
    pending.units += rate * step;
    pending.seconds += step;
    this.#pending.set(batteryInstanceId, pending);
    let entry = this.#ledger.get(batteryInstanceId);
    if (!entry) {
      entry = { batteryInstanceId, deviceId: null, seconds: 0, units: 0 };
      this.#ledger.set(batteryInstanceId, entry);
    }
    entry.deviceId = deviceId || null;
    entry.seconds += step;
    entry.units += rate * step;
    const reading = this.#current(batteryInstanceId);
    if (reading.empty || pending.seconds >= (Number(cfg.saveIntervalSeconds) || 5)) this.#write(batteryInstanceId);
    return reading;
  }

  // Writes every pending consumption into the inventory.
  flush() {
    for (const batteryInstanceId of [...this.#pending.keys()]) this.#write(batteryInstanceId);
  }

  // What each battery gave this session, with the device that used it last.
  getLedger() {
    return [...this.#ledger.values()].map((entry) => Object.freeze({ ...entry }));
  }

  dispose() {
    this.flush();
  }

  #write(batteryInstanceId) {
    const pending = this.#pending.get(batteryInstanceId);
    this.#pending.delete(batteryInstanceId);
    if (pending && pending.units > 0) {
      const written = this.#batteries.drainBattery(batteryInstanceId, pending.units);
      if (written) this.#stored.set(batteryInstanceId, written);
      else this.#stored.delete(batteryInstanceId);
    }
  }

  #storedCharge(batteryInstanceId) {
    if (!batteryInstanceId) return null;
    if (this.#stored.has(batteryInstanceId)) return this.#stored.get(batteryInstanceId);
    const stored = this.#batteries.readBattery(batteryInstanceId);
    this.#stored.set(batteryInstanceId, stored || null);
    return stored || null;
  }

  #reading(batteryInstanceId) {
    const key = batteryInstanceId || "";
    let reading = this.#readings.get(key);
    if (!reading) {
      reading = { hasBattery: false, percent: 0, empty: true };
      this.#readings.set(key, reading);
    }
    return reading;
  }
}
