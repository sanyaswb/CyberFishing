class RarityVisualResolver {
  static EMPTY_DASH = Object.freeze([]);

  #configProvider;
  #animationResolver;
  #stops = null;
  #frame = null;
  #maximumEffects = null;
  #resolvedByPosition = new Map();
  #ordinaryDescriptors = new Map();
  #animatedDescriptor = {
    position: 0,
    id: "unknown",
    color: null,
    neutralColor: null,
    maximumColor: null,
    borderWidth: 0,
    frameAlpha: 0,
    background: { alpha: 0 },
    glow: {
      panelBlur: 0,
      panelAlpha: 0,
      imageBlur: 0,
      imageAlpha: 0,
    },
    pulse: 0,
    frameDash: RarityVisualResolver.EMPTY_DASH,
    frameDashSpeedPxPerSecond: 0,
    isAnimated: false,
  };

  constructor({ configProvider, animationResolver }) {
    if (typeof configProvider !== "function") {
      throw new TypeError("RarityVisualResolver requires configProvider");
    }
    if (!animationResolver || typeof animationResolver.resolvePulse !== "function") {
      throw new TypeError("RarityVisualResolver requires animationResolver");
    }
    this.#configProvider = configProvider;
    this.#animationResolver = animationResolver;
  }

  resolvePosition(position) {
    this.#ensureConfig();
    const normalized = this.#clamp01(position);
    const cacheKey = normalized.toFixed(6);
    const cached = this.#resolvedByPosition.get(cacheKey);
    if (cached) return cached;

    const upperIndex = this.#stops.findIndex(
      (stop) => stop.position >= normalized,
    );
    const resolvedUpperIndex =
      upperIndex < 0 ? this.#stops.length - 1 : upperIndex;
    const upper = this.#stops[resolvedUpperIndex];
    const lower = this.#stops[Math.max(0, resolvedUpperIndex - 1)] || upper;
    const span = upper.position - lower.position;
    const ratio = span > 0 ? (normalized - lower.position) / span : 0;
    const resolved = Object.freeze({
      position: normalized,
      id: ratio >= 0.5 ? upper.id : lower.id,
      color: Object.freeze(this.#mixRgb(lower.color, upper.color, ratio)),
    });
    this.#resolvedByPosition.set(cacheKey, resolved);
    return resolved;
  }

  resolveLevel(level, maxLevel, reserveMaximum = false) {
    const position = this.#resolveLevelPosition(
      level,
      maxLevel,
      reserveMaximum,
    );
    return this.resolvePosition(position);
  }

  resolveLevelDescriptor({
    level,
    maxLevel,
    reserveMaximum = false,
    isAnimated = false,
    nowMs = 0,
  } = {}) {
    const position = isAnimated
      ? 1
      : this.#resolveLevelPosition(level, maxLevel, reserveMaximum);
    return this.resolveDescriptor({ position, isAnimated, nowMs });
  }

  resolveDescriptor({ position, isAnimated = false, nowMs = 0 } = {}) {
    this.#ensureConfig();
    const visual = this.resolvePosition(position);
    const frame = this.#frame;
    const maximum = this.#maximumEffects;
    if (!isAnimated) {
      const cacheKey = visual.position.toFixed(6);
      const cached = this.#ordinaryDescriptors.get(cacheKey);
      if (cached) return cached;
      const descriptor = Object.freeze({
        position: visual.position,
        id: visual.id,
        color: visual.color,
        neutralColor: this.neutral.color,
        maximumColor: this.maximum.color,
        borderWidth: frame.borderWidth,
        frameAlpha: frame.strokeAlpha,
        background: Object.freeze({ alpha: frame.backgroundAlpha }),
        glow: Object.freeze({
          panelBlur: frame.panelGlow,
          panelAlpha: frame.panelGlowAlpha,
          imageBlur: 0,
          imageAlpha: 0,
        }),
        pulse: 0,
        frameDash: RarityVisualResolver.EMPTY_DASH,
        frameDashSpeedPxPerSecond: 0,
        isAnimated: false,
      });
      this.#ordinaryDescriptors.set(cacheKey, descriptor);
      return descriptor;
    }

    const descriptor = this.#animatedDescriptor;
    const pulse = this.#animationResolver.resolvePulse(
      nowMs,
      maximum.pulseDurationMs,
    );

    descriptor.position = visual.position;
    descriptor.id = visual.id;
    descriptor.color = visual.color;
    descriptor.neutralColor = this.neutral.color;
    descriptor.maximumColor = this.maximum.color;
    descriptor.borderWidth = this.#mixNumber(
      maximum.borderWidthMin,
      maximum.borderWidthMax,
      pulse,
    );
    descriptor.frameAlpha = maximum.strokeAlpha;
    descriptor.background.alpha = this.#mixNumber(
      maximum.backgroundAlphaMin,
      maximum.backgroundAlphaMax,
      pulse,
    );
    descriptor.glow.panelBlur = this.#mixNumber(
      maximum.panelGlowMin,
      maximum.panelGlowMax,
      pulse,
    );
    descriptor.glow.panelAlpha = maximum.panelGlowAlpha;
    descriptor.glow.imageBlur = this.#mixNumber(
      maximum.imageGlowMin,
      maximum.imageGlowMax,
      pulse,
    );
    descriptor.glow.imageAlpha = maximum.imageGlowAlpha;
    descriptor.pulse = pulse;
    descriptor.frameDash = maximum.frameDash;
    descriptor.frameDashSpeedPxPerSecond =
      maximum.frameDashSpeedPxPerSecond;
    descriptor.isAnimated = true;
    return descriptor;
  }

  get neutral() {
    return this.resolvePosition(0);
  }

  get maximum() {
    return this.resolvePosition(1);
  }

  get preMaximumPosition() {
    this.#ensureConfig();
    return this.#stops[Math.max(0, this.#stops.length - 2)].position;
  }

  invalidate() {
    this.#stops = null;
    this.#frame = null;
    this.#maximumEffects = null;
    this.#resolvedByPosition.clear();
    this.#ordinaryDescriptors.clear();
  }

  #resolveLevelPosition(level, maxLevel, reserveMaximum) {
    const normalizedLevel = Math.max(1, Math.round(Number(level) || 1));
    const normalizedMax = Math.max(
      normalizedLevel,
      Math.round(Number(maxLevel) || normalizedLevel),
    );
    const ratio =
      normalizedMax <= 1
        ? 0
        : (normalizedLevel - 1) / (normalizedMax - 1);
    return ratio * (reserveMaximum ? this.preMaximumPosition : 1);
  }

  #ensureConfig() {
    if (this.#stops) return;
    const config = this.#configProvider() || {};
    const sourceStops = Array.isArray(config.colorStops)
      ? config.colorStops
      : [];
    const normalized = sourceStops
      .map((stop, index) => ({
        id: String(stop?.id || `rarity-${index}`),
        position: this.#clamp01(stop?.position),
        color: this.#normalizeRgb(stop?.color),
      }))
      .sort((left, right) => left.position - right.position);

    this.#stops = normalized.length > 0
      ? normalized
      : [{ id: "unknown", position: 0, color: [0, 0, 0] }];
    const frame = config.frame || {};
    this.#frame = {
      borderWidth: this.#number(frame.borderWidth),
      backgroundAlpha: this.#clamp01(frame.backgroundAlpha),
      panelGlow: this.#number(frame.panelGlow),
      panelGlowAlpha: this.#clamp01(frame.panelGlowAlpha),
      strokeAlpha: this.#clamp01(frame.strokeAlpha),
    };
    const maximum = config.maximum || {};
    this.#maximumEffects = {
      pulseDurationMs: this.#number(maximum.pulseDurationMs, 1),
      frameDash: Array.isArray(maximum.frameDash)
        ? Object.freeze(maximum.frameDash.slice())
        : RarityVisualResolver.EMPTY_DASH,
      frameDashSpeedPxPerSecond: this.#number(
        maximum.frameDashSpeedPxPerSecond,
      ),
      borderWidthMin: this.#number(maximum.borderWidthMin),
      borderWidthMax: this.#number(maximum.borderWidthMax),
      panelGlowMin: this.#number(maximum.panelGlowMin),
      panelGlowMax: this.#number(maximum.panelGlowMax),
      panelGlowAlpha: this.#clamp01(maximum.panelGlowAlpha),
      imageGlowMin: this.#number(maximum.imageGlowMin),
      imageGlowMax: this.#number(maximum.imageGlowMax),
      imageGlowAlpha: this.#clamp01(maximum.imageGlowAlpha),
      backgroundAlphaMin: this.#clamp01(maximum.backgroundAlphaMin),
      backgroundAlphaMax: this.#clamp01(maximum.backgroundAlphaMax),
      strokeAlpha: this.#clamp01(maximum.strokeAlpha),
    };
  }

  #normalizeRgb(color) {
    if (!Array.isArray(color) || color.length < 3) return [0, 0, 0];
    return color.slice(0, 3).map((channel) =>
      Math.max(0, Math.min(255, Math.round(Number(channel) || 0))),
    );
  }

  #mixRgb(from, to, ratio) {
    const t = this.#clamp01(ratio);
    return [0, 1, 2].map((index) =>
      Math.round(from[index] + (to[index] - from[index]) * t),
    );
  }

  #mixNumber(from, to, ratio) {
    return from + (to - from) * this.#clamp01(ratio);
  }

  #number(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
