class ItemFreshnessResolver extends ItemBoundedMetricResolver {
  constructor({ profileProvider } = {}) {
    super({
      capabilityId: "freshness",
      profileProvider,
      descriptorFactory: (values) => new ItemFreshnessDescriptor(values),
    });
  }
}

globalThis.ItemFreshnessResolver = ItemFreshnessResolver;
