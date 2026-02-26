class GridCell {
    constructor(x, y, size) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.depth = 0;
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

        this.currentSpeed = Math.hypot(config.speedX || 0, config.speedY || 0) || 1.5; 
        this.speedX = config.speedX || this.currentSpeed;
        this.speedY = config.speedY || 0;
        this.dirTimer = 0; 
    }

    update(dt, boundsCols, boundsRows) {
        if (!this.moving) return;

        const timeScale = dt / 1000;

        this.dirTimer -= dt;
        if (this.dirTimer <= 0) {
            const randomAngle = Math.random() * Math.PI * 2; 
            this.speedX = Math.cos(randomAngle) * this.currentSpeed;
            this.speedY = Math.sin(randomAngle) * this.currentSpeed;
            
            this.dirTimer = 2000 + Math.random() * 3000; 
        }

        this.x += this.speedX * timeScale;
        this.y += this.speedY * timeScale;

        const minX = this.bounds ? this.bounds.x : 0;
        const maxX = this.bounds ? this.bounds.x + this.bounds.w : boundsCols;
        const minY = this.bounds ? this.bounds.y : 0;
        const maxY = this.bounds ? this.bounds.y + this.bounds.h : boundsRows;

        let bounced = false;

        if (this.x <= minX) {
            this.x = minX;
            this.speedX = Math.abs(this.speedX); 
            bounced = true;
        } else if (this.x + this.w >= maxX) {
            this.x = maxX - this.w;
            this.speedX = -Math.abs(this.speedX); 
            bounced = true;
        }

        if (this.y <= minY) {
            this.y = minY;
            this.speedY = Math.abs(this.speedY); 
            bounced = true;
        } else if (this.y + this.h >= maxY) {
            this.y = maxY - this.h;
            this.speedY = -Math.abs(this.speedY); 
            bounced = true;
        }

        if (bounced) {
            this.dirTimer = Math.max(this.dirTimer, 1000); 
        }
    }
}

class LocationMap {
    #globalConfig;
    #config;
    #id;
    #grid;
    #cols;
    #rows;
    #dynamicZones;
    #bgImage;
    #bgLoaded;
    #depthImage; 
    #debugCanvas; // Прихований шар для оптимізації дебагу

    constructor(locationId, config) {
        this.#globalConfig = config;
        this.#config = JSON.parse(JSON.stringify(config.locations.map[locationId]));
        this.#id = locationId;
        this.#dynamicZones = [];
        this.#bgLoaded = false;
        
        const baseRes = config.locations.baseResolution;
        const actualCellSize = config.locations.cellSize;
        const designCellSize = config.locations.designCellSize || actualCellSize;
        
        this.#cols = Math.ceil(baseRes.width / actualCellSize);
        this.#rows = Math.ceil(baseRes.height / actualCellSize);

        const ratio = designCellSize / actualCellSize;
        if (ratio !== 1) {
            const scaleZone = (z) => {
                z.x = Math.round(z.x * ratio);
                z.y = Math.round(z.y * ratio);
                z.w = Math.round(z.w * ratio);
                z.h = Math.round(z.h * ratio);
            };
            if (this.#config.zones.castable) this.#config.zones.castable.forEach(scaleZone);
            if (this.#config.zones.collisions) this.#config.zones.collisions.forEach(scaleZone);
            if (this.#config.zones.snags) this.#config.zones.snags.forEach(scaleZone);
            if (this.#config.zones.dynamic) this.#config.zones.dynamic.forEach(scaleZone);
        }
        
        this.#bgImage = new Image();
        this.#bgImage.onload = () => { this.#bgLoaded = true; };
        this.#bgImage.src = this.#config.bgUrl;

        this.#buildGrid(actualCellSize);
        
        // Завантажуємо глибину, а потім БЕЙКАЄМО (Pre-render) дебаг-карту
        if (this.#config.depthUrl) {
            this.#depthImage = new Image();
            this.#depthImage.onload = () => {
                this.#processDepthMap(actualCellSize, baseRes.width, baseRes.height);
                this.#generateStaticDebugMap(actualCellSize, baseRes.width, baseRes.height);
            };
            this.#depthImage.src = this.#config.depthUrl;
        } else {
            this.#generateStaticDebugMap(actualCellSize, baseRes.width, baseRes.height);
        }
        
        if (this.#config.zones.dynamic) {
            for (const dzConfig of this.#config.zones.dynamic) {
                this.#dynamicZones.push(new DynamicZone(dzConfig));
            }
        }
    }

    // НОВИЙ МЕТОД: Створює єдину статичну картинку сітки та глибин
    #generateStaticDebugMap(cellSize, imgWidth, imgHeight) {
        this.#debugCanvas = document.createElement('canvas');
        this.#debugCanvas.width = imgWidth;
        this.#debugCanvas.height = imgHeight;
        const ctx = this.#debugCanvas.getContext('2d', { alpha: true });

        const locCfg = this.#globalConfig.locations;

        // 1. Малюємо кольорові зони (якщо увімкнено)
        if (locCfg.debugZones) {
            const drawZones = (zones, color) => {
                if (!zones) return;
                ctx.fillStyle = color;
                for (const z of zones) {
                    const w = z.adaptiveX ? imgWidth : (z.w * cellSize);
                    const startX = z.adaptiveX ? 0 : (z.x * cellSize);
                    ctx.fillRect(startX, z.y * cellSize, w, z.h * cellSize);
                }
            };

            drawZones(this.#config.zones.castable, 'rgba(0, 255, 0, 0.15)');
            drawZones(this.#config.zones.snags, 'rgba(255, 255, 0, 0.3)');
            drawZones(this.#config.zones.collisions, 'rgba(255, 0, 0, 0.4)');
        }

        // 2. Малюємо сітку та цифри
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < this.#cols; i++) {
            for (let j = 0; j < this.#rows; j++) {
                const cell = this.#grid[i][j];
                const x = cell.x * cellSize;
                const y = cell.y * cellSize;

                // Малюємо рамку (якщо увімкнено)
                if (locCfg.debugGrid) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                    ctx.strokeRect(x, y, cellSize, cellSize);
                }

                // Малюємо цифри глибини (якщо увімкнено)
                if (locCfg.debugDepthText && cell.depth > 0) {
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                    ctx.fillText(cell.depth.toFixed(1), x + cellSize / 2, y + cellSize / 2);
                }
            }
        }
        console.log(`%c[Оптимізація] Статична дебаг-карта успішно згенерована!`, 'color: #00ccff; font-weight: bold;');
    }

    getCastableBoundsVirtual(cellSize) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
        const w = 2560 * scale;
        const h = 2560 * scale;
        ctx.drawImage(this.#bgImage, pos.x, pos.y, w, h);
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
        const canvas = document.createElement('canvas');
        canvas.width = imgWidth;
        canvas.height = imgHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        ctx.drawImage(this.#depthImage, 0, 0, imgWidth, imgHeight);
        const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight).data;
        
        const minD = this.#config.depthBounds.min;
        const maxD = this.#config.depthBounds.max;

        for (let i = 0; i < this.#cols; i++) {
            for (let j = 0; j < this.#rows; j++) {
                const px = Math.floor(i * cellSize + cellSize / 2);
                const py = Math.floor(j * cellSize + cellSize / 2);
                
                const index = (py * imgWidth + px) * 4;
                const r = imageData[index]; 
                
                const ratio = r / 255;
                const actualDepth = maxD - (ratio * (maxD - minD));
                
                this.#grid[i][j].depth = actualDepth;
            }
        }
    }

    recalculateZones(projector, cellSize) {
        for (let i = 0; i < this.#cols; i++) {
            for (let j = 0; j < this.#rows; j++) {
                this.#grid[i][j].isCastable = false;
                this.#grid[i][j].hasCollision = false;
                this.#grid[i][j].hasSnag = false;
            }
        }

        let visibleStartCol = 0;
        let visibleEndCol = this.#cols;

        if (projector) {
            const vLeft = projector.screenToVirtual(0, 0).x;
            const vRight = projector.screenToVirtual(projector.getCanvasWidth(), 0).x;
            visibleStartCol = Math.max(0, Math.floor(vLeft / cellSize));
            visibleEndCol = Math.min(this.#cols, Math.ceil(vRight / cellSize));
        }

        for (const z of this.#config.zones.castable) {
            let startX = z.adaptiveX ? visibleStartCol : z.x;
            let width = z.adaptiveX ? (visibleEndCol - visibleStartCol) : z.w;
            for (let i = startX; i < startX + width; i++) {
                for (let j = z.y; j < z.y + z.h; j++) {
                    if (this.#isValid(i, j)) this.#grid[i][j].isCastable = true;
                }
            }
        }

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

        for (const z of this.#config.zones.snags) {
            for (let i = z.x; i < z.x + z.w; i++) {
                for (let j = z.y; j < z.y + z.h; j++) {
                    if (this.#isValid(i, j)) this.#grid[i][j].hasSnag = true;
                }
            }
        }

        const castableZone = this.#config.zones.castable[0];
        if (castableZone && castableZone.adaptiveX) {
            for (const dz of this.#dynamicZones) {
                if (dz.bounds) {
                    dz.bounds.x = visibleStartCol;
                    dz.bounds.w = visibleEndCol - visibleStartCol;
                }
            }
        }
    }

    #isValid(x, y) { return x >= 0 && x < this.#cols && y >= 0 && y < this.#rows; }

    update(dt) {
        for (const dz of this.#dynamicZones) { dz.update(dt, this.#cols, this.#rows); }
    }

    getGrid() { return this.#grid; }
    getCols() { return this.#cols; }
    getRows() { return this.#rows; }
    getDynamicZones() { return this.#dynamicZones; }
    getDebugCanvas() { return this.#debugCanvas; } // <--- Геттер для кешу
    getCellAtVirtualPos(vX, vY, cellSize) {
        const c = Math.floor(vX / cellSize);
        const r = Math.floor(vY / cellSize);
        if (this.#isValid(c, r)) return this.#grid[c][r];
        return null;
    }
}

class ViewportProjector {
    #virtualWidth;
    #virtualHeight;
    #safeZoneTop;
    #safeZoneBottom;
    #canvasWidth;
    #canvasHeight;
    #scale;
    #offsetX;
    #offsetY;
    #cameraX;
    #maxScrollX;
    #alignment;
    #isFirstUpdate;

    constructor(config) {
        this.#virtualWidth = config.locations.baseResolution.width;
        this.#virtualHeight = config.locations.baseResolution.height;
        this.#safeZoneTop = config.locations.map.test.safeZone.top;
        this.#safeZoneBottom = config.locations.map.test.safeZone.bottom;
        
        // Зчитуємо об'єкт вирівнювання (з фоллбеком)
        this.#alignment = config.locations.map.test.initialAlignment || { x: 'center', y: 'safeZone' };
        
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
        if (this.#canvasWidth === canvasWidth && this.#canvasHeight === canvasHeight) return false;

        this.#canvasWidth = canvasWidth;
        this.#canvasHeight = canvasHeight;

        // 1. РОЗРАХУНОК МАСШТАБУ (Cover Effect)
        const safeZoneHeight = this.#safeZoneBottom - this.#safeZoneTop;
        const scaleForWidth = this.#canvasWidth / this.#virtualWidth;
        const scaleForSafeHeight = this.#canvasHeight / safeZoneHeight;
        
        this.#scale = Math.max(scaleForWidth, scaleForSafeHeight);

        // 2. ВЕРТИКАЛЬНЕ ВИРІВНЮВАННЯ (Залежить від alignment.y)
        const scaledHeight = this.#virtualHeight * this.#scale;
        
        if (this.#alignment.y === 'top') {
            this.#offsetY = 0; // Притиснути до верху
        } else if (this.#alignment.y === 'bottom') {
            this.#offsetY = this.#canvasHeight - scaledHeight; // Притиснути до низу
        } else if (this.#alignment.y === 'center') {
            this.#offsetY = (this.#canvasHeight - scaledHeight) / 2; // Центр всієї картинки
        } else { 
            // 'safeZone' - центрує рівно ігрову зелену зону (для ідеального фокусу на воді)
            const scaledSafeZoneTop = this.#safeZoneTop * this.#scale;
            const scaledSafeZoneHeight = safeZoneHeight * this.#scale;
            this.#offsetY = ((this.#canvasHeight - scaledSafeZoneHeight) / 2) - scaledSafeZoneTop;
        }

        // 3. ГОРИЗОНТАЛЬНИЙ СКРОЛ ТА ВИРІВНЮВАННЯ
        const scaledWidth = this.#virtualWidth * this.#scale;
        this.#maxScrollX = Math.max(0, scaledWidth - this.#canvasWidth);

        if (this.#maxScrollX > 0) {
            if (this.#isFirstUpdate) {
                if (this.#alignment.x === 'center') this.#cameraX = this.#maxScrollX / 2;
                else if (this.#alignment.x === 'right') this.#cameraX = this.#maxScrollX;
                else this.#cameraX = 0; // left
                
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
        this.#cameraX = Math.max(0, Math.min(this.#cameraX + deltaX, this.#maxScrollX));
        this.#offsetX = -this.#cameraX;
    }

    screenToVirtual(screenX, screenY) {
        return new Vector2(
            (screenX - this.#offsetX) / this.#scale,
            (screenY - this.#offsetY) / this.#scale
        );
    }

    virtualToScreen(vX, vY) {
        return new Vector2(
            (vX * this.#scale) + this.#offsetX,
            (vY * this.#scale) + this.#offsetY
        );
    }

    getScale() { return this.#scale; }
    getCanvasWidth() { return this.#canvasWidth; }
    getMaxScrollX() { return this.#maxScrollX; }
}