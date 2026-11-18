// The one source of the current location's water metric (spec 126 R3): gameplay, rendering and DEV receive this
// query, so every consumer sees the same metric instance for the same inputs. The map owns the current location
// and its castable bounds; the locations config is read live, so DEV edits apply at once.
export class LocationWaterMetricSource {
  #map;
  #getLocations;
  #resolver;

  constructor({ map, getLocations, resolver }) {
    if (!map || typeof map.getCastableBoundsVirtual !== "function") throw new TypeError("LocationWaterMetricSource requires map");
    if (typeof getLocations !== "function") throw new TypeError("LocationWaterMetricSource requires getLocations");
    if (!resolver || typeof resolver.resolve !== "function") throw new TypeError("LocationWaterMetricSource requires resolver");
    this.#map = map;
    this.#getLocations = getLocations;
    this.#resolver = resolver;
  }

  current() {
    const locations = this.#getLocations();
    return this.#resolver.resolve(this.#map.getCastableBoundsVirtual(locations.cellSize),
      locations.map[this.#map.currentLocationId]?.waterProjection);
  }
}
