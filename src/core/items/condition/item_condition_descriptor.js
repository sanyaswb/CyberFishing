class ItemConditionDescriptor {
  constructor({
    available,
    reason = null,
    source = null,
    rawValue = null,
    current = null,
    minimum = null,
    maximum = null,
    normalized = null,
    percent = null,
    outOfRange = null,
  }) {
    this.available = Boolean(available);
    this.reason = reason;
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
