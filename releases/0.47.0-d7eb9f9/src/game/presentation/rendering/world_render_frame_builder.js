import { Vector2 } from "../../../engine/math/vector2.js";
import { timeOfDayLayers } from "../time/time_of_day_layers.js";
import { compileGridMask } from "../../../engine/geometry/grid_mask.js";

export class WorldRenderFrameBuilder {
  #map;
  #projector;
  #config;
  #canvasMetrics;
  #boatChumBuilder;
  #debugBuilder;
  #locationId;
  #getWaterMetric;
  #screenA = new Vector2(0, 0);
  #screenB = new Vector2(0, 0);
  #timeLayers = { base: "day", overlay: null, overlayOpacity: 0 };

  constructor({
    map,
    projector,
    config,
    canvasMetrics,
    boatChumBuilder,
    debugBuilder,
    locationId,
    getWaterMetric,
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
    if (debugBuilder != null && typeof debugBuilder.buildInto !== "function") {
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
    this.#getWaterMetric = getWaterMetric;
  }

  buildInto({ target, invalidCastMarker, debugEnabled }) {
    target.visible = true;
    target.backgroundColor =
      this.#config.canvas?.backgroundColor || "#0f171e";
    this.#buildBackground(target);
    this.#buildCurrent(target.current);
    this.#buildClipRegions(target.clipRegions, target.waterPlane);
    if (this.#getWaterMetric) target.waterPlane.metric = this.#getWaterMetric();
    this.#debugBuilder?.buildInto(target, debugEnabled);
    if (target.backgroundHidden) {
      target.backgroundLayers.reset();
      target.backgroundColor = "#000000";
    }
    this.#boatChumBuilder.buildInto(target);
    this.#buildInvalidMarker(target.invalidCastMarker, invalidCastMarker);
  }

  #buildBackground(target) {
    const data = this.#map.getBackgroundRenderData();
    if (!data.loaded) return;
    for (const phase in data.assetIds) {
      if (data.assetIds[phase]) target.backgroundAssetIds.push(data.assetIds[phase]);
    }
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

    const layers = timeOfDayLayers(data.eveningOpacity, data.nightOpacity, this.#timeLayers);
    this.#addBackgroundLayer(target, data.assetIds[layers.base], 1, position, width, height);
    if (layers.overlay) {
      this.#addBackgroundLayer(target, data.assetIds[layers.overlay], layers.overlayOpacity, position, width, height);
    }
  }

  #addBackgroundLayer(target, assetId, alpha, position, width, height) {
    if (!assetId) return;
    const record = target.backgroundLayers.acquire();
    record.assetId = assetId;
    record.alpha = alpha;
    record.x = position.x;
    record.y = position.y;
    record.width = width;
    record.height = height;
  }

  // The location's current, the one physics applies to the tackle and the boat (virtual pixels are art pixels).
  #buildCurrent(target) {
    const locations = this.#config.locations || {};
    const current = locations.map?.[locations.currentLocationId || this.#locationId]?.environment?.current;
    const speed = Number(current?.speedPxPerSec) || 0;
    target.x = speed * (Number(current?.direction?.x) || 0);
    target.y = speed * (Number(current?.direction?.y) || 0);
  }

  // Also writes the virtual bounds the regions cover into `plane`, so the wave field maps over the water it fills.
  #buildClipRegions(target, plane) {
    const locations = this.#config.locations || {};
    const maps = locations.map || {};
    const locationId = locations.currentLocationId || this.#locationId;
    const zones = maps[locationId]?.zones?.castable || [];
    // Authored rectangles use design cells; changing raster density must not resize the water mask.
    const cellSize = Math.max(1, Number(locations.designCellSize || locations.cellSize) || 40);
    plane.left = Infinity; plane.right = -Infinity; plane.top = Infinity; plane.bottom = -Infinity;
    plane.masked = false;
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
      if (zone.mask?.enabled) {
        plane.masked = true;
        const hostLeft = zone.adaptiveX ? 0 : Number(zone.x) * cellSize;
        const hostWidth = zone.adaptiveX ? locations.baseResolution.width : Number(zone.w) * cellSize;
        const hostHeight = bottom - top;
        for (const rect of compileGridMask(zone.mask).rects) {
          const maskLeft = Math.max(left, hostLeft + rect[0] * hostWidth);
          const maskRight = Math.min(right, hostLeft + (rect[0] + rect[2]) * hostWidth);
          if (maskRight > maskLeft) this.#clipRect(target, plane, maskLeft, top + rect[1] * hostHeight, maskRight, top + (rect[1] + rect[3]) * hostHeight);
        }
        continue;
      }
      this.#clipRect(target, plane, left, top, right, bottom);
    }
  }

  #clipRect(target, plane, left, top, right, bottom) {
      plane.left = Math.min(plane.left, left); plane.right = Math.max(plane.right, right);
      plane.top = Math.min(plane.top, top); plane.bottom = Math.max(plane.bottom, bottom);
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
      const record = target.acquire();
      record.x = Math.min(x1, second.x);
      record.y = Math.min(y1, second.y);
      record.width = Math.abs(second.x - x1);
      record.height = Math.abs(second.y - y1);
  }

  #buildInvalidMarker(target, marker) {
    if (!marker) return;
    target.visible = true;
    target.x = marker.x;
    target.y = marker.y;
  }
}
