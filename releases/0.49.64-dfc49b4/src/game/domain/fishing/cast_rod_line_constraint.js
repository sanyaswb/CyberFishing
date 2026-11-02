export class CastRodLineConstraint {
  // Path ratio at the taut-line boundary; >1 means the target is still within the available slack.
  freeRodMovementRatio({ position, previousRod, nextRod, releasedLengthPx }) {
    const dx = nextRod.x - previousRod.x;
    const dy = nextRod.y - previousRod.y;
    const a = dx * dx + dy * dy;
    if (a <= 0) return 1;
    const x = previousRod.x - position.x;
    const y = previousRod.y - position.y;
    const radius = Math.max(0, releasedLengthPx, Math.hypot(x, y));
    const b = x * dx + y * dy;
    const c = Math.min(0, x * x + y * y - radius * radius);
    const root = Math.sqrt(Math.max(0, b * b - a * c));
    const ratio = b >= 0 ? (b + root > 0 ? -c / (b + root) : 0) : (-b + root) / a;
    return Math.max(0, ratio);
  }

  // Ground-plane points in base pixels. Preserve existing slack and correct only extension caused by the rod.
  project({ position, previousRod, nextRod, releasedLengthPx, out }) {
    const previousDistance = Math.hypot(position.x - previousRod.x, position.y - previousRod.y);
    const dx = position.x - nextRod.x;
    const dy = position.y - nextRod.y;
    const nextDistance = Math.hypot(dx, dy);
    const radius = Math.max(0, releasedLengthPx, previousDistance);
    const ratio = nextDistance > radius && nextDistance > 0 ? radius / nextDistance : 1;
    out.x = nextRod.x + dx * ratio;
    out.y = nextRod.y + dy * ratio;
    return out;
  }
}
