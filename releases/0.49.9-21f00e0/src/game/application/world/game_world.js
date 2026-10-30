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
  #waterMetricSource;
  #isZoneMotionPaused;
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
    waterMetricSource,
    isZoneMotionPaused = null,
  }) {
    this.#map = map;
    this.#env = env;
    this.#chum = chum;
    this.#projector = projector;
    this.#location = location;
    this.#canvasMetrics = canvasMetrics;
    this.#clock = clock;
    this.#locationConfig = locationConfig;
    this.#waterMetricSource = waterMetricSource;
    this.#isZoneMotionPaused = isZoneMotionPaused;
  }

  refreshLocationConfig(locationConfig, locationResources) {
    this.#locationConfig = locationConfig;
    this.#map.refreshConfig(locationConfig, locationResources);
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

  // Metres on the castable water of the current location (one metric for every gameplay distance).
  getWaterMetric() {
    return this.#waterMetricSource.current();
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
    const accepted = this.#map.isCastableAt ? this.#map.isCastableAt(vx, vy) : cell?.isCastable && !cell.hasCollision;
    return cell && accepted ? cell : null;
  }

  update(dt, timeScale) {
    const locations = this.#locationConfig;

    this.#env.update(dt, timeScale);
    const envSnapshot = this.#env.getSnapshot();
    this.#map.update(dt, envSnapshot.time, this.#isZoneMotionPaused?.() === true);
    this.#chum.update();

    // Spec 151: a boat moves on the whole map's water, not inside the visible screen (lockZoneXToScreen).
    const boatBounds = this.#map.getCastableBoundsVirtual(locations.cellSize);
    this.#chum.updateBoats(
      dt,
      (vx, vy) => {
        if (
          vx < boatBounds.left ||
          vx > boatBounds.right ||
          vy < boatBounds.top ||
          vy > boatBounds.bottom
        ) {
          return null;
        }
        return this.checkWater(vx, vy);
      },
      (vx, vy) => {
        if (this.#map.hasCollisionAt) return this.#map.hasCollisionAt(vx, vy);
        const cell = this.#map.getCellAtVirtualPos(vx, vy, locations.cellSize);
        return cell ? cell.hasCollision : false;
      },
      locations.cellSize,
      { current: this.#location.currentEnvironment?.current },
      this.getWaterMetric(),
    );

    return envSnapshot;
  }
}
