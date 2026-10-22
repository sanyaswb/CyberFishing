import { clampRectanglePosition, findRectangleContainer } from "../../../engine/math/rectangle_bounds.js";

export class DynamicZone {
  #rng;

  constructor(config, rng = null) {
    this.#rng = rng || { next: () => Math.random() };
    this.id = config.id;
    this.type = config.type;
    this.shape = config.shape;
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

  // Fresh-map initialization only. Choose a legal grid point without enumerating all cells.
  randomizeStart(rng = this.#rng) {
    if (!this.moving || !this.bounds) return;
    const regions = Array.isArray(this.bounds) ? this.bounds : [this.bounds];
    let total = 0;
    const choices = [];
    for (const region of regions) {
      const x = Math.ceil(region.x), y = Math.ceil(region.y);
      const cols = Math.floor(region.x + region.w - this.w) - x + 1;
      const rows = Math.floor(region.y + region.h - this.h) - y + 1;
      if (cols <= 0 || rows <= 0 || !Number.isFinite(cols * rows)) continue;
      choices.push({ x, y, cols, count: cols * rows });
      total += cols * rows;
    }
    if (!total) return;
    let index = Math.min(total - 1, Math.floor(rng.next() * total));
    for (const choice of choices) {
      if (index >= choice.count) { index -= choice.count; continue; }
      this.x = choice.x + index % choice.cols;
      this.y = choice.y + Math.floor(index / choice.cols);
      return;
    }
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
    if (!this.bounds) {
      this.x += this.speedX * timeScale;
      this.y += this.speedY * timeScale;
      return;
    }
    const region = findRectangleContainer(this, this.bounds);
    if (!region) return; // Invalid-sized data has no legal position; never silently resize gameplay state.
    clampRectanglePosition(this, region);
    const bouncedX = this.#moveAxis("x", "speedX", region.x, region.x + region.w - this.w, timeScale);
    const bouncedY = this.#moveAxis("y", "speedY", region.y, region.y + region.h - this.h, timeScale);
    const bounced = bouncedX || bouncedY;

    if (bounced) {
      this.dirTimer = Math.max(this.dirTimer, 1000);
    }
  }

  #moveAxis(positionKey, speedKey, low, high, seconds) {
    if (seconds === 0) return false;
    const speed = this[speedKey], next = this[positionKey] + speed * seconds;
    if (!(high > low)) { this[positionKey] = low; return false; }
    if ((next > low && next < high) || speed === 0) { this[positionKey] = next; return false; }
    const span = high - low, period = span * 2;
    const phase = ((next - low) % period + period) % period;
    this[positionKey] = low + (phase <= span ? phase : period - phase);
    this[speedKey] = phase === 0 ? Math.abs(speed) : phase === span ? -Math.abs(speed) : speed * (phase < span ? 1 : -1);
    return true;
  }
}
