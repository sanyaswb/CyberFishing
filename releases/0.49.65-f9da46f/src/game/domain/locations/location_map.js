import { DynamicZone } from "./dynamic_zone.js";
import { GridCell } from "./grid_cell.js";
import { backgroundTimeBlend } from "../time/background_time_blend.js";
import { gridMaskContains } from "../../../engine/geometry/grid_mask.js";

export class LocationMap {
  #locationsConfig;
  #config;
  #id;
  #grid;
  #cols;
  #rows;
  #dynamicZones;
  #bgAssetIds = {};
  #bgOpacities = { evening: 0, night: 0 };
  #isDynamicBg = false;
  #bgLoaded = false;
  #debugStateInitialized = false;
  #lastEnableCastable;
  #lastEnableCollisions;
  #lastEnableSnags;
  #lastEnableDynamicZones;
  #lastProjector = null;
  #revision = 0;
  #castableBounds = { left: 0, right: 0, top: 0, bottom: 0 };
  #backgroundRenderData = {
    loaded: false,
    dynamic: false,
    assetIds: {},
    eveningOpacity: 0,
    nightOpacity: 0,
    width: 0,
    height: 0,
  };
  #rng;
  #cellSize;
  #maskedCategories = {};
  #visibleLeft = 0;
  #visibleRight = 0;

  constructor(locationId, locationsConfig, rng = null, resources = null, startRng = rng) {
    if (!resources || typeof resources !== "object") {
      throw new TypeError("LocationMap requires ready location resources");
    }
    this.#locationsConfig = locationsConfig;
    this.#rng = rng || { next: () => Math.random() };
    this.#config = JSON.parse(JSON.stringify(locationsConfig.map[locationId]));
    this.#id = locationId;
    this.#dynamicZones = [];
    this.#bgLoaded = false;

    const baseRes = locationsConfig.baseResolution;
    const actualCellSize = locationsConfig.cellSize;
    this.#cellSize = actualCellSize;
    const designCellSize = locationsConfig.designCellSize || actualCellSize;

    this.#cols = Math.ceil(baseRes.width / actualCellSize);
    this.#rows = Math.ceil(baseRes.height / actualCellSize);

    const ratio = designCellSize / actualCellSize;
    this.#scaleZones(ratio);

    this.#buildGrid(actualCellSize);
    this.#applyLocationResources(resources, actualCellSize);

    if (
      this.#locationsConfig.enableDynamicZones !== false &&
      this.#config.zones.dynamic
    ) {
      for (const dzConfig of this.#config.zones.dynamic) {
        const zone = new DynamicZone(dzConfig, this.#rng, ratio);
        zone.randomizeStart(startRng || this.#rng);
        this.#dynamicZones.push(zone);
      }
    }
  }

  refreshConfig(locationsConfig, resources = null) {
    if (!resources || typeof resources !== "object") {
      throw new TypeError("LocationMap refreshConfig requires ready location resources");
    }
    const previousCellSize = this.#cellSize;
    const previousMoving = previousCellSize !== locationsConfig.cellSize ? this.#dynamicZones : null;
    this.#locationsConfig = locationsConfig;
    this.#config = JSON.parse(JSON.stringify(locationsConfig.map[this.#id]));

    const actualCellSize = locationsConfig.cellSize;
    this.#cellSize = actualCellSize;
    const designCellSize = locationsConfig.designCellSize || actualCellSize;
    const ratio = designCellSize / actualCellSize;

    this.#scaleZones(ratio);

    this.#dynamicZones = [];
    if (
      this.#locationsConfig.enableDynamicZones !== false &&
      this.#config.zones.dynamic
    ) {
      for (const dzConfig of this.#config.zones.dynamic) {
        const zone = new DynamicZone(dzConfig, this.#rng, ratio);
        const previous = previousMoving?.find(entry => entry.id === zone.id);
        if (previous) {
          const scale = previousCellSize / actualCellSize;
          zone.x = previous.x * scale; zone.y = previous.y * scale;
          zone.speedX = previous.speedX * scale; zone.speedY = previous.speedY * scale;
          zone.currentSpeed = previous.currentSpeed * scale;
          zone.dirTimer = previous.dirTimer;
        }
        this.#dynamicZones.push(zone);
      }
    }

    const baseRes = locationsConfig.baseResolution;
    this.#cols = Math.ceil(baseRes.width / actualCellSize);
    this.#rows = Math.ceil(baseRes.height / actualCellSize);
    this.#buildGrid(actualCellSize);
    this.#applyLocationResources(resources, actualCellSize);
    this.recalculateZones(null, actualCellSize);
  }

  // Scales design-grid zone coordinates to the actual cell size (in place on the map's own config copy).
  #scaleZones(ratio) {
    for (const category of ["castable", "collisions", "snags"]) {
      this.#maskedCategories[category] = this.#config.zones[category]?.some(zone => zone.mask?.enabled) === true;
    }
    if (ratio !== 1) {
      const scaleZone = (z) => {
        if (z.x !== undefined) z.x *= ratio;
        if (z.y !== undefined) z.y *= ratio;
        if (z.w !== undefined) z.w *= ratio;
        if (z.h !== undefined) z.h *= ratio;

        if (z.bounds) {
          const bArr = Array.isArray(z.bounds) ? z.bounds : [z.bounds];
          bArr.forEach((b) => {
            if (b.x !== undefined) b.x *= ratio;
            if (b.y !== undefined) b.y *= ratio;
            if (b.w !== undefined) b.w *= ratio;
            if (b.h !== undefined) b.h *= ratio;
          });
        }
      };
      if (this.#config.zones.castable)
        this.#config.zones.castable.forEach(zone => scaleZone(zone));
      if (this.#config.zones.collisions)
        this.#config.zones.collisions.forEach(zone => scaleZone(zone));
      if (this.#config.zones.snags) this.#config.zones.snags.forEach(zone => scaleZone(zone));
      if (this.#config.zones.dynamic)
        this.#config.zones.dynamic.forEach(zone => scaleZone(zone));
    }
  }

  getCastableBoundsVirtual(cellSize) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const castableZones = this.#config.zones.castable;
    // Without castable zones (all deleted in the DEV zone editor, TK-051) the water spans the whole map; no cell is
    // castable, so every cast is refused, while the metric, the camera and the rod keep valid bounds.
    if (!castableZones || castableZones.length === 0) {
      this.#castableBounds.left = 0;
      this.#castableBounds.right = this.#cols * cellSize;
      this.#castableBounds.top = 0;
      this.#castableBounds.bottom = this.#rows * cellSize;
      return this.#castableBounds;
    }
    for (const z of castableZones) {
      minX = Math.min(minX, z.x * cellSize);
      minY = Math.min(minY, z.y * cellSize);
      maxX = Math.max(maxX, (z.x + z.w) * cellSize);
      maxY = Math.max(maxY, (z.y + z.h) * cellSize);
    }
    this.#castableBounds.left = minX;
    this.#castableBounds.right = maxX;
    this.#castableBounds.top = minY;
    this.#castableBounds.bottom = maxY;
    return this.#castableBounds;
  }

  getBackgroundRenderData() {
    const data = this.#backgroundRenderData;
    const baseResolution = this.#locationsConfig.baseResolution;
    data.loaded = this.#bgLoaded;
    data.dynamic = this.#isDynamicBg;
    data.assetIds = this.#bgAssetIds;
    data.eveningOpacity = this.#bgOpacities.evening;
    data.nightOpacity = this.#bgOpacities.night;
    data.width = baseResolution.width;
    data.height = baseResolution.height;
    return data;
  }

  #buildGrid(cellSize) {
    this.#grid = new Array(this.#cols);
    for (let i = 0; i < this.#cols; i++) {
      this.#grid[i] = new Array(this.#rows);
      for (let j = 0; j < this.#rows; j++) {
        const cell = new GridCell(i, j, cellSize);
        cell.depth = this.#config.depthBounds.min;
        this.#grid[i][j] = cell;
      }
    }
  }

  #processDepthMap(depthReader, cellSize) {
    if (!depthReader) return;
    const minD = this.#config.depthBounds.min;
    const maxD = this.#config.depthBounds.max;

    if (!this.#config.zones.castable) return;

    for (const z of this.#config.zones.castable) {
      const startCol = z.adaptiveX ? 0 : Math.floor(z.x);
      const endCol = z.adaptiveX ? this.#cols : z.x + z.w;
      const startRow = Math.floor(z.y);
      const endRow = z.y + z.h;

      for (let i = startCol; i < endCol; i++) {
        for (let j = startRow; j < endRow; j++) {
          if (!this.#isValid(i, j)) continue;

          const px = Math.floor(i * cellSize + cellSize / 2);
          const py = Math.floor(j * cellSize + cellSize / 2);

          this.#grid[i][j].depth = depthReader.getDepthAtPixel(
            px,
            py,
            minD,
            maxD,
          );
          this.#grid[i][j].isWater = true;
        }
      }
    }
  }

  recalculateZones(projector, cellSize) {
    if (projector) this.#lastProjector = projector;
    const proj = projector || this.#lastProjector;

    for (let i = 0; i < this.#cols; i++) {
      for (let j = 0; j < this.#rows; j++) {
        this.#grid[i][j].isCastable = false;
        this.#grid[i][j].hasCollision = false;
        this.#grid[i][j].hasSnag = false;
      }
    }

    let visibleLeft = 0;
    let visibleRight = this.#locationsConfig.baseResolution.width / cellSize;

    if (proj) {
      const vLeft = proj.screenToVirtual(0, 0).x;
      const vRight = proj.screenToVirtual(proj.getCanvasWidth(), 0).x;
      visibleLeft = Math.max(0, vLeft / cellSize);
      visibleRight = Math.min(visibleRight, vRight / cellSize);
    }

    const visibleStartCol = Math.floor(visibleLeft), visibleEndCol = Math.ceil(visibleRight);
    this.#visibleLeft = visibleLeft; this.#visibleRight = visibleRight;

    const locCfg = this.#locationsConfig;

    if (locCfg.enableCastable !== false) {
      for (const z of this.#config.zones.castable) {
        const startX = z.adaptiveX ? visibleStartCol : Math.floor(z.x);
        const endX = z.adaptiveX ? visibleEndCol : z.x + z.w;
        for (let i = startX; i < endX; i++) {
          for (let j = Math.floor(z.y); j < z.y + z.h; j++) {
            if (this.#isValid(i, j)) this.#grid[i][j].isCastable = true;
          }
        }
      }
    }

    if (locCfg.enableCollisions !== false) {
      for (const z of this.#config.zones.collisions) {
        for (let i = Math.floor(z.x); i < z.x + z.w; i++) {
          for (let j = Math.floor(z.y); j < z.y + z.h; j++) {
            if (this.#isValid(i, j)) {
              this.#grid[i][j].hasCollision = true;
              this.#grid[i][j].isCastable = false;
            }
          }
        }
      }
    }

    if (locCfg.enableSnags !== false) {
      for (const z of this.#config.zones.snags) {
        for (let i = Math.floor(z.x); i < z.x + z.w; i++) {
          for (let j = Math.floor(z.y); j < z.y + z.h; j++) {
            if (this.#isValid(i, j)) this.#grid[i][j].hasSnag = true;
          }
        }
      }
    }

    const castableZone = this.#config.zones.castable?.[0];
    if (castableZone && castableZone.adaptiveX) {
      for (const dz of this.#dynamicZones) {
        if (dz.bounds && !Array.isArray(dz.bounds)) {
          dz.bounds.x = visibleLeft;
          dz.bounds.w = visibleRight - visibleLeft;
        }
      }
    }
  }

  #isValid(x, y) {
    return x >= 0 && x < this.#cols && y >= 0 && y < this.#rows;
  }

  update(dt, gameTimeHours, pauseDynamicMotion = false) {
    const locCfg = this.#locationsConfig;
    if (
      !this.#debugStateInitialized ||
      this.#lastEnableCastable !== locCfg.enableCastable ||
      this.#lastEnableCollisions !== locCfg.enableCollisions ||
      this.#lastEnableSnags !== locCfg.enableSnags ||
      this.#lastEnableDynamicZones !== locCfg.enableDynamicZones
    ) {
      this.#lastEnableCastable = locCfg.enableCastable;
      this.#lastEnableCollisions = locCfg.enableCollisions;
      this.#lastEnableSnags = locCfg.enableSnags;
      this.#lastEnableDynamicZones = locCfg.enableDynamicZones;
      this.#debugStateInitialized = true;
      this.#revision += 1;
      this.recalculateZones(null, locCfg.cellSize);
    }

    // Backgrounds follow game time only (spec 081): GameWorld passes the environment's clock reading every frame.
    if (this.#isDynamicBg) backgroundTimeBlend(gameTimeHours, this.#bgOpacities);

    if (locCfg.enableDynamicZones !== false && !pauseDynamicMotion) {
      for (const dz of this.#dynamicZones) {
        dz.update(dt);
      }
    }
  }

  getGrid() {
    return this.#grid;
  }

  getCols() {
    return this.#cols;
  }

  getCellSize() {
    return this.#cellSize;
  }

  getRows() {
    return this.#rows;
  }

  getDynamicZones() {
    if (this.#locationsConfig.enableDynamicZones === false) return [];
    return this.#dynamicZones;
  }

  getCellAtVirtualPos(vX, vY, cellSize) {
    const c = Math.floor(vX / cellSize);
    const r = Math.floor(vY / cellSize);
    if (this.#isValid(c, r)) return this.#grid[c][r];
    return null;
  }

  // Fine coordinate constraints are separate from the depth/water raster. Unmasked categories retain legacy coverage.
  isCastableAt(vX, vY) {
    const cell = this.getCellAtVirtualPos(vX, vY, this.#cellSize);
    if (!cell) return false;
    if (!this.#maskedCategories.castable && !this.#maskedCategories.collisions) return cell.isCastable && !cell.hasCollision;
    // isCastable in the raster has already subtracted coarse obstacles; recover castable coverage independently.
    const castable = this.#locationsConfig.enableCastable !== false && this.#containsCategory("castable", vX, vY);
    return castable && !this.hasCollisionAt(vX, vY);
  }

  hasCollisionAt(vX, vY) {
    if (!this.#maskedCategories.collisions) return this.getCellAtVirtualPos(vX, vY, this.#cellSize)?.hasCollision === true;
    return this.#locationsConfig.enableCollisions !== false && this.#containsCategory("collisions", vX, vY);
  }

  hasSnagAt(vX, vY) {
    if (!this.#maskedCategories.snags) return this.getCellAtVirtualPos(vX, vY, this.#cellSize)?.hasSnag === true;
    return this.#locationsConfig.enableSnags !== false && this.#containsCategory("snags", vX, vY);
  }

  #containsCategory(category, vX, vY) {
    const x = vX / this.#cellSize, y = vY / this.#cellSize;
    for (const zone of this.#config.zones[category] || []) {
      const left = zone.adaptiveX ? this.#visibleLeft : zone.x;
      const width = zone.adaptiveX ? this.#visibleRight - left : zone.w;
      if (zone.mask?.enabled) {
        const maskLeft = zone.adaptiveX ? 0 : left;
        const maskWidth = zone.adaptiveX ? this.#locationsConfig.baseResolution.width / this.#cellSize : width;
        if (gridMaskContains(zone.mask, (x - maskLeft) / maskWidth, (y - zone.y) / zone.h)) return true;
      } else if (Math.floor(x) >= Math.floor(left) && Math.floor(x) < left + width &&
        Math.floor(y) >= Math.floor(zone.y) && Math.floor(y) < zone.y + zone.h) return true;
    }
    return false;
  }

  get currentLocationId() {
    return this.#id;
  }

  getLocationZones() {
    return this.#config.zones || {};
  }

  getRevision() {
    return this.#revision;
  }

  #applyLocationResources(resources, cellSize) {
    const background = resources.background || {};
    this.#isDynamicBg = !!background.dynamic;
    this.#bgAssetIds = background.assetIds || {};
    this.#bgLoaded = resources.loaded !== false;
    this.#processDepthMap(resources.depthReader || null, cellSize);
    this.#revision += 1;
  }
}
