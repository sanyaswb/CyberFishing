export class LocationDebugDataProvider {
  #configSource;

  constructor({ configSource } = {}) {
    this.#configSource = configSource;
  }

  getActiveData() {
    const config = this.#configSource?.() || {};
    const locations = config.locations || {};
    const maps = locations.map || {};
    const locationId = locations.currentLocationId || Object.keys(maps)[0];
    const map = maps[locationId];
    const baseRes = locations.baseResolution || { width: 0, height: 0 };
    const cellSize = Number(locations.cellSize) || 1;
    const designCellSize = Number(locations.designCellSize) || cellSize;

    return {
      locations,
      maps,
      locationId,
      map,
      baseRes,
      cellSize,
      designCellSize,
    };
  }

  getZoneBounds(zones, cellSize, baseRes) {
    if (!zones.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const zone of zones) {
      const x = zone.adaptiveX ? 0 : zone.x * cellSize;
      const y = zone.y * cellSize;
      const w = zone.adaptiveX ? baseRes.width : zone.w * cellSize;
      const h = zone.h * cellSize;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    return {
      x: minX,
      y: minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
    };
  }

  buildPerspectiveRows(map, samples) {
    return samples.map((sample) => {
      const perspective = this.getPerspective(map, sample.y);
      return {
        label: sample.label,
        y: Number(sample.y).toFixed(2),
        scale: perspective.scale.toFixed(4),
        squashY: perspective.squashY.toFixed(4),
        angleDeg: perspective.angleDeg.toFixed(2),
      };
    });
  }

  getPerspective(map, virtualY) {
    const pConfig = map.perspective || { angleTop: 5, angleBottom: 60 };
    const topY = Number(map.safeZone?.top) || 0;
    const bottomY = Number(map.safeZone?.bottom) || 1;
    const distRatio = this.clamp01(
      (virtualY - topY) / Math.max(1, bottomY - topY),
    );
    const angleDeg =
      pConfig.angleTop + (pConfig.angleBottom - pConfig.angleTop) * distRatio;
    const angleRad = (angleDeg * Math.PI) / 180;
    const bottomAngleRad = ((pConfig.angleBottom || 1) * Math.PI) / 180;
    return {
      angleDeg,
      squashY: Math.sin(angleRad),
      scale: Math.tan(angleRad) / Math.max(0.0001, Math.tan(bottomAngleRad)),
    };
  }

  normalizePercent(value) {
    const raw = Number(value);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return raw > 1 ? raw / 100 : raw;
  }

  normalizeMultiplier(value) {
    const raw = Number(value);
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  }

  clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }
}
