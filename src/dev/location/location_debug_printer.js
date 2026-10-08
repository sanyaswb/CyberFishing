export class LocationDebugPrinter {
  #configSource;
  #logger;
  #provider;
  #viewportSource;

  constructor({
    provider,
    viewportSource,
    configSource,
    logger,
  } = {}) {
    this.#configSource = configSource;
    this.#logger = logger;
    this.#provider = provider;
    this.#viewportSource = viewportSource;
  }

  print() {
    const { locationId, map, baseRes, cellSize, designCellSize } =
      this.#provider.getActiveData();

    if (!map) {
      this.#logger.warn("[MAP] No active map config found.");
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
      this.#configSource().casting?.accuracyDistancePercent,
    );
    const handAccuracyPercent = this.#provider.normalizePercent(
      this.#configSource().casting?.handChumAccuracyDistancePercent ??
        this.#configSource().casting?.accuracyDistancePercent,
    );
    const accuracyMultiplier = this.#provider.normalizeMultiplier(
      this.#configSource().casting?.accuracyDistanceMultiplier,
    );
    const handAccuracyMultiplier = this.#provider.normalizeMultiplier(
      this.#configSource().casting?.handChumAccuracyDistanceMultiplier ??
        this.#configSource().casting?.accuracyDistanceMultiplier,
    );

    this.#logger.group(
      `%c[MAP] ${locationId} - ${map.name || "Unnamed location"}`,
      "color: #b066ff; font-size: 14px; font-weight: bold;",
    );

    this.#logger.table({
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

    this.#logger.log("%c[MAP] Perspective samples", "color: #00ccff;");
    this.#logger.table(
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

    this.#logger.groupEnd();
  }

  #printZoneTable(type, zones, cellSize, baseRes) {
    if (!zones.length) return;
    this.#logger.log(`%c[MAP] Zones: ${type}`, "color: #00ff80;");
    this.#logger.table(
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
