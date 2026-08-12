class ItemProgressionDescriptor {
  constructor({
    available = true,
    reason = null,
    groupId,
    rating,
    progressionLevel,
    quality,
    capacity,
  }) {
    this.available = available;
    this.reason = reason;
    this.groupId = groupId || null;
    this.rating = rating;
    this.progressionLevel = progressionLevel;
    this.quality = quality;
    this.capacity = capacity;
    Object.freeze(this);
  }
}
