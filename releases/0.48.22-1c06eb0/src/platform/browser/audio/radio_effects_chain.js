import { VinylRack } from "./vinyl_rack.js";
import { WalkieTalkieRack } from "./walkie_talkie_rack.js";

// TK-097: the radio's sound effects between the stream player's input and output: input -> vinyl -> walkie-talkie ->
// output. Each stage passes the sound dry while it is disabled, so both, one or none can be on: a record heard over a
// walkie-talkie when both are. update() applies CONFIG.radio.effects live (the player calls it about once a second);
// the player never decides the sound, only the configuration does (DevTools, owner: no player control in production).
export class RadioEffectsChain {
  #config;
  #vinyl;
  #walkieTalkie;
  #attached = false;

  // config: () => CONFIG.radio.effects; rng: the radio's own { next() }.
  constructor({ config, rng }) {
    this.#config = config;
    this.#vinyl = new VinylRack({ rng });
    this.#walkieTalkie = new WalkieTalkieRack();
  }

  attach(context, input, output) {
    this.#vinyl.build(context);
    this.#walkieTalkie.build(context);
    input.connect(this.#vinyl.input);
    this.#vinyl.output.connect(this.#walkieTalkie.input);
    this.#walkieTalkie.output.connect(output);
    this.#attached = true;
    this.update();
  }

  update() {
    if (!this.#attached) return;
    const cfg = this.#config() || {};
    this.#vinyl.update(cfg.vinyl || {}, cfg.rampSeconds);
    this.#walkieTalkie.update(cfg.walkieTalkie || {}, cfg.rampSeconds);
  }

  dispose() {
    this.#vinyl.dispose();
    this.#walkieTalkie.dispose();
    this.#attached = false;
  }
}
