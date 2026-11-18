// The location's depth numbers, one per water cell, on a data canvas of the map's base resolution (spec 129,
// Revision 2: zones, fills and cell lines are the zone editor's own geometry; this map keeps only the depths).
export class LocationDebugMapBuilder {
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
    this.#drawDepths(surface, map, cellSize);
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

  #drawDepths(surface, map, cellSize) {
    surface.font = "10px monospace";
    surface.textAlign = "center";
    surface.textBaseline = "middle";
    surface.fillStyle = "rgba(255, 255, 255, 1)";
    const grid = map.getGrid();
    for (let col = 0; col < map.getCols(); col += 1) {
      for (let row = 0; row < map.getRows(); row += 1) {
        const cell = grid[col][row];
        if (!cell.isWater) continue;
        surface.fillText(cell.depth.toFixed(1), cell.x * cellSize + cellSize / 2, cell.y * cellSize + cellSize / 2);
      }
    }
  }
}
