// Final ground-plane reach constraint for unhooked tackle. Position and velocity are updated in place; only the
// outward radial velocity is removed at the limit, so current may slide along it and retrieval may move inward.
export class TackleLineReachConstraint {
  apply(position, velocity, rod, maxDistancePx, checkWater = null) {
    if (!Number.isFinite(maxDistancePx)) return;
    const radius = Math.max(0, maxDistancePx);
    const dx = position.x - rod.x, dy = position.y - rod.y;
    const distance = Math.hypot(dx, dy);
    if (distance < radius || distance === 0) return;
    const nx = dx / distance, ny = dy / distance;
    const targetX = rod.x + nx * radius;
    const targetY = rod.y + ny * radius;
    if (checkWater && !checkWater(targetX, targetY)) {
      const fromX = checkWater(position.x, position.y) ? position.x : rod.x;
      const fromY = checkWater(position.x, position.y) ? position.y : rod.y;
      let low = 0, high = 1;
      for (let i = 0; i < 12; i++) {
        const mid = (low + high) / 2;
        const testX = fromX + (targetX - fromX) * mid;
        const testY = fromY + (targetY - fromY) * mid;
        if (checkWater(testX, testY)) low = mid;
        else high = mid;
      }
      position.x = fromX + (targetX - fromX) * low;
      position.y = fromY + (targetY - fromY) * low;
    } else {
      position.x = targetX;
      position.y = targetY;
    }
    const outward = velocity.x * nx + velocity.y * ny;
    if (outward > 0) {
      velocity.x -= outward * nx;
      velocity.y -= outward * ny;
    }
  }
}
