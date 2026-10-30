import { Vector2 } from "../../../engine/math/vector2.js";

const DEG = Math.PI / 180;

// The bait boat's procedural wake (spec 155): foam puffs in map coordinates, so the wake stays on the water while the
// camera moves. While a boat runs its motor it releases pairs of puffs from the stern along two arms of the Kelvin
// angle; each puff spreads outward with a decaying speed, grows and fades. Sizes and speeds follow the water surface
// scale (smaller far away). A fixed pool of particles is reused; nothing is allocated per frame.
export class BoatWakeEmitter {
  #getSettings;
  #capacity = 0;
  #count = 0;
  #x = null;
  #y = null;
  #vx = null;
  #vy = null;
  #age = null;
  #life = null;
  #size0 = null;
  #size1 = null;
  #alpha = null;
  #lastBoat = null;
  #pending = 0;
  // The projector writes screen points into a Vector2 (ViewportProjector.virtualToScreen calls out.set).
  #screen = new Vector2(0, 0);

  // getSettings(): CONFIG.ui.boat.wake, read every frame (live DevTools edits).
  constructor({ getSettings }) {
    if (typeof getSettings !== "function") throw new TypeError("BoatWakeEmitter requires getSettings");
    this.#getSettings = getSettings;
  }

  get count() {
    return this.#count;
  }

  // boats: the boats on the water; dtSec: the frame's seconds; surfaceScaleAt(y): the water metric's surface scale.
  update(boats, dtSec, surfaceScaleAt) {
    const settings = this.#getSettings();
    if (!settings?.enabled) {
      this.#count = 0;
      return;
    }
    this.#ensureCapacity(Math.max(0, Math.floor(Number(settings.capacity) || 0)));
    this.#advance(dtSec, settings);
    const boat = boats.length > 0 ? boats[0] : null;
    if (boat !== this.#lastBoat) {
      this.#lastBoat = boat;
      this.#pending = 0;
    }
    if (boat) this.#emit(boat, dtSec, settings, surfaceScaleAt);
  }

  // Screen records into list (ReusableRenderList): x, y, size, alpha.
  buildInto(list, projector) {
    const scale = projector.getScale();
    for (let index = 0; index < this.#count; index += 1) {
      const t = this.#age[index] / this.#life[index];
      const fade = (1 - t) * (1 - t);
      const alpha = this.#alpha[index] * fade;
      if (alpha <= 0.01) continue;
      const screen = projector.virtualToScreen(this.#x[index], this.#y[index], this.#screen);
      const record = list.acquire();
      record.x = screen.x;
      record.y = screen.y;
      record.size = (this.#size0[index] + (this.#size1[index] - this.#size0[index]) * Math.sqrt(t)) * scale;
      record.alpha = alpha;
    }
  }

  #advance(dtSec, settings) {
    const damping = Math.exp(-Math.max(0, Number(settings.damping) || 0) * dtSec);
    let index = 0;
    while (index < this.#count) {
      this.#age[index] += dtSec;
      if (this.#age[index] >= this.#life[index]) {
        this.#remove(index);
        continue;
      }
      this.#x[index] += this.#vx[index] * dtSec;
      this.#y[index] += this.#vy[index] * dtSec;
      this.#vx[index] *= damping;
      this.#vy[index] *= damping;
      index += 1;
    }
  }

  // Pairs per second scale with the boat's share of its top speed, so the wake does not depend on the frame rate.
  #emit(boat, dtSec, settings, surfaceScaleAt) {
    const motor = (boat.state === "deploying" || boat.state === "returning") &&
      (boat.animationState === "moving" || boat.animationState === "moving_start") && Number(boat.powerRatio) > 0;
    if (!motor) {
      this.#pending = 0;
      return;
    }
    const speed = Math.hypot(boat.velocity.x, boat.velocity.y);
    const intensity = Math.min(1, speed / Math.max(1, Number(boat.stats?.speedPxPerSec) || 1));
    if (intensity < 0.05) return;
    this.#pending += dtSec * (Number(settings.ratePerSecond) || 0) * intensity;
    const surface = surfaceScaleAt(boat.pos.y);
    const noseX = Math.cos(boat.angle), noseY = Math.sin(boat.angle);
    const sternOffset = (Number(settings.sternOffsetPx) || 0) * surface;
    const sternX = boat.pos.x - noseX * sternOffset, sternY = boat.pos.y - noseY * sternOffset;
    const arm = (Number(settings.armAngleDeg) || 0) * DEG;
    const spread = (Number(settings.spreadSpeedPx) || 0) * surface * (0.5 + 0.5 * intensity);
    const sizeScale = surface * (0.6 + 0.4 * intensity);
    const life = Math.max(0.05, Number(settings.lifeSec) || 0);
    const startSize = (Number(settings.startSizePx) || 0) * sizeScale;
    const endSize = (Number(settings.endSizePx) || 0) * sizeScale;
    const alpha = Math.max(0, Math.min(1, Number(settings.alpha) || 0));
    const leftAngle = boat.angle + Math.PI - arm, rightAngle = boat.angle + Math.PI + arm;
    while (this.#pending >= 1) {
      this.#pending -= 1;
      // Backward along the course, turned outward by the Kelvin angle on each side.
      this.#add(sternX, sternY, Math.cos(leftAngle) * spread, Math.sin(leftAngle) * spread, life, startSize, endSize, alpha);
      this.#add(sternX, sternY, Math.cos(rightAngle) * spread, Math.sin(rightAngle) * spread, life, startSize, endSize,
        alpha);
      // Small, short-lived foam pushed up at the bow.
      if (settings.bowFoam) {
        this.#add(boat.pos.x + noseX * sternOffset, boat.pos.y + noseY * sternOffset, 0, 0, life * 0.35, startSize,
          startSize * 1.2, alpha);
      }
    }
  }

  #add(x, y, vx, vy, life, size0, size1, alpha) {
    if (this.#count >= this.#capacity) return;
    const index = this.#count;
    this.#count += 1;
    this.#x[index] = x;
    this.#y[index] = y;
    this.#vx[index] = vx;
    this.#vy[index] = vy;
    this.#age[index] = 0;
    this.#life[index] = life;
    this.#size0[index] = size0;
    this.#size1[index] = size1;
    this.#alpha[index] = alpha;
  }

  #remove(index) {
    const last = this.#count - 1;
    this.#x[index] = this.#x[last];
    this.#y[index] = this.#y[last];
    this.#vx[index] = this.#vx[last];
    this.#vy[index] = this.#vy[last];
    this.#age[index] = this.#age[last];
    this.#life[index] = this.#life[last];
    this.#size0[index] = this.#size0[last];
    this.#size1[index] = this.#size1[last];
    this.#alpha[index] = this.#alpha[last];
    this.#count = last;
  }

  #ensureCapacity(capacity) {
    if (capacity === this.#capacity) return;
    this.#capacity = capacity;
    this.#count = 0;
    this.#x = new Float32Array(capacity);
    this.#y = new Float32Array(capacity);
    this.#vx = new Float32Array(capacity);
    this.#vy = new Float32Array(capacity);
    this.#age = new Float32Array(capacity);
    this.#life = new Float32Array(capacity);
    this.#size0 = new Float32Array(capacity);
    this.#size1 = new Float32Array(capacity);
    this.#alpha = new Float32Array(capacity);
  }
}
