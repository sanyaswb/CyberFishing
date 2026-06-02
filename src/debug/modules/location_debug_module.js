class LocationDebugModule extends ConsoleTableDebugModule {
  #provider;

  constructor({ provider = new LocationDebugDataProvider() } = {}) {
    super({ key: "location", title: "Location" });
    this.#provider = provider;
  }

  render(context) {
    const { locationId, map, baseRes, cellSize, designCellSize } =
      this.#provider.getActiveData();
    if (!map) {
      console.warn("[location] No active location.");
      return;
    }

    const castableBounds = this.#provider.getZoneBounds(
      map.zones?.castable || [],
      cellSize,
      baseRes,
    );
    const safeTop = Number(map.safeZone?.top) || 0;
    const safeBottom = Number(map.safeZone?.bottom) || baseRes.height;

    console.table({
      "Game state": context.live?.gameState || "n/a",
      "Location id": locationId,
      "Location name": map.name || "Unnamed location",
      "Base resolution": `${baseRes.width} x ${baseRes.height}`,
      "Cell size": `${cellSize}`,
      "Design cell size": `${designCellSize}`,
      "Safe zone": `${safeTop} -> ${safeBottom}`,
      "Castable height": castableBounds ? castableBounds.height : "none",
      "Current float": context.live
        ? `${context.live.floatX}, ${context.live.floatY}`
        : "no live payload yet",
      "Hook depth": context.live
        ? DebugFormatters.number(context.live.hookDepth, 2)
        : "n/a",
      "Bottom depth": context.live
        ? DebugFormatters.number(context.live.bottomDepth, 2)
        : "n/a",
    });
  }
}

window.LocationDebugModule = LocationDebugModule;
