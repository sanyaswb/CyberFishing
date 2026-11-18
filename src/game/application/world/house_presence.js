// Spec 179 D12 (TK-371): whether the player is in the house. The world keeps going (game time, weather, wind, the
// emission — GameApplication ticks it without drawing), while everything the location does to the player stops: the
// emission's screen effects, the keepnet's dose, the items' wear and the debuff «Радіація» (spec 181 Q5: the statuses'
// timers keep flowing). One flag, read by those systems through `isInHouse()`.
export class HousePresence {
  #inHouse = false;

  isInHouse() { return this.#inHouse; }

  enter() { this.#inHouse = true; }

  leave() { this.#inHouse = false; }
}
