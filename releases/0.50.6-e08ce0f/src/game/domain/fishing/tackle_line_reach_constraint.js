// Final ground-plane reach constraint for unhooked tackle. Position and velocity are updated in place; only the
// outward radial velocity is removed at the limit, so current may slide along it and retrieval may move inward.
export class TackleLineReachConstraint {
  apply(position, velocity, rod, maxDistancePx) {
    if (!Number.isFinite(maxDistancePx)) return;
    const radius = Math.max(0, maxDistancePx);
    const dx = position.x - rod.x, dy = position.y - rod.y;
    const distance = Math.hypot(dx, dy);
    if (distance < radius || distance === 0) return;
    const nx = dx / distance, ny = dy / distance;
    position.x = rod.x + nx * radius;
    position.y = rod.y + ny * radius;
    const outward = velocity.x * nx + velocity.y * ny;
    if (outward > 0) {
      velocity.x -= outward * nx;
      velocity.y -= outward * ny;
    }
  }
}
