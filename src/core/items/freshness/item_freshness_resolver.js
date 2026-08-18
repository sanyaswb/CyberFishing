class ItemFreshnessResolver extends ItemBoundedMetricResolver {
  #profileProvider;
  #decayPolicy;

  constructor({
    profileProvider,
    decayPolicy = new BaitFreshnessDecayPolicy(),
  } = {}) {
    super({
      capabilityId: "freshness",
      profileProvider,
      descriptorFactory: (values) => new ItemFreshnessDescriptor(values),
    });
    this.#profileProvider = profileProvider;
    this.#decayPolicy = decayPolicy;
  }

  resolve(item, capabilityConfig = undefined, context = {}) {
    const config = capabilityConfig === undefined
      ? this.#profileProvider(item)
      : capabilityConfig;
    const descriptor = super.resolve(item, config);
    if (!descriptor?.available) return descriptor;
    const exposureMs = Math.max(0, Number(context?.exposureMs) || 0);
    const current = this.#decayPolicy.resolve({
      percent: descriptor.current,
      exposureMs,
      lossPerMinute: config.lossPerMinute,
    });
    const normalized = (current - descriptor.minimum) /
      (descriptor.maximum - descriptor.minimum);
    return new ItemFreshnessDescriptor({
      capabilityId: descriptor.capabilityId,
      available: true,
      reason: null,
      metricLabel: descriptor.metricLabel,
      source: exposureMs > 0 ? "projected" : descriptor.source,
      rawValue: descriptor.rawValue,
      current,
      minimum: descriptor.minimum,
      maximum: descriptor.maximum,
      normalized,
      percent: normalized * 100,
      outOfRange: descriptor.outOfRange,
      lossPerMinute: Number(config.lossPerMinute),
      minimumMultiplier: Number(config.minimumMultiplier),
    });
  }
}

globalThis.ItemFreshnessResolver = ItemFreshnessResolver;
