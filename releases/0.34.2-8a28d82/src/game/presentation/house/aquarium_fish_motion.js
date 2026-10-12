export class AquariumFishMotion {
  #config;
  #rng;
  #fish = [];
  #width = 1;
  #height = 1;
  constructor({ config, rng }) { this.#config = config; this.#rng = rng; }
  get fish() { return this.#fish; }
  get config() { return this.#config; }
  setConfig(config) {
    if (!config || !config.zone || ![config.fishSizePx, config.sizeSpread,
      config.speedMinPxPerSecond, config.speedMaxPxPerSecond, config.directionMinMs,
      config.directionMaxMs, config.gridSizePx, ...Object.values(config.zone)].every(Number.isFinite) ||
      config.fishSizePx < 1 || config.fishSizePx > 200 || typeof config.showZone !== "boolean" ||
      config.sizeSpread < 0 || config.sizeSpread > .95 || config.gridSizePx > 100 ||
      config.speedMinPxPerSecond < 0 || config.speedMaxPxPerSecond > 100 || config.speedMaxPxPerSecond < config.speedMinPxPerSecond ||
      config.directionMinMs < 1 || config.directionMaxMs < config.directionMinMs || config.gridSizePx < 1 ||
      config.zone.x < 0 || config.zone.y < 0 || config.zone.width <= 0 || config.zone.height <= 0 ||
      config.zone.x + config.zone.width > 1 || config.zone.y + config.zone.height > 1) return false;
    this.#config = config;
    for (const fish of this.#fish) { this.#size(fish); this.#direction(fish); this.#clamp(fish); }
    return true;
  }
  setBounds(width, height) {
    const previousWidth = this.#width, previousHeight = this.#height;
    this.#width = Math.max(1, width); this.#height = Math.max(1, height);
    for (const fish of this.#fish) {
      fish.x = previousWidth > 1 ? fish.x / previousWidth * this.#width :
        (this.#config.zone.x + this.#rng.next() * this.#config.zone.width) * this.#width;
      fish.y = previousHeight > 1 ? fish.y / previousHeight * this.#height :
        (this.#config.zone.y + this.#rng.next() * this.#config.zone.height) * this.#height;
      this.#clamp(fish);
    }
  }
  setFish(fish) {
    const previous = new Map(this.#fish.map((entry) => [entry.id, entry]));
    this.#fish = fish.map((entry) => {
      const old = previous.get(entry.id);
      if (old) { old.imagePath = entry.imagePath; return old; }
      const item = { id: entry.id, imagePath: entry.imagePath, x: 0, y: 0, size: 0,
        vx: 0, vy: 0, turnMs: 0 };
      this.#size(item);
      const zone = this.#config.zone;
      item.x = (zone.x + this.#rng.next() * zone.width) * this.#width;
      item.y = (zone.y + this.#rng.next() * zone.height) * this.#height;
      this.#direction(item); this.#clamp(item); return item;
    });
  }
  update(deltaMs) {
    for (const fish of this.#fish) {
      fish.turnMs -= deltaMs;
      if (fish.turnMs <= 0) this.#direction(fish);
      fish.x += fish.vx * deltaMs / 1000;
      fish.y += fish.vy * deltaMs / 1000;
      this.#clamp(fish);
    }
  }
  #size(fish) { fish.size = this.#config.fishSizePx * (1 + (this.#rng.next() * 2 - 1) * this.#config.sizeSpread); }
  #direction(fish) {
    const cfg = this.#config;
    const angle = this.#rng.next() * Math.PI * 2;
    const speed = cfg.speedMinPxPerSecond + this.#rng.next() * (cfg.speedMaxPxPerSecond - cfg.speedMinPxPerSecond);
    fish.vx = Math.cos(angle) * speed; fish.vy = Math.sin(angle) * speed;
    fish.turnMs = cfg.directionMinMs + this.#rng.next() * (cfg.directionMaxMs - cfg.directionMinMs);
  }
  #clamp(fish) {
    const zone = this.#config.zone;
    fish.drawSize = Math.min(fish.size, zone.width * this.#width, zone.height * this.#height);
    const radius = fish.drawSize / 2;
    const left = zone.x * this.#width + radius, right = (zone.x + zone.width) * this.#width - radius;
    const top = zone.y * this.#height + radius, bottom = (zone.y + zone.height) * this.#height - radius;
    if (fish.x < left || fish.x > right) fish.vx *= -1;
    if (fish.y < top || fish.y > bottom) fish.vy *= -1;
    fish.x = Math.max(left, Math.min(right, fish.x)); fish.y = Math.max(top, Math.min(bottom, fish.y));
  }
}
