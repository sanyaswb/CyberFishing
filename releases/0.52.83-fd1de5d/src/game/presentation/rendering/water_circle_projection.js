import { Vector2 } from "../../../engine/math/vector2.js";

const SEGMENTS = 64;
const CIRCLE = Array.from({ length: SEGMENTS * 2 }, (_, index) => index % 2 === 0
  ? Math.cos(index / 2 * Math.PI * 2 / SEGMENTS) : Math.sin((index - 1) / 2 * Math.PI * 2 / SEGMENTS));

// A ground circle's actual boundary in exact metres (the landing range, spec 126 D-R2), for both scene paths.
// Geometry and scratch vectors belong to the render record; unchanged metric/centre/radius/viewport readings
// perform no projection work or buffer writes.
export function projectWaterCircle(target, metric, projector, x, y, radiusBasePixels) {
  const cache = target.projectionCache ||= { ground: new Vector2(), map: new Vector2(), screen: new Vector2() };
  projector.virtualToScreen(x, y, cache.screen);
  const scale = projector.getScale();
  const dirty = cache.metric !== metric || cache.x !== x || cache.y !== y || cache.radius !== radiusBasePixels ||
    cache.scale !== scale || target.x !== cache.screen.x || target.y !== cache.screen.y;
  target.x = cache.screen.x; target.y = cache.screen.y;
  if (!dirty) return;
  cache.metric = metric; cache.x = x; cache.y = y; cache.radius = radiusBasePixels; cache.scale = scale;
  const points = target.points ||= [];
  metric.toGround(x, y, cache.ground);
  const radius = radiusBasePixels / metric.pixelsPerMeter;
  for (let index = 0; index < SEGMENTS; index++) {
    metric.toVirtual(cache.ground.x + CIRCLE[index * 2] * radius,
      cache.ground.y + CIRCLE[index * 2 + 1] * radius, cache.map);
    projector.virtualToScreen(cache.map.x, cache.map.y, cache.screen);
    points[index * 2] = cache.screen.x; points[index * 2 + 1] = cache.screen.y;
  }
  target.pointCount = SEGMENTS;
}
