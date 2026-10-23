import { clampRectanglePosition, findRectangleContainer } from "../../../engine/math/rectangle_bounds.js";
import { gridMaskBounds } from "../../../engine/geometry/grid_mask.js";

export class DynamicZone {
  #rng;
  #occupied = {};

  constructor(config, rng = null, motionScale = 1) {
    this.#rng = rng || { next: () => Math.random() };
    this.id = config.id;
    this.type = config.type;
    this.shape = config.shape;
    this.mask = config.mask;
    this.multiplier = config.multiplier;
    this.x = config.x;
    this.y = config.y;
    this.w = config.w;
    this.h = config.h;
    this.moving = config.moving;
    this.bounds = config.bounds || null;

    this.currentSpeed =
      (Math.hypot(config.speedX || 0, config.speedY || 0) || 1.5) * motionScale;
    this.speedX = config.speedX ? config.speedX * motionScale : this.currentSpeed;
    this.speedY = (config.speedY || 0) * motionScale;
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
    const occupied = gridMaskBounds(this.mask, 0, 0, this.w, this.h, this.#occupied);
    let total = 0;
    const choices = [];
    for (const region of regions) {
      const x = Math.ceil(region.x - occupied.x), y = Math.ceil(region.y - occupied.y);
      const cols = Math.floor(region.x + region.w - occupied.x - occupied.w) - x + 1;
      const rows = Math.floor(region.y + region.h - occupied.y - occupied.h) - y + 1;
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
    const occupied = gridMaskBounds(this.mask, this.x, this.y, this.w, this.h, this.#occupied);
    const offsetX = occupied.x - this.x, offsetY = occupied.y - this.y;
    const region = findRectangleContainer(occupied, this.bounds);
    if (!region) return; // Invalid-sized data has no legal position; never silently resize gameplay state.
    clampRectanglePosition(occupied, region);
    this.x = occupied.x - offsetX; this.y = occupied.y - offsetY;
    const bouncedX = this.#moveAxis("x", "speedX", region.x - offsetX, region.x + region.w - occupied.w - offsetX, timeScale);
    const bouncedY = this.#moveAxis("y", "speedY", region.y - offsetY, region.y + region.h - occupied.h - offsetY, timeScale);
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
