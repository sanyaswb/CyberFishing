class LocationDebugDataProvider {
  #configSource;

  constructor({ configSource = () => CONFIG } = {}) {
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

class LocationDebugPrinter {
  #provider;
  #viewportSource;

  constructor({
    provider = new LocationDebugDataProvider(),
    viewportSource = () => window,
  } = {}) {
    this.#provider = provider;
    this.#viewportSource = viewportSource;
  }

  print() {
    const { locationId, map, baseRes, cellSize, designCellSize } =
      this.#provider.getActiveData();

    if (!map) {
      console.warn("[MAP] No active map config found.");
      return;
    }

    const viewport = this.#viewportSource?.() || {};
    const gridW = baseRes.width / cellSize;
    const gridH = baseRes.height / cellSize;
    const safeTop = Number(map.safeZone?.top) || 0;
    const safeBottom = Number(map.safeZone?.bottom) || baseRes.height;
    const safeHeight = Math.max(0, safeBottom - safeTop);
    const safeCells = safeHeight / cellSize;
    const castableBounds = this.#provider.getZoneBounds(
      map.zones?.castable || [],
      cellSize,
      baseRes,
    );
    const accuracyPercent = this.#provider.normalizePercent(
      CONFIG.casting?.accuracyDistancePercent,
    );
    const handAccuracyPercent = this.#provider.normalizePercent(
      CONFIG.casting?.handChumAccuracyDistancePercent ??
        CONFIG.casting?.accuracyDistancePercent,
    );
    const accuracyMultiplier = this.#provider.normalizeMultiplier(
      CONFIG.casting?.accuracyDistanceMultiplier,
    );
    const handAccuracyMultiplier = this.#provider.normalizeMultiplier(
      CONFIG.casting?.handChumAccuracyDistanceMultiplier ??
        CONFIG.casting?.accuracyDistanceMultiplier,
    );

    console.group(
      `%c[MAP] ${locationId} - ${map.name || "Unnamed location"}`,
      "color: #b066ff; font-size: 14px; font-weight: bold;",
    );

    console.table({
      "Base resolution": `${baseRes.width} x ${baseRes.height} px`,
      "Browser viewport": `${viewport.innerWidth} x ${viewport.innerHeight} px`,
      "Cell size": `${cellSize} px`,
      "Design cell size": `${designCellSize} px`,
      "Cell multiplier": (cellSize / Math.max(1, designCellSize)).toFixed(3),
      "Grid size": `${gridW.toFixed(2)} x ${gridH.toFixed(2)} cells`,
      "Safe zone Y": `${safeTop} -> ${safeBottom}`,
      "Safe zone height": `${safeHeight}px / ${safeCells.toFixed(2)} cells`,
      "Castable bounds": castableBounds
        ? `${castableBounds.x}px, ${castableBounds.y}px, ${castableBounds.width}px x ${castableBounds.height}px`
        : "none",
      "Rod accuracy percent": `${(accuracyPercent * 100).toFixed(2)}%`,
      "Rod accuracy multiplier": accuracyMultiplier.toFixed(2),
      "Rod spread at castable max": castableBounds
        ? `${(castableBounds.height * accuracyPercent * accuracyMultiplier).toFixed(2)} px diameter`
        : "n/a",
      "Hand chum accuracy percent": `${(handAccuracyPercent * 100).toFixed(2)}%`,
      "Hand chum accuracy multiplier": handAccuracyMultiplier.toFixed(2),
      "Chum cast distance": `${map.chumCastDistance ?? "n/a"} px`,
      "Chum spread at max": Number.isFinite(Number(map.chumCastDistance))
        ? `${(Number(map.chumCastDistance) * handAccuracyPercent * handAccuracyMultiplier).toFixed(2)} px diameter`
        : "n/a",
    });

    console.log("%c[MAP] Perspective samples", "color: #00ccff;");
    console.table(
      this.#provider.buildPerspectiveRows(map, [
        { label: "safe top", y: safeTop },
        {
          label: "castable top",
          y: castableBounds ? castableBounds.y : safeTop,
        },
        {
          label: "castable middle",
          y: castableBounds
            ? castableBounds.y + castableBounds.height / 2
            : safeTop + safeHeight / 2,
        },
        {
          label: "castable bottom",
          y: castableBounds
            ? castableBounds.y + castableBounds.height
            : safeBottom,
        },
        { label: "safe bottom", y: safeBottom },
      ]),
    );

    this.#printZoneTable("castable", map.zones?.castable || [], cellSize, baseRes);
    this.#printZoneTable(
      "collisions",
      map.zones?.collisions || [],
      cellSize,
      baseRes,
    );
    this.#printZoneTable("snags", map.zones?.snags || [], cellSize, baseRes);
    this.#printZoneTable("dynamic", map.zones?.dynamic || [], cellSize, baseRes);

    console.groupEnd();
  }

  #printZoneTable(type, zones, cellSize, baseRes) {
    if (!zones.length) return;
    console.log(`%c[MAP] Zones: ${type}`, "color: #00ff80;");
    console.table(
      zones.map((zone, index) => {
        const adaptiveWidth = zone.adaptiveX
          ? baseRes.width
          : zone.w * cellSize;
        const xPx = zone.adaptiveX ? 0 : zone.x * cellSize;
        const yPx = zone.y * cellSize;
        const widthPx = adaptiveWidth;
        const heightPx = zone.h * cellSize;
        return {
          index,
          id: zone.id || "",
          type: zone.type || type,
          xCells: zone.x,
          yCells: zone.y,
          wCells: zone.w,
          hCells: zone.h,
          xPx,
          yPx,
          widthPx,
          heightPx,
          areaPx: widthPx * heightPx,
          rightPx: xPx + widthPx,
          bottomPx: yPx + heightPx,
          boundsCount: Array.isArray(zone.bounds) ? zone.bounds.length : 0,
          boundsPx: Array.isArray(zone.bounds)
            ? zone.bounds
                .map(
                  (b) =>
                    `${b.x * cellSize},${b.y * cellSize},${b.w * cellSize}x${b.h * cellSize}`,
                )
                .join(" | ")
            : "",
          moving: zone.moving === true,
          multiplier: zone.multiplier ?? zone.bonus ?? "",
        };
      }),
    );
  }
}

window.LocationDebugDataProvider = LocationDebugDataProvider;
window.LocationDebugPrinter = LocationDebugPrinter;
