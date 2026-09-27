class ItemConditionResolver extends ItemBoundedMetricResolver {
  // The presentation descriptor factory is injected by composition.
  constructor({ profileProvider, descriptorFactory } = {}) {
    super({
      capabilityId: "condition",
      profileProvider,
      descriptorFactory,
    });
  }
}
