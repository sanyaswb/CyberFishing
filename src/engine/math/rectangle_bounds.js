export function containsRectangle(bound, rect) {
  return rect.x >= bound.x && rect.y >= bound.y && rect.x + rect.w <= bound.x + bound.w && rect.y + rect.h <= bound.y + bound.h;
}

// Returns a containing region, otherwise the nearest region that fits the full body. No union bounding-box gaps.
export function findRectangleContainer(rect, bounds) {
  const array = Array.isArray(bounds), count = array ? bounds.length : bounds ? 1 : 0;
  let best = null, distance = Infinity;
  for (let index = 0; index < count; index++) {
    const bound = array ? bounds[index] : bounds;
    if (!bound || !Number.isFinite(bound.x + bound.y + bound.w + bound.h) || bound.w < rect.w || bound.h < rect.h) continue;
    if (containsRectangle(bound, rect)) return bound;
    const dx = Math.max(bound.x, Math.min(rect.x, bound.x + bound.w - rect.w)) - rect.x;
    const dy = Math.max(bound.y, Math.min(rect.y, bound.y + bound.h - rect.h)) - rect.y;
    const squared = dx * dx + dy * dy;
    if (squared < distance) { distance = squared; best = bound; }
  }
  return best;
}

export function clampRectanglePosition(rect, bound) {
  rect.x = Math.max(bound.x, Math.min(rect.x, bound.x + bound.w - rect.w));
  rect.y = Math.max(bound.y, Math.min(rect.y, bound.y + bound.h - rect.h));
  return rect;
}

// The part of rect ({ x, y, w, h }) inside [0, width] × [0, height], written into out (no allocation).
export function clampRectangleToArea(rect, width, height, out) {
  const left = Math.max(0, Math.min(width, rect.x)), top = Math.max(0, Math.min(height, rect.y));
  const right = Math.max(left, Math.min(width, rect.x + rect.w)), bottom = Math.max(top, Math.min(height, rect.y + rect.h));
  out.x = left; out.y = top; out.w = right - left; out.h = bottom - top;
  return out;
}

// TK-358: the bounding box of a list of screen rectangles ({ count, getAt(i) → { x, y, width, height } }) written into
// out ({ left, top, right, bottom }); null for no list, no rectangles or an empty box (no allocation).
export function regionsBounds(regions, out) {
  if (!regions || regions.count === 0) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (let index = 0; index < regions.count; index += 1) {
    const region = regions.getAt(index);
    left = Math.min(left, region.x);
    top = Math.min(top, region.y);
    right = Math.max(right, region.x + region.width);
    bottom = Math.max(bottom, region.y + region.height);
  }
  if (!(right > left && bottom > top)) return null;
  out.left = left; out.top = top; out.right = right; out.bottom = bottom;
  return out;
}
