// Spec 163: the backpack card of a species' live bait stack has its own id, never an inventory item's instance id, so the
// inventory commands can tell it from an item without asking the live bait service.
const PREFIX = "live-stack:";

export class LiveBaitStackId {
  static of(speciesId) { return `${PREFIX}${speciesId}`; }

  // The species of a stack card id, or null for any other id.
  static speciesOf(id) {
    return typeof id === "string" && id.startsWith(PREFIX) && id.length > PREFIX.length ? id.slice(PREFIX.length) : null;
  }
}
