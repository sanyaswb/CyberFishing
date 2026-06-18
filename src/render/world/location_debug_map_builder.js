class LocationDebugMapBuilder {
  #canvasFactory;
  #canvas = null;
  #surface = null;

  constructor({ canvasFactory }) {
    if (!canvasFactory || typeof canvasFactory.createSurface !== "function") {
      throw new TypeError("LocationDebugMapBuilder requires canvasFactory");
    }
    this.#canvasFactory = canvasFactory;
  }

  build({ map, locationsConfig }) {
    const width = locationsConfig.baseResolution.width;
    const height = locationsConfig.baseResolution.height;
    const cellSize = locationsConfig.cellSize;
    this.#ensureSurface(width, height);
    const surface = this.#surface;
    surface.clearRect(0, 0, width, height);
    this.#drawZones(surface, map.getLocationZones(), locationsConfig, cellSize, width);
    this.#drawGrid(surface, map, locationsConfig, cellSize);
    return this.#canvas;
  }

  #ensureSurface(width, height) {
    if (!this.#canvas || this.#canvas.width !== width || this.#canvas.height !== height) {
      this.#surface = this.#canvasFactory.createSurface(width, height, {
        alpha: true,
      });
      this.#canvas = this.#surface.canvas;
    }
  }

  #drawZones(surface, zones, locationsConfig, cellSize, width) {
    if (locationsConfig.debugZones === false) return;
    if (locationsConfig.enableCastable !== false) {
      this.#fillZones(surface, zones.castable, "rgba(0, 255, 0, 0.15)", cellSize, width);
    }
    if (locationsConfig.enableSnags !== false) {
      this.#fillZones(surface, zones.snags, "rgba(255, 255, 0, 0.3)", cellSize, width);
    }
    if (locationsConfig.enableCollisions !== false) {
      this.#fillZones(surface, zones.collisions, "rgba(255, 0, 0, 0.4)", cellSize, width);
    }
  }

  #fillZones(surface, zones, color, cellSize, width) {
    if (!zones) return;
    surface.fillStyle = color;
    for (let index = 0; index < zones.length; index += 1) {
      const zone = zones[index];
      const zoneWidth = zone.adaptiveX ? width : zone.w * cellSize;
      const startX = zone.adaptiveX ? 0 : zone.x * cellSize;
      surface.fillRect(startX, zone.y * cellSize, zoneWidth, zone.h * cellSize);
    }
  }

  #drawGrid(surface, map, locationsConfig, cellSize) {
    surface.font = "10px monospace";
    surface.textAlign = "center";
    surface.textBaseline = "middle";
    const grid = map.getGrid();
    for (let col = 0; col < map.getCols(); col += 1) {
      for (let row = 0; row < map.getRows(); row += 1) {
        const cell = grid[col][row];
        const x = cell.x * cellSize;
        const y = cell.y * cellSize;
        if (locationsConfig.debugGrid) {
          surface.strokeStyle = "rgba(255, 255, 255, 0.05)";
          surface.strokeRect(x, y, cellSize, cellSize);
        }
        if (locationsConfig.debugDepthText && cell.isWater) {
          surface.fillStyle = "rgba(255, 255, 255, 0.7)";
          surface.fillText(cell.depth.toFixed(1), x + cellSize / 2, y + cellSize / 2);
        }
      }
    }
  }
}
