export class GridCell {
  constructor(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.depth = 0;
    this.isWater = false; // <--- ДОДАНО: Прапорець для води
    this.isCastable = false;
    this.hasCollision = false;
    this.hasSnag = false;
  }
}

export class DynamicZone {
  #rng;

  constructor(config, rng = null) {
    this.#rng = rng || { next: () => Math.random() };
    this.id = config.id;
    this.type = config.type;
    this.multiplier = config.multiplier;
    this.x = config.x;
    this.y = config.y;
    this.w = config.w;
    this.h = config.h;
    this.moving = config.moving;
    this.bounds = config.bounds || null;

    this.currentSpeed =
      Math.hypot(config.speedX || 0, config.speedY || 0) || 1.5;
    this.speedX = config.speedX || this.currentSpeed;
    this.speedY = config.speedY || 0;
    this.dirTimer = 0;
  }

  #range(min, max) {
    return typeof this.#rng.range === "function"
      ? this.#rng.range(min, max)
      : min + this.#rng.next() * (max - min);
  }

  update(dt) {
    if (!this.moving) return;

    const timeScale = dt / 1000;

    this.dirTimer -= dt;
    if (this.dirTimer <= 0) {
      const randomAngle = this.#range(0, Math.PI * 2);
      this.speedX = Math.cos(randomAngle) * this.currentSpeed;
      this.speedY = Math.sin(randomAngle) * this.currentSpeed;

      this.dirTimer = this.#range(2000, 5000);
    }

    // Запобіжник: якщо зона вилетіла, повертаємо її в стартову точку
    if (isNaN(this.x) || isNaN(this.y)) {
      this.x = 10;
      this.y = 15;
    }

    // Логіка перевірки масиву зон
    const isInside = (px, py) => {
      if (!this.bounds) return true;
      const bArr = Array.isArray(this.bounds) ? this.bounds : [this.bounds];
      const cx = px + this.w / 2;
      const cy = py + this.h / 2;

      for (const b of bArr) {
        if (b.x !== undefined && !isNaN(b.x)) {
          if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) {
            return true;
          }
        }
      }
      return false;
    };

    let bounced = false;

    // Рух по X
    const nextX = this.x + this.speedX * timeScale;
    if (isInside(nextX, this.y)) {
      this.x = nextX;
    } else {
      this.speedX *= -1;
      bounced = true;
    }

    // Рух по Y
    const nextY = this.y + this.speedY * timeScale;
    if (isInside(this.x, nextY)) {
      this.y = nextY;
    } else {
      this.speedY *= -1;
      bounced = true;
    }

    if (bounced) {
      this.dirTimer = Math.max(this.dirTimer, 1000);
    }
  }
}

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
  #lastDebugGrid;
  #lastDebugDepthText;
  #lastDebugZones;
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
  #currentDate;

  // The wall clock (time of day without game time) is injected by composition.
  constructor(locationId, locationsConfig, rng = null, resources = null, currentDate = null) {
    if (!resources || typeof resources !== "object") {
      throw new TypeError("LocationMap requires ready location resources");
    }
    this.#locationsConfig = locationsConfig;
    this.#rng = rng || { next: () => Math.random() };
    this.#currentDate = currentDate;
    this.#config = JSON.parse(JSON.stringify(locationsConfig.map[locationId]));
    this.#id = locationId;
    this.#dynamicZones = [];
    this.#bgLoaded = false;

    const baseRes = locationsConfig.baseResolution;
    const actualCellSize = locationsConfig.cellSize;
    const designCellSize = locationsConfig.designCellSize || actualCellSize;

    this.#cols = Math.ceil(baseRes.width / actualCellSize);
    this.#rows = Math.ceil(baseRes.height / actualCellSize);

    const ratio = designCellSize / actualCellSize;
    if (ratio !== 1) {
      const scaleZone = (z) => {
        if (z.x !== undefined) z.x = Math.round(z.x * ratio);
        if (z.y !== undefined) z.y = Math.round(z.y * ratio);
        if (z.w !== undefined) z.w = Math.round(z.w * ratio);
        if (z.h !== undefined) z.h = Math.round(z.h * ratio);

        if (z.bounds) {
          const bArr = Array.isArray(z.bounds) ? z.bounds : [z.bounds];
          bArr.forEach((b) => {
            if (b.x !== undefined) b.x = Math.round(b.x * ratio);
            if (b.y !== undefined) b.y = Math.round(b.y * ratio);
            if (b.w !== undefined) b.w = Math.round(b.w * ratio);
            if (b.h !== undefined) b.h = Math.round(b.h * ratio);
          });
        }
      };

      if (this.#config.zones.castable)
        this.#config.zones.castable.forEach(scaleZone);
      if (this.#config.zones.collisions)
        this.#config.zones.collisions.forEach(scaleZone);
      if (this.#config.zones.snags) this.#config.zones.snags.forEach(scaleZone);
      if (this.#config.zones.dynamic)
        this.#config.zones.dynamic.forEach(scaleZone);
    }

    this.#buildGrid(actualCellSize);
    this.#applyLocationResources(resources, actualCellSize);

    if (
      this.#locationsConfig.enableDynamicZones !== false &&
      this.#config.zones.dynamic
    ) {
      for (const dzConfig of this.#config.zones.dynamic) {
        this.#dynamicZones.push(new DynamicZone(dzConfig, this.#rng));
      }
    }
  }

  refreshConfig(locationsConfig, resources = null) {
    if (!resources || typeof resources !== "object") {
      throw new TypeError("LocationMap refreshConfig requires ready location resources");
    }
    this.#locationsConfig = locationsConfig;
    this.#config = JSON.parse(JSON.stringify(locationsConfig.map[this.#id]));

    const actualCellSize = locationsConfig.cellSize;
    const designCellSize = locationsConfig.designCellSize || actualCellSize;
    const ratio = designCellSize / actualCellSize;

    if (ratio !== 1) {
      const scaleZone = (z) => {
        if (z.x !== undefined) z.x = Math.round(z.x * ratio);
        if (z.y !== undefined) z.y = Math.round(z.y * ratio);
        if (z.w !== undefined) z.w = Math.round(z.w * ratio);
        if (z.h !== undefined) z.h = Math.round(z.h * ratio);

        if (z.bounds) {
          const bArr = Array.isArray(z.bounds) ? z.bounds : [z.bounds];
          bArr.forEach((b) => {
            if (b.x !== undefined) b.x = Math.round(b.x * ratio);
            if (b.y !== undefined) b.y = Math.round(b.y * ratio);
            if (b.w !== undefined) b.w = Math.round(b.w * ratio);
            if (b.h !== undefined) b.h = Math.round(b.h * ratio);
          });
        }
      };
      if (this.#config.zones.castable)
        this.#config.zones.castable.forEach(scaleZone);
      if (this.#config.zones.collisions)
        this.#config.zones.collisions.forEach(scaleZone);
      if (this.#config.zones.snags) this.#config.zones.snags.forEach(scaleZone);
      if (this.#config.zones.dynamic)
        this.#config.zones.dynamic.forEach(scaleZone);
    }

    this.#dynamicZones = [];
    if (
      this.#locationsConfig.enableDynamicZones !== false &&
      this.#config.zones.dynamic
    ) {
      for (const dzConfig of this.#config.zones.dynamic) {
        this.#dynamicZones.push(new DynamicZone(dzConfig, this.#rng));
      }
    }

    const baseRes = locationsConfig.baseResolution;
    this.#cols = Math.ceil(baseRes.width / actualCellSize);
    this.#rows = Math.ceil(baseRes.height / actualCellSize);
    this.#buildGrid(actualCellSize);
    this.#applyLocationResources(resources, actualCellSize);
    this.recalculateZones(null, actualCellSize);
  }

  getCastableBoundsVirtual(cellSize) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    const castableZones = this.#config.zones.castable;
    if (!castableZones || castableZones.length === 0) return null;
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
      const startCol = z.adaptiveX ? 0 : z.x;
      const endCol = z.adaptiveX ? this.#cols : z.x + z.w;
      const startRow = z.y;
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

    let visibleStartCol = 0;
    let visibleEndCol = this.#cols;

    if (proj) {
      const vLeft = proj.screenToVirtual(0, 0).x;
      const vRight = proj.screenToVirtual(proj.getCanvasWidth(), 0).x;
      visibleStartCol = Math.max(0, Math.floor(vLeft / cellSize));
      visibleEndCol = Math.min(this.#cols, Math.ceil(vRight / cellSize));
    }

    const locCfg = this.#locationsConfig;

    if (locCfg.enableCastable !== false) {
      for (const z of this.#config.zones.castable) {
        let startX = z.adaptiveX ? visibleStartCol : z.x;
        let width = z.adaptiveX ? visibleEndCol - visibleStartCol : z.w;
        for (let i = startX; i < startX + width; i++) {
          for (let j = z.y; j < z.y + z.h; j++) {
            if (this.#isValid(i, j)) this.#grid[i][j].isCastable = true;
          }
        }
      }
    }

    if (locCfg.enableCollisions !== false) {
      for (const z of this.#config.zones.collisions) {
        for (let i = z.x; i < z.x + z.w; i++) {
          for (let j = z.y; j < z.y + z.h; j++) {
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
        for (let i = z.x; i < z.x + z.w; i++) {
          for (let j = z.y; j < z.y + z.h; j++) {
            if (this.#isValid(i, j)) this.#grid[i][j].hasSnag = true;
          }
        }
      }
    }

    const castableZone = this.#config.zones.castable?.[0];
    if (castableZone && castableZone.adaptiveX) {
      for (const dz of this.#dynamicZones) {
        if (dz.bounds && !Array.isArray(dz.bounds)) {
          dz.bounds.x = visibleStartCol;
          dz.bounds.w = visibleEndCol - visibleStartCol;
        }
      }
    }
  }

  #isValid(x, y) {
    return x >= 0 && x < this.#cols && y >= 0 && y < this.#rows;
  }

  update(dt, gameTimeHours = null) {
    const locCfg = this.#locationsConfig;
    if (
      !this.#debugStateInitialized ||
      this.#lastDebugGrid !== locCfg.debugGrid ||
      this.#lastDebugDepthText !== locCfg.debugDepthText ||
      this.#lastDebugZones !== locCfg.debugZones ||
      this.#lastEnableCastable !== locCfg.enableCastable ||
      this.#lastEnableCollisions !== locCfg.enableCollisions ||
      this.#lastEnableSnags !== locCfg.enableSnags ||
      this.#lastEnableDynamicZones !== locCfg.enableDynamicZones
    ) {
      this.#lastDebugGrid = locCfg.debugGrid;
      this.#lastDebugDepthText = locCfg.debugDepthText;
      this.#lastDebugZones = locCfg.debugZones;
      this.#lastEnableCastable = locCfg.enableCastable;
      this.#lastEnableCollisions = locCfg.enableCollisions;
      this.#lastEnableSnags = locCfg.enableSnags;
      this.#lastEnableDynamicZones = locCfg.enableDynamicZones;
      this.#debugStateInitialized = true;
      this.#revision += 1;
      this.recalculateZones(null, locCfg.cellSize);
    }

    if (this.#isDynamicBg) {
      let time = gameTimeHours;
      if (time === null) {
        const now = this.#currentDate();
        time = now.getHours() + now.getMinutes() / 60;
      }

      let evA = 0,
        niA = 0;

      if (time >= 9 && time < 17) {
        evA = 0;
        niA = 0;
      } else if (time >= 17 && time < 19) {
        evA = (time - 17) / 2;
        niA = 0;
      } else if (time >= 19 && time < 21) {
        evA = 1;
        niA = (time - 19) / 2;
      } else if (time >= 21 || time < 5) {
        evA = 1;
        niA = 1;
      } else if (time >= 5 && time < 7) {
        evA = 1;
        niA = 1 - (time - 5) / 2;
      } else if (time >= 7 && time < 9) {
        evA = 1 - (time - 7) / 2;
        niA = 0;
      }

      this.#bgOpacities.evening = evA;
      this.#bgOpacities.night = niA;
    }

    if (locCfg.enableDynamicZones !== false) {
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
