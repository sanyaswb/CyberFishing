class GridCell {
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

class DynamicZone {
  constructor(config) {
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

  update(dt) {
    if (!this.moving) return;

    const timeScale = dt / 1000;

    this.dirTimer -= dt;
    if (this.dirTimer <= 0) {
      const randomAngle = Math.random() * Math.PI * 2;
      this.speedX = Math.cos(randomAngle) * this.currentSpeed;
      this.speedY = Math.sin(randomAngle) * this.currentSpeed;

      this.dirTimer = 2000 + Math.random() * 3000;
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

class LocationMap {
  #locationsConfig;
  #config;
  #id;
  #grid;
  #cols;
  #rows;
  #dynamicZones;
  #bgImages = {};
  #bgOpacities = { evening: 0, night: 0 };
  #isDynamicBg = false;
  #depthImage;
  #debugCanvas;
  #bgLoaded = false;
  #lastDebugState = "";
  #lastProjector = null;

  constructor(locationId, locationsConfig) {
    this.#locationsConfig = locationsConfig;
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

    if (this.#config.bgUrls) {
      this.#isDynamicBg = true;
      let loadedCount = 0;
      ["day", "evening", "night"].forEach((key) => {
        this.#bgImages[key] = new Image();
        this.#bgImages[key].onload = () => {
          loadedCount++;
          if (loadedCount === 3) this.#bgLoaded = true;
        };
        this.#bgImages[key].src = this.#config.bgUrls[key];
      });
    } else if (this.#config.bgUrl) {
      this.#bgImages.default = new Image();
      this.#bgImages.default.onload = () => {
        this.#bgLoaded = true;
      };
      this.#bgImages.default.src = this.#config.bgUrl;
    }

    this.#buildGrid(actualCellSize);

    if (this.#config.depthUrl) {
      this.#depthImage = new Image();
      this.#depthImage.onload = () => {
        this.#processDepthMap(actualCellSize, baseRes.width, baseRes.height);
        this.#generateStaticDebugMap(
          actualCellSize,
          baseRes.width,
          baseRes.height,
        );
      };
      this.#depthImage.src = this.#config.depthUrl;
    } else {
      this.#generateStaticDebugMap(
        actualCellSize,
        baseRes.width,
        baseRes.height,
      );
    }

    if (this.#config.zones.dynamic) {
      for (const dzConfig of this.#config.zones.dynamic) {
        this.#dynamicZones.push(new DynamicZone(dzConfig));
      }
    }
  }

  #generateStaticDebugMap(cellSize, imgWidth, imgHeight) {
    if (!this.#debugCanvas) {
      this.#debugCanvas = document.createElement("canvas");
      this.#debugCanvas.width = imgWidth;
      this.#debugCanvas.height = imgHeight;
    }

    const ctx = this.#debugCanvas.getContext("2d", { alpha: true });
    ctx.clearRect(0, 0, imgWidth, imgHeight);

    const locCfg = this.#locationsConfig;

    const drawZones = (zones, color) => {
      if (!zones) return;
      ctx.fillStyle = color;
      for (const z of zones) {
        const w = z.adaptiveX ? imgWidth : z.w * cellSize;
        const startX = z.adaptiveX ? 0 : z.x * cellSize;
        ctx.fillRect(startX, z.y * cellSize, w, z.h * cellSize);
      }
    };

    if (locCfg.enableCastable !== false)
      drawZones(this.#config.zones.castable, "rgba(0, 255, 0, 0.15)");
    if (locCfg.enableSnags !== false)
      drawZones(this.#config.zones.snags, "rgba(255, 255, 0, 0.3)");
    if (locCfg.enableCollisions !== false)
      drawZones(this.#config.zones.collisions, "rgba(255, 0, 0, 0.4)");

    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (let i = 0; i < this.#cols; i++) {
      for (let j = 0; j < this.#rows; j++) {
        const cell = this.#grid[i][j];
        const x = cell.x * cellSize;
        const y = cell.y * cellSize;

        if (locCfg.debugGrid) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
          ctx.strokeRect(x, y, cellSize, cellSize);
        }

        if (locCfg.debugDepthText && cell.isWater) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
          ctx.fillText(
            cell.depth.toFixed(1),
            x + cellSize / 2,
            y + cellSize / 2,
          );
        }
      }
    }
  }

  refreshConfig(locationsConfig) {
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
    if (this.#config.zones.dynamic) {
      for (const dzConfig of this.#config.zones.dynamic) {
        this.#dynamicZones.push(new DynamicZone(dzConfig));
      }
    }

    const baseRes = locationsConfig.baseResolution;
    this.#generateStaticDebugMap(actualCellSize, baseRes.width, baseRes.height);
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
    return { left: minX, right: maxX, top: minY, bottom: maxY };
  }

  drawBackground(ctx, projector) {
    if (!this.#bgLoaded) return;

    const pos = projector.virtualToScreen(0, 0);
    const scale = projector.getScale();

    const baseRes = this.#locationsConfig.baseResolution;
    const w = baseRes.width * scale;
    const h = baseRes.height * scale;

    if (!this.#isDynamicBg) {
      if (this.#bgImages.default?.complete)
        ctx.drawImage(this.#bgImages.default, pos.x, pos.y, w, h);
      return;
    }

    const opE = this.#bgOpacities.evening;
    const opN = this.#bgOpacities.night;

    if (opN === 1) {
      if (this.#bgImages.night?.complete)
        ctx.drawImage(this.#bgImages.night, pos.x, pos.y, w, h);
    } else if (opN > 0) {
      if (this.#bgImages.evening?.complete)
        ctx.drawImage(this.#bgImages.evening, pos.x, pos.y, w, h);
      ctx.globalAlpha = opN;
      if (this.#bgImages.night?.complete)
        ctx.drawImage(this.#bgImages.night, pos.x, pos.y, w, h);
      ctx.globalAlpha = 1.0;
    } else if (opE === 1) {
      if (this.#bgImages.evening?.complete)
        ctx.drawImage(this.#bgImages.evening, pos.x, pos.y, w, h);
    } else if (opE > 0) {
      if (this.#bgImages.day?.complete)
        ctx.drawImage(this.#bgImages.day, pos.x, pos.y, w, h);
      ctx.globalAlpha = opE;
      if (this.#bgImages.evening?.complete)
        ctx.drawImage(this.#bgImages.evening, pos.x, pos.y, w, h);
      ctx.globalAlpha = 1.0;
    } else {
      if (this.#bgImages.day?.complete)
        ctx.drawImage(this.#bgImages.day, pos.x, pos.y, w, h);
    }
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

  #processDepthMap(cellSize, imgWidth, imgHeight) {
    const canvas = document.createElement("canvas");
    canvas.width = imgWidth;
    canvas.height = imgHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    ctx.drawImage(this.#depthImage, 0, 0, imgWidth, imgHeight);
    const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight).data;

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

          const index = (py * imgWidth + px) * 4;
          const r = imageData[index];

          const ratio = r / 255;
          this.#grid[i][j].depth = maxD - ratio * (maxD - minD);
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
    const currentDebugState = `${locCfg.debugGrid}_${locCfg.debugDepthText}_${locCfg.enableCastable}_${locCfg.enableCollisions}_${locCfg.enableSnags}`;

    if (this.#lastDebugState !== currentDebugState && this.#debugCanvas) {
      this.#lastDebugState = currentDebugState;
      const baseRes = locCfg.baseResolution;
      this.#generateStaticDebugMap(
        locCfg.cellSize,
        baseRes.width,
        baseRes.height,
      );
      this.recalculateZones(null, locCfg.cellSize);
    }

    if (this.#isDynamicBg) {
      let time = gameTimeHours;
      if (time === null) {
        const now = new Date();
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

    for (const dz of this.#dynamicZones) {
      dz.update(dt);
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
    return this.#dynamicZones;
  }
  getDebugCanvas() {
    return this.#debugCanvas;
  }
  getCellAtVirtualPos(vX, vY, cellSize) {
    const c = Math.floor(vX / cellSize);
    const r = Math.floor(vY / cellSize);
    if (this.#isValid(c, r)) return this.#grid[c][r];
    return null;
  }
}

class ViewportProjector {
  #locationsConfig;
  #locationId;
  #virtualWidth;
  #virtualHeight;
  #canvasWidth;
  #canvasHeight;
  #scale;
  #offsetX;
  #offsetY;
  #cameraX;
  #maxScrollX;
  #isFirstUpdate;

  constructor(locationsConfig, locationId) {
    this.#locationsConfig = locationsConfig;
    this.#locationId = locationId;
    this.#virtualWidth = locationsConfig.baseResolution.width;
    this.#virtualHeight = locationsConfig.baseResolution.height;

    this.#scale = 1;
    this.#offsetX = 0;
    this.#offsetY = 0;
    this.#cameraX = 0;
    this.#maxScrollX = 0;
    this.#canvasWidth = 0;
    this.#canvasHeight = 0;
    this.#isFirstUpdate = true;
  }

  update(canvasWidth, canvasHeight) {
    const mapConfig = this.#locationsConfig.map[this.#locationId];
    const safeZoneTop = mapConfig.safeZone.top;
    const safeZoneBottom = mapConfig.safeZone.bottom;
    const alignment = mapConfig.initialAlignment || {
      x: "center",
      y: "safeZone",
    };

    this.#canvasWidth = canvasWidth;
    this.#canvasHeight = canvasHeight;

    const safeZoneHeight = safeZoneBottom - safeZoneTop;
    const scaleForWidth = this.#canvasWidth / this.#virtualWidth;
    const scaleForSafeHeight = this.#canvasHeight / safeZoneHeight;

    this.#scale = Math.max(scaleForWidth, scaleForSafeHeight);

    const scaledHeight = this.#virtualHeight * this.#scale;

    if (alignment.y === "top") {
      this.#offsetY = 0;
    } else if (alignment.y === "bottom") {
      this.#offsetY = this.#canvasHeight - scaledHeight;
    } else if (alignment.y === "center") {
      this.#offsetY = (this.#canvasHeight - scaledHeight) / 2;
    } else {
      const scaledSafeZoneTop = safeZoneTop * this.#scale;
      const scaledSafeZoneHeight = safeZoneHeight * this.#scale;
      this.#offsetY =
        (this.#canvasHeight - scaledSafeZoneHeight) / 2 - scaledSafeZoneTop;
    }

    const scaledWidth = this.#virtualWidth * this.#scale;
    this.#maxScrollX = Math.max(0, scaledWidth - this.#canvasWidth);

    if (this.#maxScrollX > 0) {
      if (this.#isFirstUpdate) {
        if (alignment.x === "center") this.#cameraX = this.#maxScrollX / 2;
        else if (alignment.x === "right") this.#cameraX = this.#maxScrollX;
        else this.#cameraX = 0;

        this.#isFirstUpdate = false;
      } else {
        this.#cameraX = Math.max(0, Math.min(this.#cameraX, this.#maxScrollX));
      }
      this.#offsetX = -this.#cameraX;
    } else {
      this.#cameraX = 0;
      this.#offsetX = (this.#canvasWidth - scaledWidth) / 2;
    }

    return true;
  }

  pan(deltaX) {
    if (this.#maxScrollX <= 0) return;
    this.#cameraX = Math.max(
      0,
      Math.min(this.#cameraX + deltaX, this.#maxScrollX),
    );
    this.#offsetX = -this.#cameraX;
  }

  screenToVirtual(screenX, screenY) {
    return new Vector2(
      (screenX - this.#offsetX) / this.#scale,
      (screenY - this.#offsetY) / this.#scale,
    );
  }

  virtualToScreen(vX, vY) {
    return new Vector2(
      vX * this.#scale + this.#offsetX,
      vY * this.#scale + this.#offsetY,
    );
  }

  getScale() {
    return this.#scale;
  }
  getCanvasWidth() {
    return this.#canvasWidth;
  }
  getMaxScrollX() {
    return this.#maxScrollX;
  }
}
