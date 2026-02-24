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
    #config;
    #id;
    #grid;
    #cols;
    #rows;
    #dynamicZones;
    #bgImage;
    #bgLoaded;

    constructor(locationId, config) {
        this.#config = config.locations.map[locationId];
        this.#id = locationId;
        this.#dynamicZones = [];
        this.#bgLoaded = false;
        
        const baseRes = config.locations.baseResolution;
        this.#cols = Math.ceil(baseRes.width / config.locations.cellSize);
        this.#rows = Math.ceil(baseRes.height / config.locations.cellSize);
        
        this.#bgImage = new Image();
        this.#bgImage.onload = () => { this.#bgLoaded = true; };
        this.#bgImage.src = this.#config.bgUrl;

        this.#buildGrid(config.locations.cellSize);
        
        if (this.#config.zones.dynamic) {
            for (const dzConfig of this.#config.zones.dynamic) {
                this.#dynamicZones.push(new DynamicZone(dzConfig));
            }
        }
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
                cell.depth = this.#config.depthBounds.min + Math.random() * (this.#config.depthBounds.max - this.#config.depthBounds.min);
                this.#grid[i][j] = cell;
            }
        }
    }

    recalculateZones(projector, cellSize) {
        // 1. Очищаємо стару сітку
        for (let i = 0; i < this.#cols; i++) {
            for (let j = 0; j < this.#rows; j++) {
                this.#grid[i][j].isCastable = false;
                this.#grid[i][j].hasCollision = false;
                this.#grid[i][j].hasSnag = false;
            }
        }

        // 2. Вираховуємо видимі межі екрана у віртуальних координатах (для адаптивності)
        let visibleStartCol = 0;
        let visibleEndCol = this.#cols;

        if (projector) {
            const vLeft = projector.screenToVirtual(0, 0).x;
            const vRight = projector.screenToVirtual(projector.getCanvasWidth(), 0).x;
            
            visibleStartCol = Math.max(0, Math.floor(vLeft / cellSize));
            visibleEndCol = Math.min(this.#cols, Math.ceil(vRight / cellSize));
        }

        // 3. Застосовуємо зони (з підтримкою adaptiveX)
        for (const z of this.#config.zones.castable) {
            let startX = z.adaptiveX ? visibleStartCol : z.x;
            let width = z.adaptiveX ? (visibleEndCol - visibleStartCol) : z.w;

            for (let i = startX; i < startX + width; i++) {
                for (let j = z.y; j < z.y + z.h; j++) {
                    if (this.#isValid(i, j)) this.#grid[i][j].isCastable = true;
                }
            }
        }

        // Статичні зони колізій і зачепів залишаються на своїх місцях
        for (const z of this.#config.zones.collisions) {
            for (let i = z.x; i < z.x + z.w; i++) {
                for (let j = z.y; j < z.y + z.h; j++) {
                    if (this.#isValid(i, j)) {
                        this.#grid[i][j].hasCollision = true;
                        this.#grid[i][j].isCastable = false; // Колізія перекриває зелену зону
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

        // Оновлюємо межі для динамічних зон (щоб риба не випливала за новий adaptiveX)
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

    #isValid(x, y) {
        return x >= 0 && x < this.#cols && y >= 0 && y < this.#rows;
    }

    update(dt) {
        for (const dz of this.#dynamicZones) {
            dz.update(dt, this.#cols, this.#rows);
        }
    }

    getGrid() { return this.#grid; }
    getCols() { return this.#cols; }
    getRows() { return this.#rows; }
    getDynamicZones() { return this.#dynamicZones; }
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