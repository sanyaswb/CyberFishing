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
