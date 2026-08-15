class ItemConditionResolver extends ItemBoundedMetricResolver {
  constructor({ profileProvider } = {}) {
    super({
      capabilityId: "condition",
      profileProvider,
      descriptorFactory: (values) => new ItemConditionDescriptor(values),
    });
  }
}
