import { FeederEntity } from "./feeder_entity.js";
import { FloatEntity } from "./float_entity.js";
import { JigEntity } from "./jig_entity.js";
import { SpinnerEntity } from "./spinner_entity.js";
import { WobblerEntity } from "./wobbler_entity.js";

export class BaitFactory {
  // The environmental compensation modifier keeps its default (undefined).
  static create(type, x, y, config, equipment, rng = null, debugEvents = null, devFlags = null, runtimeConfig = null) {
    switch (type) {
      case "spinner":
        return new SpinnerEntity(x, y, config, config.maxDepth, rng, debugEvents, undefined, devFlags, runtimeConfig);
      case "wobbler":
        return new WobblerEntity(x, y, config, config.maxDepth, rng, debugEvents, undefined, devFlags, runtimeConfig);
      case "jig":
        return new JigEntity(
          x,
          y,
          config,
          config.maxDepth,
          rng,
          debugEvents,
          undefined,
          devFlags,
          runtimeConfig,
        );
      case "feeder":
        return new FeederEntity(x, y, config, config.maxDepth, rng, debugEvents, undefined, devFlags, runtimeConfig);
      case "float":
      default:
        return new FloatEntity(x, y, config, config.maxDepth, rng, debugEvents, undefined, devFlags, runtimeConfig);
    }
  }
}
