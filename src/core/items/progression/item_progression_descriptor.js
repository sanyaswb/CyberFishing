class ItemProgressionDescriptor {
  constructor({
    available = true,
    reason = null,
    groupId,
    power,
    level,
    quality,
    capacity,
  }) {
    this.available = available;
    this.reason = reason;
    this.groupId = groupId || null;
    this.power = power;
    this.level = level;
    this.quality = quality;
    this.capacity = capacity;
    Object.freeze(this);
  }
}
