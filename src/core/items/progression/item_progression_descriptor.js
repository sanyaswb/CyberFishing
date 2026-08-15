class ItemProgressionDescriptor {
  constructor({
    available = true,
    reason = null,
    groupId,
    rating = null,
    ratingTier = null,
    quality = null,
    capacity = null,
  }) {
    this.available = Boolean(available);
    this.reason = reason;
    this.groupId = groupId || null;
    for (const [capabilityId, descriptor] of Object.entries({
      rating,
      ratingTier,
      quality,
      capacity,
    })) {
      if (descriptor !== null && descriptor !== undefined) {
        this[capabilityId] = descriptor;
      }
    }
    Object.freeze(this);
  }
}
