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

    // Return escaped zones to their starting position.
    if (isNaN(this.x) || isNaN(this.y)) {
      this.x = 10;
      this.y = 15;
    }


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


    const nextX = this.x + this.speedX * timeScale;
    if (isInside(nextX, this.y)) {
      this.x = nextX;
    } else {
      this.speedX *= -1;
      bounced = true;
    }


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
