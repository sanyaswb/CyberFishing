class LocationDebugRenderFrameBuilder {
  #map;
  #projector;
  #config;
  #debugMapBuilder;
  #screen = new Vector2(0, 0);
  #debugCanvas = null;
  #lastDebugKey = "";

  constructor({ map, projector, config, debugMapBuilder }) {
    if (!debugMapBuilder || typeof debugMapBuilder.build !== "function") {
      throw new TypeError(
        "LocationDebugRenderFrameBuilder requires debugMapBuilder",
      );
    }
    this.#map = map;
    this.#projector = projector;
    this.#config = config;
    this.#debugMapBuilder = debugMapBuilder;
  }

  buildInto(target, debugEnabled) {
    const locations = this.#config.locations || {};
    if (!debugEnabled || !locations.debugVisuals) return;
    const debugCanvas = this.#getDebugCanvas(locations);
    if (debugCanvas) {
      const position = this.#projector.virtualToScreen(
        0,
        0,
        this.#screen,
      );
      const scale = this.#projector.getScale();
      target.debugImage.visible = true;
      target.debugImage.image = debugCanvas;
      target.debugImage.x = position.x;
      target.debugImage.y = position.y;
      target.debugImage.width = debugCanvas.width * scale;
      target.debugImage.height = debugCanvas.height * scale;
      target.debugImage.alpha = locations.debugOpacity || 0.7;
    }
    const cellSize = locations.cellSize;
    const scale = this.#projector.getScale();
    const zones = this.#map.getDynamicZones();
    for (let index = 0; index < zones.length; index += 1) {
      this.#buildZone(
        target.dynamicZones.acquire(),
        zones[index],
        cellSize,
        scale,
      );
    }
  }

  #getDebugCanvas(locations) {
    const key = [
      this.#map.getDebugRevision?.() || 0,
      locations.debugGrid,
      locations.debugDepthText,
      locations.debugZones,
      locations.enableCastable,
      locations.enableCollisions,
      locations.enableSnags,
      locations.enableDynamicZones,
      locations.cellSize,
    ].join("|");
    if (key !== this.#lastDebugKey || !this.#debugCanvas) {
      this.#lastDebugKey = key;
      this.#debugCanvas = this.#debugMapBuilder.build({
        map: this.#map,
        locationsConfig: locations,
      });
    }
    return this.#debugCanvas;
  }

  #buildZone(zone, source, cellSize, scale) {
    if (!zone.bounds) zone.bounds = [];
    zone.boundCount = 0;
    if (Array.isArray(source.bounds)) {
      for (let index = 0; index < source.bounds.length; index += 1) {
        this.#addBound(zone, source.bounds[index], scale);
      }
    } else if (source.bounds) {
      this.#addBound(zone, source.bounds, scale);
    }
    const position = this.#projector.virtualToScreen(
      source.x * cellSize,
      source.y * cellSize,
      this.#screen,
    );
    zone.hasBounds = zone.boundCount > 0;
    zone.x = position.x;
    zone.y = position.y;
    zone.width = source.w * cellSize * scale;
    zone.height = source.h * cellSize * scale;
  }

  #addBound(zone, bound, scale) {
    if (!Number.isFinite(Number(bound.x))) return;
    const position = this.#projector.virtualToScreen(
      bound.x,
      bound.y,
      this.#screen,
    );
    let record = zone.bounds[zone.boundCount];
    if (!record) {
      record = {};
      zone.bounds[zone.boundCount] = record;
    }
    record.x = position.x;
    record.y = position.y;
    record.width = bound.w * scale;
    record.height = bound.h * scale;
    zone.boundCount += 1;
  }
}
