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
      const dxTarget = targetX - fromX;
      const dyTarget = targetY - fromY;

      const directLow = this.#rayLow(fromX, fromY, dxTarget, dyTarget, checkWater);
      let bestX = fromX + dxTarget * directLow;
      let bestY = fromY + dyTarget * directLow;
      let bestDistSq = (bestX - targetX) ** 2 + (bestY - targetY) ** 2;

      const xALow = this.#axisLow(fromX, dxTarget, (x) => checkWater(x, fromY));
      if (xALow > 0) {
        const xA = fromX + dxTarget * xALow;
        const yALow = this.#axisLow(fromY, dyTarget, (y) => checkWater(xA, y));
        const yA = fromY + dyTarget * yALow;
        const distASq = (xA - targetX) ** 2 + (yA - targetY) ** 2;
        if (distASq < bestDistSq) {
          bestX = xA;
          bestY = yA;
          bestDistSq = distASq;
        }
      }

      const yBLow = this.#axisLow(fromY, dyTarget, (y) => checkWater(fromX, y));
      if (yBLow > 0) {
        const yB = fromY + dyTarget * yBLow;
        const xBLow = this.#axisLow(fromX, dxTarget, (x) => checkWater(x, yB));
        const xB = fromX + dxTarget * xBLow;
        const distBSq = (xB - targetX) ** 2 + (yB - targetY) ** 2;
        if (distBSq < bestDistSq) {
          bestX = xB;
          bestY = yB;
          bestDistSq = distBSq;
        }
      }

      if (dxTarget !== 0 && Math.abs(bestX - fromX) < 1e-6) {
        bestX = fromX;
        bestY = fromY;
      }

      position.x = bestX;
      position.y = bestY;
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

  #rayLow(fromX, fromY, dx, dy, checkWater) {
    if (dx === 0 && dy === 0) return 0;
    let low = 0;
    let high = 1;
    for (let index = 0; index < 12; index++) {
      const mid = (low + high) / 2;
      if (checkWater(fromX + dx * mid, fromY + dy * mid)) low = mid;
      else high = mid;
    }
    return low;
  }

  #axisLow(fromCoord, delta, check) {
    if (delta === 0) return 0;
    if (check(fromCoord + delta)) return 1;
    let low = 0;
    let high = 1;
    for (let index = 0; index < 12; index++) {
      const mid = (low + high) / 2;
      if (check(fromCoord + delta * mid)) low = mid;
      else high = mid;
    }
    return low;
  }
}
