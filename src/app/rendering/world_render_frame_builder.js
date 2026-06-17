class WorldRenderFrameBuilder {
  #map;
  #projector;
  #config;
  #canvasMetrics;
  #boatChumBuilder;
  #debugBuilder;
  #locationId;
  #screenA = new Vector2(0, 0);
  #screenB = new Vector2(0, 0);

  constructor({
    map,
    projector,
    config,
    canvasMetrics,
    boatChumBuilder,
    debugBuilder,
    locationId,
  }) {
    if (!map || typeof map.getBackgroundRenderData !== "function") {
      throw new TypeError("WorldRenderFrameBuilder requires map");
    }
    if (!projector || typeof projector.virtualToScreen !== "function") {
      throw new TypeError("WorldRenderFrameBuilder requires projector");
    }
    if (!boatChumBuilder || typeof boatChumBuilder.buildInto !== "function") {
      throw new TypeError(
        "WorldRenderFrameBuilder requires boatChumBuilder",
      );
    }
    if (!debugBuilder || typeof debugBuilder.buildInto !== "function") {
      throw new TypeError(
        "WorldRenderFrameBuilder requires debugBuilder",
      );
    }
    this.#map = map;
    this.#projector = projector;
    this.#config = config;
    this.#canvasMetrics = canvasMetrics;
    this.#boatChumBuilder = boatChumBuilder;
    this.#debugBuilder = debugBuilder;
    this.#locationId = locationId;
  }

  buildInto({ target, invalidCastMarker, debugEnabled }) {
    target.visible = true;
    target.backgroundColor =
      this.#config.canvas?.backgroundColor || "#0f171e";
    this.#buildBackground(target);
    this.#buildClipRegions(target.clipRegions);
    this.#debugBuilder.buildInto(target, debugEnabled);
    this.#boatChumBuilder.buildInto(target);
    this.#buildInvalidMarker(target.invalidCastMarker, invalidCastMarker);
  }

  #buildBackground(target) {
    const data = this.#map.getBackgroundRenderData();
    if (!data.loaded) return;
    const position = this.#projector.virtualToScreen(0, 0, this.#screenA);
    const scale = this.#projector.getScale();
    const width = data.width * scale;
    const height = data.height * scale;
    if (!data.dynamic) {
      this.#addBackgroundLayer(
        target,
        data.assetIds.default,
        1,
        position,
        width,
        height,
      );
      return;
    }

    if (data.nightOpacity === 1) {
      this.#addBackgroundLayer(
        target,
        data.assetIds.night,
        1,
        position,
        width,
        height,
      );
    } else if (data.nightOpacity > 0) {
      this.#addBackgroundLayer(
        target,
        data.assetIds.evening,
        1,
        position,
        width,
        height,
      );
      this.#addBackgroundLayer(
        target,
        data.assetIds.night,
        data.nightOpacity,
        position,
        width,
        height,
      );
    } else if (data.eveningOpacity === 1) {
      this.#addBackgroundLayer(
        target,
        data.assetIds.evening,
        1,
        position,
        width,
        height,
      );
    } else if (data.eveningOpacity > 0) {
      this.#addBackgroundLayer(
        target,
        data.assetIds.day,
        1,
        position,
        width,
        height,
      );
      this.#addBackgroundLayer(
        target,
        data.assetIds.evening,
        data.eveningOpacity,
        position,
        width,
        height,
      );
    } else {
      this.#addBackgroundLayer(
        target,
        data.assetIds.day,
        1,
        position,
        width,
        height,
      );
    }
  }

  #addBackgroundLayer(target, assetId, alpha, position, width, height) {
    if (!assetId) return;
    Object.assign(target.backgroundLayers.acquire(), {
      assetId,
      alpha,
      x: position.x,
      y: position.y,
      width,
      height,
    });
  }

  #buildClipRegions(target) {
    const locations = this.#config.locations || {};
    const maps = locations.map || {};
    const locationId = locations.currentLocationId || this.#locationId;
    const zones = maps[locationId]?.zones?.castable || [];
    const cellSize = Math.max(1, Number(locations.cellSize) || 40);
    for (let index = 0; index < zones.length; index += 1) {
      const zone = zones[index];
      let left = Number(zone.x) * cellSize;
      let right = (Number(zone.x) + Number(zone.w)) * cellSize;
      if (zone.adaptiveX) {
        left = this.#projector.screenToVirtual(
          0,
          0,
          this.#screenA,
        ).x;
        right = this.#projector.screenToVirtual(
          this.#canvasMetrics.width,
          0,
          this.#screenB,
        ).x;
      }
      const top = Number(zone.y) * cellSize;
      const bottom = (Number(zone.y) + Number(zone.h)) * cellSize;
      const first = this.#projector.virtualToScreen(
        left,
        top,
        this.#screenA,
      );
      const x1 = first.x;
      const y1 = first.y;
      const second = this.#projector.virtualToScreen(
        right,
        bottom,
        this.#screenB,
      );
      Object.assign(target.acquire(), {
        x: Math.min(x1, second.x),
        y: Math.min(y1, second.y),
        width: Math.abs(second.x - x1),
        height: Math.abs(second.y - y1),
      });
    }
  }

  #buildInvalidMarker(target, marker) {
    if (!marker) return;
    Object.assign(target, {
      visible: true,
      x: marker.x,
      y: marker.y,
    });
  }
}
