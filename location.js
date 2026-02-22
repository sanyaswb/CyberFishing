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

    constructor(locationId, config) {
        this.#config = config.locations.map[locationId];
        this.#id = locationId;
        this.#dynamicZones = [];
        
        const baseRes = config.locations.baseResolution;
        this.#cols = Math.ceil(baseRes.width / config.locations.cellSize);
        this.#rows = Math.ceil(baseRes.height / config.locations.cellSize);
        
        this.#buildGrid(config.locations.cellSize);
        this.#applyZones();
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

    #applyZones() {
        for (const z of this.#config.zones.castable) {
            for (let i = z.x; i < z.x + z.w; i++) {
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
        
        if (this.#config.zones.dynamic) {
            for (const dzConfig of this.#config.zones.dynamic) {
                this.#dynamicZones.push(new DynamicZone(dzConfig));
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
    #canvasWidth;
    #canvasHeight;
    #virtualWidth;
    #virtualHeight;
    #scale;
    #offsetX;
    #offsetY;

    constructor(virtualWidth, virtualHeight) {
        this.#virtualWidth = virtualWidth;
        this.#virtualHeight = virtualHeight;
        this.#scale = 1;
        this.#offsetX = 0;
        this.#offsetY = 0;
    }

    update(canvasWidth, canvasHeight) {
        if (this.#canvasWidth === canvasWidth && this.#canvasHeight === canvasHeight) return;
        
        this.#canvasWidth = canvasWidth;
        this.#canvasHeight = canvasHeight;

        const scaleX = this.#canvasWidth / this.#virtualWidth;
        const scaleY = this.#canvasHeight / this.#virtualHeight;
        this.#scale = Math.max(scaleX, scaleY);

        const mapDisplayWidth = this.#virtualWidth * this.#scale;
        const mapDisplayHeight = this.#virtualHeight * this.#scale;

        this.#offsetX = (this.#canvasWidth - mapDisplayWidth) / 2;
        this.#offsetY = (this.#canvasHeight - mapDisplayHeight) / 2;
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
}