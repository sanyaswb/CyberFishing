export class AquariumFishView {
  #fishArt;
  #canvas;
  #context;
  #window;
  #motion;
  #images = new Map();
  #observer;
  #frame = null;
  #last = null;
  #visible = false;
  #createImage;
  #style;
  #ratio = 0;
  // fishArt: FishArtVariants (each live bait's thumbnail through the asset registry).
  constructor({ canvas, windowTarget, motion, createImage, observeResize, style, fishArt }) {
    if (typeof fishArt?.thumbnailPath !== "function") throw new TypeError("AquariumFishView requires fishArt");
    this.#fishArt = fishArt;
    this.#canvas = canvas; this.#window = windowTarget; this.#motion = motion; this.#style = style;
    this.#context = canvas.getContext("2d");
    this.#createImage = createImage;
    this.#observer = observeResize(canvas, this.#resize);
    this.#resize();
  }
  setConfig(config) { return this.#motion.setConfig(config); }
  show(fish, owned) {
    this.#visible = owned;
    this.#canvas.hidden = !owned;
    this.#motion.setFish(fish);
    for (const entry of fish) {
      const path = this.#fishArt.thumbnailPath(entry.imagePath);
      if (path && !this.#images.has(entry.imagePath)) {
        const image = this.#createImage(); image.src = path; this.#images.set(entry.imagePath, image);
      }
    }
    if (owned && this.#frame === null) this.#frame = this.#window.requestAnimationFrame(this.#tick);
    if (!owned && this.#frame !== null) {
      this.#window.cancelAnimationFrame(this.#frame); this.#frame = null; this.#last = null;
    }
  }
  dispose() {
    if (this.#frame !== null) this.#window.cancelAnimationFrame(this.#frame);
    this.#observer.disconnect(); this.#images.clear();
  }
  #resize = () => {
    const rect = this.#canvas.getBoundingClientRect();
    const ratio = this.#window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
    // Assigning even an unchanged size resets the bitmap and its context (DESIGN_RULES §13).
    if (width === this.#canvas.width && height === this.#canvas.height && ratio === this.#ratio) return;
    this.#canvas.width = width; this.#canvas.height = height; this.#ratio = ratio;
    this.#context.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.#motion.setBounds(rect.width, rect.height);
  };
  #tick = (now) => {
    const delta = this.#last === null ? 0 : Math.min(100, now - this.#last);
    this.#last = now; this.#motion.update(delta); this.#render();
    this.#frame = this.#visible ? this.#window.requestAnimationFrame(this.#tick) : null;
  };
  #render() {
    const context = this.#context;
    const ratio = this.#window.devicePixelRatio || 1;
    const width = this.#canvas.width / ratio, height = this.#canvas.height / ratio;
    context.clearRect(0, 0, width, height);
    const config = this.#motion.config, zone = config.zone;
    const x = zone.x * width, y = zone.y * height, w = zone.width * width, h = zone.height * height;
    if (config.showZone) {
      context.fillStyle = this.#style.zoneFill; context.fillRect(x, y, w, h);
      context.strokeStyle = this.#style.zoneStroke; context.lineWidth = 1; context.beginPath();
      for (let dx = 0; dx <= w; dx += config.gridSizePx) { context.moveTo(x + dx, y); context.lineTo(x + dx, y + h); }
      for (let dy = 0; dy <= h; dy += config.gridSizePx) { context.moveTo(x, y + dy); context.lineTo(x + w, y + dy); }
      context.stroke(); context.strokeRect(x, y, w, h);
    }
    context.save(); context.beginPath(); context.rect(x, y, w, h); context.clip();
    for (const fish of this.#motion.fish) {
      const image = this.#images.get(fish.imagePath);
      context.save(); context.translate(fish.x, fish.y); context.scale(fish.vx < 0 ? -1 : 1, 1);
      if (image?.complete && image.naturalWidth > 0) context.drawImage(image, -fish.drawSize / 2, -fish.drawSize / 2, fish.drawSize, fish.drawSize);
      else { context.fillStyle = this.#style.placeholderFish; context.beginPath(); context.ellipse(0, 0, fish.drawSize / 2, fish.drawSize / 4, 0, 0, Math.PI * 2); context.fill(); }
      context.restore();
    }
    context.restore();
  }
}
