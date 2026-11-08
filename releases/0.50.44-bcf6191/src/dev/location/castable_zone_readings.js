import { FishBehavior } from "../../game/domain/fish/fish_behavior.js";
import { FishPhysicsProfile } from "../../game/domain/fish/fish_physics_profile.js";
import { LandingPolicyResolver } from "../../game/domain/fishing/landing_policy_resolver.js";
import { Net } from "../../game/domain/tackle/net.js";

// CurrentLocation's hand chum distance when the location authors none (base pixels).
const DEFAULT_CHUM_CAST_DISTANCE = 300;

// Spec 136: the real values the castable area's dependent zones are drawn from, read through the game's own rules and
// classes; nothing here changes an item, fish or physics value for display. Distances are base pixels from the shore
// line (the castable zones' bottom edge) or metres, as the game uses them; null when there is nothing to show.
export class CastableZoneReadings {
  #config; #getEquipment; #nets; #fishes;
  #landing = new LandingPolicyResolver();

  // getEquipment(): the equipped items; nets: the item catalog's nets; fishes: FISH_DB. The editor's own line length and
  // net choice apply unless it takes the values from the equipment (TK-069).
  constructor({ config, getEquipment, nets = {}, fishes = [] }) {
    this.#config = config; this.#getEquipment = getEquipment; this.#nets = nets; this.#fishes = fishes;
  }

  // [id, name] of every catalog net and fish, for the editor's selects.
  get nets() {
    return Object.values(this.#nets).map(item => [item.id, item.name || item.id]);
  }

  get fishes() {
    return this.#fishes.map(fish => [fish.id, fish.name || fish.id]);
  }

  get pixelsPerMeter() {
    return this.#config.fightPhysicsConfig?.getPixelsPerMeter?.() || 50;
  }

  // Hand chum is a location setting: shown with or without hand chum equipped (owner, R-Q1).
  handChumPx(locationId) {
    return Number(this.#config.locations.map[locationId]?.chumCastDistance) || DEFAULT_CHUM_CAST_DISTANCE;
  }

  // A catalog net's reach with its base stats, converted as the game's Net does.
  netPx(netId) {
    const item = this.#nets[netId];
    if (!item) return null;
    const net = new Net(item.gameplayStats || item, this.#config.fightPhysicsConfig?.getDistanceConfig?.() || {});
    return net.getReachPixels();
  }

  // TK-069: the equipped net's reach (its effective stats, as the game's Net gets them), or null without a net.
  equippedNetPx() {
    const net = this.#getEquipment?.()?.net;
    if (!net) return null;
    return new Net(net.effectiveStats || net, this.#config.fightPhysicsConfig?.getDistanceConfig?.() || {}).getReachPixels();
  }

  // TK-069: the equipped line's length in metres, or null without a line.
  equippedLineMeters() {
    const length = Number(this.#getEquipment?.()?.line?.effectiveStats?.lengthMeters);
    return Number.isFinite(length) && length > 0 ? length : null;
  }

  // The landing policy of the equipped rod and reel.
  landingMeters() {
    const equipment = this.#getEquipment?.();
    if (!equipment?.rod) return null;
    const context = { rod: equipment.rod, reel: equipment.reel };
    const distance = this.#landing.resolve(context).getLandingDistanceMeters({ ...context, config: this.#config });
    return Number.isFinite(distance) && distance > 0 ? distance : null;
  }

  // The chosen fish's last-dash trigger distance (its physics profile, the equipped landing distance); null when the
  // fish has no enabled trigger.
  lastDashMeters(fishId) {
    const fish = this.#fishes.find(entry => entry.id === fishId);
    if (!fish) return null;
    const trigger = FishPhysicsProfile.toRuntimeConfig(fish.physics || {}).lastDashTrigger;
    if (trigger?.enabled !== true) return null;
    const distance = FishBehavior.lastDashTriggerDistanceMeters(trigger, this.landingMeters() || 0);
    return distance > 0 ? distance : null;
  }
}
