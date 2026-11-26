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

    const fromX = checkWater && checkWater(position.x, position.y) ? position.x : rod.x;
    const fromY = checkWater && checkWater(position.x, position.y) ? position.y : rod.y;
    const dxTarget = targetX - fromX;
    const dyTarget = targetY - fromY;

    const directT = checkWater ? this.#firstObstacleT(fromX, fromY, dxTarget, dyTarget, checkWater) : 1;
    const isDirectWater = checkWater ? (directT >= 1 && checkWater(targetX, targetY)) : true;

    if (checkWater && !isDirectWater) {
      let bestX = fromX + dxTarget * directT;
      let bestY = fromY + dyTarget * directT;
      let bestDistSq = (bestX - targetX) ** 2 + (bestY - targetY) ** 2;

      const tXA = this.#firstObstacleT(fromX, fromY, dxTarget, 0, checkWater);
      if (tXA > 0) {
        const xA = fromX + dxTarget * tXA;
        const tYA = this.#firstObstacleT(xA, fromY, 0, dyTarget, checkWater);
        const yA = fromY + dyTarget * tYA;
        const distASq = (xA - targetX) ** 2 + (yA - targetY) ** 2;
        if (distASq < bestDistSq) {
          bestX = xA;
          bestY = yA;
          bestDistSq = distASq;
        }
      }

      const tYB = this.#firstObstacleT(fromX, fromY, 0, dyTarget, checkWater);
      if (tYB > 0) {
        const yB = fromY + dyTarget * tYB;
        const tXB = this.#firstObstacleT(fromX, yB, dxTarget, 0, checkWater);
        const xB = fromX + dxTarget * tXB;
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

  #firstObstacleT(fromX, fromY, dx, dy, checkWater, stepPx = 1.5) {
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return 1;
    const numSteps = Math.max(1, Math.ceil(dist / stepPx));
    let prevT = 0;
    for (let i = 1; i <= numSteps; i++) {
      const t = Math.min(1, i / numSteps);
      if (!checkWater(fromX + dx * t, fromY + dy * t)) {
        let low = prevT;
        let high = t;
        for (let j = 0; j < 6; j++) {
          const mid = (low + high) / 2;
          if (checkWater(fromX + dx * mid, fromY + dy * mid)) low = mid;
          else high = mid;
        }
        return low;
      }
      prevT = t;
    }
    return 1;
  }
}
