class RarityVisualResolver {
  static EMPTY_DASH = Object.freeze([]);

  #configProvider;
  #animationResolver;
  #stops = null;
  #frame = null;
  #uniqueEffects = null;
  #resolvedByPosition = new Map();
  #ordinaryDescriptors = new Map();
  #semanticDescriptors = new Map();
  #ordinaryStops = null;
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

  resolve({ tier, maxTier, isUnique = false } = {}) {
    this.#ensureConfig();
    const normalizedTier = Math.max(1, Math.round(Number(tier) || 1));
    const normalizedMaxTier = Math.max(
      normalizedTier,
      Math.round(Number(maxTier) || normalizedTier),
    );
    const tierPosition =
      normalizedMaxTier <= 1
        ? 0
        : (normalizedTier - 1) / (normalizedMaxTier - 1);
    const unique = isUnique === true;
    const palettePosition = unique
      ? 1
      : tierPosition * this.preMaximumPosition;
    const cacheKey = `${palettePosition.toFixed(6)}:${unique ? 1 : 0}`;
    const cached = this.#semanticDescriptors.get(cacheKey);
    if (cached) return cached;

    const visual = this.resolvePosition(palettePosition);
    const color = visual.color;
    const frame = this.#frame;
    const uniqueEffects = this.#uniqueEffects;
    const backgroundAlpha = unique
      ? uniqueEffects.backgroundAlphaMin
      : frame.backgroundAlpha;
    const itemGlowEnabled = unique && uniqueEffects.itemGlowEnabled;
    const descriptor = Object.freeze({
      id: unique ? "unique" : visual.id,
      normalized: visual.position,
      color,
      cssColor: this.#toCssColor(color),
      borderWidth: unique
        ? uniqueEffects.borderWidthMin
        : frame.borderWidth,
      background: Object.freeze({
        color,
        alpha: backgroundAlpha,
      }),
      glow: Object.freeze({
        enabled: itemGlowEnabled,
        blur: itemGlowEnabled ? uniqueEffects.panelGlowMax : 0,
      }),
      animation: Object.freeze({
        enabled: unique,
        durationMs: unique ? uniqueEffects.pulseDurationMs : 0,
      }),
      isUnique: unique,
    });
    this.#semanticDescriptors.set(cacheKey, descriptor);
    return descriptor;
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

  resolveLevel(level, maxLevel, reserveMaximum = true) {
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
    reserveMaximum = true,
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
    const uniqueEffects = this.#uniqueEffects;
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
      uniqueEffects.pulseDurationMs,
    );

    descriptor.position = visual.position;
    descriptor.id = visual.id;
    descriptor.color = visual.color;
    descriptor.neutralColor = this.neutral.color;
    descriptor.maximumColor = this.maximum.color;
    descriptor.borderWidth = this.#mixNumber(
      uniqueEffects.borderWidthMin,
      uniqueEffects.borderWidthMax,
      pulse,
    );
    descriptor.frameAlpha = uniqueEffects.strokeAlpha;
    descriptor.background.alpha = this.#mixNumber(
      uniqueEffects.backgroundAlphaMin,
      uniqueEffects.backgroundAlphaMax,
      pulse,
    );
    descriptor.glow.panelBlur = this.#mixNumber(
      uniqueEffects.panelGlowMin,
      uniqueEffects.panelGlowMax,
      pulse,
    );
    descriptor.glow.panelAlpha = uniqueEffects.panelGlowAlpha;
    descriptor.glow.imageBlur = this.#mixNumber(
      uniqueEffects.imageGlowMin,
      uniqueEffects.imageGlowMax,
      pulse,
    );
    descriptor.glow.imageAlpha = uniqueEffects.imageGlowAlpha;
    descriptor.pulse = pulse;
    descriptor.frameDash = uniqueEffects.frameDash;
    descriptor.frameDashSpeedPxPerSecond =
      uniqueEffects.frameDashSpeedPxPerSecond;
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

  get ordinaryStops() {
    this.#ensureConfig();
    if (!this.#ordinaryStops) {
      const lastIndex = Math.max(1, this.#stops.length - 1);
      this.#ordinaryStops = Object.freeze(
        this.#stops
          .slice(0, lastIndex)
          .map((stop) => this.resolvePosition(stop.position)),
      );
    }
    return this.#ordinaryStops;
  }

  invalidate() {
    this.#stops = null;
    this.#frame = null;
    this.#uniqueEffects = null;
    this.#ordinaryStops = null;
    this.#resolvedByPosition.clear();
    this.#ordinaryDescriptors.clear();
    this.#semanticDescriptors.clear();
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
    const uniqueEffects = config.uniqueEffects || {};
    this.#uniqueEffects = {
      itemGlowEnabled: uniqueEffects.itemGlowEnabled !== false,
      pulseDurationMs: this.#number(uniqueEffects.pulseDurationMs, 1),
      frameDash: Array.isArray(uniqueEffects.frameDash)
        ? Object.freeze(uniqueEffects.frameDash.slice())
        : RarityVisualResolver.EMPTY_DASH,
      frameDashSpeedPxPerSecond: this.#number(
        uniqueEffects.frameDashSpeedPxPerSecond,
      ),
      borderWidthMin: this.#number(uniqueEffects.borderWidthMin),
      borderWidthMax: this.#number(uniqueEffects.borderWidthMax),
      panelGlowMin: this.#number(uniqueEffects.panelGlowMin),
      panelGlowMax: this.#number(uniqueEffects.panelGlowMax),
      panelGlowAlpha: this.#clamp01(uniqueEffects.panelGlowAlpha),
      imageGlowMin: this.#number(uniqueEffects.imageGlowMin),
      imageGlowMax: this.#number(uniqueEffects.imageGlowMax),
      imageGlowAlpha: this.#clamp01(uniqueEffects.imageGlowAlpha),
      backgroundAlphaMin: this.#clamp01(uniqueEffects.backgroundAlphaMin),
      backgroundAlphaMax: this.#clamp01(uniqueEffects.backgroundAlphaMax),
      strokeAlpha: this.#clamp01(uniqueEffects.strokeAlpha),
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

  #toCssColor(color) {
    return `rgb(${color.join(", ")})`;
  }

  #number(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  #clamp01(value) {
    return Math.max(0, Math.min(1, Number(value) || 0));
  }
}
