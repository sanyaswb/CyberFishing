const MS_PER_HOUR = 3600000;
// Drops of the same chum closer than this share of its radius form one spot (the earlier overlap rule).
const SAME_SPOT_RADIUS_SHARE = 0.6;

// A chum spot (spec 152): every drop of one chum at one place, timed by monotonic game time. Its age is the average of
// all drops (a fresh drop rejuvenates it by 1/(n+1)), its centre the average of the drops' centres, its radius the
// chum's. Each drop adds one unit of feed that the fish eat at `feed.eatenPerHour`; above `feed.comfortLoad` the bonus
// falls linearly to `feed.overfedMultiplier` at `feed.maxLoad` (overfed fish bite worse). Without `feed` there is no
// overfeeding.
export class ChumZone {
  constructor({ id, x, y, baitConfig, drops = 1, meanDropGameMs, feedLoad = 1, feedGameMs = meanDropGameMs }) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.baitId = baitConfig.id;
    this.baitConfig = baitConfig;
    this.drops = drops;
    this.meanDropGameMs = meanDropGameMs;
    this.feedLoad = feedLoad;
    this.feedGameMs = feedGameMs;
    this.isExpired = false;
    this.currentBonus = 1.0;

    this.baseRadius = baitConfig.radius || 150;
  }

  isSameSpot(baitId, x, y, waterMetric) {
    return baitId === this.baitId &&
      waterMetric.surfaceDistanceBasePixels(this.x, this.y, x, y, (this.y + y) / 2) <
        this.baseRadius * SAME_SPOT_RADIUS_SHARE;
  }

  addDrop(x, y, gameMs) {
    const drops = this.drops;
    this.feedLoad = this.feedAt(gameMs) + 1;
    this.feedGameMs = gameMs;
    this.x = (this.x * drops + x) / (drops + 1);
    this.y = (this.y * drops + y) / (drops + 1);
    this.meanDropGameMs = (this.meanDropGameMs * drops + gameMs) / (drops + 1);
    this.drops = drops + 1;
  }

  feedAt(gameMs) {
    const eatenPerHour = Number(this.baitConfig.feed?.eatenPerHour) || 0;
    const eaten = Math.max(0, gameMs - this.feedGameMs) / MS_PER_HOUR * eatenPerHour;
    return Math.max(0, this.feedLoad - eaten);
  }

  updateState(gameMs) {
    const cfg = this.baitConfig;
    const age = Math.max(0, gameMs - this.meanDropGameMs);
    const peakStartTime = cfg.rampUpTimeMs;
    const peakEndTime = peakStartTime + cfg.peakDurationMs;
    const totalTime = cfg.totalBonusTimeMs;
    const expireTime = totalTime + cfg.minBonusDurationHours * MS_PER_HOUR;

    if (age >= expireTime) {
      this.isExpired = true;
      return 0;
    }

    let bonus;
    if (age < peakStartTime) {
      bonus = 1.0 + (cfg.maxBonus - 1.0) * (age / peakStartTime);
    } else if (age < peakEndTime) {
      bonus = cfg.maxBonus;
    } else if (age < totalTime) {
      const progress = (age - peakEndTime) / (totalTime - peakEndTime);
      bonus = cfg.maxBonus - (cfg.maxBonus - cfg.minBonus) * progress;
    } else {
      bonus = cfg.minBonus;
    }
    return this.#overfed(bonus, gameMs);
  }

  getMultiplierAt(targetX, targetY, targetFishId, waterMetric) {
    if (this.isExpired) return 1.0;

    if (
      targetFishId !== null &&
      !this.baitConfig.targetFishes.includes(targetFishId)
    ) {
      return 1.0;
    }

    return this.covers(targetX, targetY, waterMetric) ? this.currentBonus : 1.0;
  }

  covers(x, y, waterMetric) {
    return waterMetric.surfaceDistanceBasePixels(this.x, this.y, x, y) <= this.baseRadius;
  }

  #overfed(bonus, gameMs) {
    const feed = this.baitConfig.feed;
    if (!feed) return bonus;
    const comfort = Number(feed.comfortLoad);
    const max = Number(feed.maxLoad);
    const load = this.feedAt(gameMs);
    if (!(load > comfort) || !(max > comfort)) return bonus;
    const share = Math.min(1, (load - comfort) / (max - comfort));
    return bonus + (Number(feed.overfedMultiplier) - bonus) * share;
  }
}
