export class ItemConditionDescriptor {
  constructor({
    capabilityId = "condition",
    available,
    reason = null,
    metricLabel = "Стан",
    source = null,
    rawValue = null,
    current = null,
    minimum = null,
    maximum = null,
    normalized = null,
    percent = null,
    outOfRange = null,
  }) {
    this.capabilityId = capabilityId;
    this.available = Boolean(available);
    this.reason = reason;
    this.metricLabel = metricLabel;
    this.source = source;
    this.rawValue = rawValue;
    this.current = current;
    this.minimum = minimum;
    this.maximum = maximum;
    this.normalized = normalized;
    this.percent = percent;
    this.outOfRange = outOfRange;
    Object.freeze(this);
  }
}
