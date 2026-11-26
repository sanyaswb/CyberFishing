// TK-358: a set of zones on screen for the weather's particles (the rain, the ash, the starfall): the visible part of
// each zone (clipped to the screen), their cumulative areas for picking a point by area, the visible and the whole
// area (the density's share), and a point test. Zones come from the frame's world (a ReusableRenderList of screen
// rectangles: rainRegions, ashRegions, skyRegions) or, without zones, one fallback rectangle. Rebuilt every frame into
// arrays that grow only with the number of zones; no allocation on an ordinary frame.
export class ScreenZoneSet {
  #rects = new Float32Array(4);
  #weights = new Float32Array(1);
  #count = 0;
  #visibleArea = 0;
  #wholeArea = 0;
  #fallback = { x: 0, y: 0, width: 0, height: 0 };

  get count() { return this.#count; }
  get visibleArea() { return this.#visibleArea; }
  get wholeArea() { return this.#wholeArea; }

  // The fallback rectangle's record, filled by the caller before prepare(null, …).
  get fallback() { return this.#fallback; }

  // regions: { count, getAt(i) → { x, y, width, height } } or null (then the fallback rectangle alone).
  prepare(regions, viewWidth, viewHeight) {
    const count = regions ? regions.count : 1;
    if (this.#rects.length < count * 4) {
      this.#rects = new Float32Array(count * 4);
      this.#weights = new Float32Array(count);
    }
    let whole = 0, total = 0, visible = 0;
    for (let index = 0; index < count; index += 1) {
      const rect = regions ? regions.getAt(index) : this.#fallback;
      if (!(rect.width > 0 && rect.height > 0)) continue;
      whole += rect.width * rect.height;
      const left = Math.max(0, rect.x), top = Math.max(0, rect.y);
      const right = Math.min(viewWidth, rect.x + rect.width), bottom = Math.min(viewHeight, rect.y + rect.height);
      if (!(right > left && bottom > top)) continue;
      const offset = visible * 4;
      this.#rects[offset] = left; this.#rects[offset + 1] = top;
      this.#rects[offset + 2] = right - left; this.#rects[offset + 3] = bottom - top;
      total += (right - left) * (bottom - top);
      this.#weights[visible] = total;
      visible += 1;
    }
    this.#count = visible;
    this.#visibleArea = total;
    this.#wholeArea = whole;
  }

  // A random point of the visible zones, picked by area, written into out ({ x, y }); false when none is visible.
  // heightShare limits it to the top share of the chosen zone (the bolide starts in the upper half).
  pick(random, out, heightShare = 1) {
    if (this.#count === 0) return false;
    const pick = random() * this.#visibleArea;
    let zone = 0;
    while (zone < this.#count - 1 && this.#weights[zone] < pick) zone += 1;
    const offset = zone * 4;
    out.x = this.#rects[offset] + random() * this.#rects[offset + 2];
    out.y = this.#rects[offset + 1] + random() * this.#rects[offset + 3] * heightShare;
    return true;
  }

  // Spec 188: the visible rectangle of the zone that holds (x, y), written into out ({ x, y, width, height }); false
  // when no visible zone holds it (the lightning runs from that zone's top to its bottom).
  boundsAt(x, y, out) {
    for (let zone = 0; zone < this.#count; zone += 1) {
      const offset = zone * 4;
      const left = this.#rects[offset], top = this.#rects[offset + 1];
      const width = this.#rects[offset + 2], height = this.#rects[offset + 3];
      if (x >= left && y >= top && x <= left + width && y <= top + height) {
        out.x = left; out.y = top; out.width = width; out.height = height;
        return true;
      }
    }
    return false;
  }

  contains(x, y) {
    for (let zone = 0; zone < this.#count; zone += 1) {
      const offset = zone * 4;
      const left = this.#rects[offset], top = this.#rects[offset + 1];
      if (x >= left && y >= top && x <= left + this.#rects[offset + 2] && y <= top + this.#rects[offset + 3]) return true;
    }
    return false;
  }
}
