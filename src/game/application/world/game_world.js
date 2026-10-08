import { Vector2 } from "../../../engine/math/vector2.js";

export class GameWorld {
  #map;
  #env;
  #chum;
  #projector;
  #location;
  #canvasMetrics;
  #clock;
  #locationConfig;
  #bounds = { left: 0, right: 0, top: 0, bottom: 0 };
  #virtualTopLeft = new Vector2(0, 0);
  #virtualBottomRight = new Vector2(0, 0);

  constructor({
    map,
    env,
    chum,
    projector,
    location,
    canvasMetrics,
    clock,
    locationConfig,
  }) {
    this.#map = map;
    this.#env = env;
    this.#chum = chum;
    this.#projector = projector;
    this.#location = location;
    this.#canvasMetrics = canvasMetrics;
    this.#clock = clock;
    this.#locationConfig = locationConfig;
  }

  refreshLocationConfig(locationConfig, locationResources) {
    this.#locationConfig = locationConfig;
    if (typeof this.#map.refreshConfig === "function") {
      this.#map.refreshConfig(locationConfig, locationResources);
    }
    this.refreshViewport(true);
  }

  refreshViewport(recalculateMap = true) {
    this.#projector.update(
      this.#canvasMetrics.width,
      this.#canvasMetrics.height,
    );
    if (recalculateMap) {
      this.#map.recalculateZones(
        this.#projector,
        this.#locationConfig.cellSize,
      );
    }
  }

  getDynamicBounds() {
    const locations = this.#locationConfig;
    const mapBounds = this.#map.getCastableBoundsVirtual(locations.cellSize);
    const vTL = this.#projector.screenToVirtual(0, 0, this.#virtualTopLeft);
    const vBR = this.#projector.screenToVirtual(
      this.#canvasMetrics.width,
      this.#canvasMetrics.height,
      this.#virtualBottomRight,
    );

    this.#bounds.left = locations.lockZoneXToScreen
      ? Math.max(vTL.x, mapBounds.left)
      : mapBounds.left;
    this.#bounds.right = locations.lockZoneXToScreen
      ? Math.min(vBR.x, mapBounds.right)
      : mapBounds.right;
    this.#bounds.top = mapBounds.top;
    this.#bounds.bottom = mapBounds.bottom;

    return this.#bounds;
  }

  pan(deltaX, deltaY = 0) {
    if (!deltaX && !deltaY) return;
    this.#projector.pan(deltaX, deltaY);
  }

  checkWater(vx, vy) {
    const cell = this.#map.getCellAtVirtualPos(
      vx,
      vy,
      this.#locationConfig.cellSize,
    );
    return cell && cell.isCastable && !cell.hasCollision ? cell : null;
  }

  update(dt, timeScale, bounds) {
    const locations = this.#locationConfig;

    this.#env.update(dt, timeScale);
    const envSnapshot = this.#env.getSnapshot();
    this.#map.update(dt, envSnapshot.time);
    this.#chum.update(this.#clock.realNow, timeScale);

    this.#chum.updateBoats(
      dt,
      (vx, vy) => {
        if (
          vx < bounds.left ||
          vx > bounds.right ||
          vy < bounds.top ||
          vy > bounds.bottom
        ) {
          return null;
        }
        return this.checkWater(vx, vy);
      },
      (vx, vy) => {
        const cell = this.#map.getCellAtVirtualPos(vx, vy, locations.cellSize);
        return cell ? cell.hasCollision : false;
      },
      locations.cellSize,
      { current: this.#location.currentEnvironment?.current },
    );

    return envSnapshot;
  }
}
