// TK-358 (from TK-271.2): where the location's background lies on screen this frame — its first layer's rectangle
// (world.backgroundLayers[0]), or the screen without one. The weather's particles keep their places as shares of it, so
// a camera move carries them with the location. One record rewritten in place.
export class BackgroundPlacement {
  x = 0;
  y = 0;
  width = 1;
  height = 1;

  place(world, viewWidth, viewHeight) {
    const layers = world?.backgroundLayers;
    const base = layers && layers.count > 0 ? layers.getAt(0) : null;
    if (base && base.width > 0 && base.height > 0) {
      this.x = base.x; this.y = base.y; this.width = base.width; this.height = base.height;
    } else {
      this.x = 0; this.y = 0; this.width = Math.max(1, viewWidth); this.height = Math.max(1, viewHeight);
    }
    return this;
  }

  get area() { return this.width * this.height; }

  // The part of it on screen, px².
  visibleArea(viewWidth, viewHeight) {
    return Math.max(0, Math.min(viewWidth, this.x + this.width) - Math.max(0, this.x)) *
      Math.max(0, Math.min(viewHeight, this.y + this.height) - Math.max(0, this.y));
  }

  screenX(share) { return this.x + share * this.width; }
  screenY(share) { return this.y + share * this.height; }
  shareX(x) { return (x - this.x) / this.width; }
  shareY(y) { return (y - this.y) / this.height; }
}
