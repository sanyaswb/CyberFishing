import { RetroRack } from "./retro_rack.js";
import { VinylRack } from "./vinyl_rack.js";
import { WalkieTalkieRack } from "./walkie_talkie_rack.js";

// TK-097, TK-124: the radio's sound effects between the stream player's input and output:
// input -> retro -> vinyl -> walkie-talkie -> output.
// Each stage passes the sound dry while it is disabled, so any combination can be on.
// update() applies CONFIG.radio.effects live (the player calls it about once a second);
// the player never decides the sound, only the configuration does.
export class RadioEffectsChain {
  #config;
  #retro;
  #vinyl;
  #walkieTalkie;
  #attached = false;

  // config: () => CONFIG.radio.effects; rng: the radio's own { next() }.
  constructor({ config, rng, fetchRef = null }) {
    this.#config = config;
    this.#retro = new RetroRack();
    this.#vinyl = new VinylRack({ rng, fetchRef });
    this.#walkieTalkie = new WalkieTalkieRack();
  }

  attach(context, input, output) {
    this.#retro.build(context);
    this.#vinyl.build(context);
    this.#walkieTalkie.build(context);
    input.connect(this.#retro.input);
    this.#retro.output.connect(this.#vinyl.input);
    this.#vinyl.output.connect(this.#walkieTalkie.input);
    this.#walkieTalkie.output.connect(output);
    this.#attached = true;
    this.update();
  }

  update() {
    if (!this.#attached) return;
    const cfg = this.#config() || {};
    this.#retro.update(cfg.retro || {}, cfg.rampSeconds);
    this.#vinyl.update(cfg.vinyl || {}, cfg.rampSeconds);
    this.#walkieTalkie.update(cfg.walkieTalkie || {}, cfg.rampSeconds);
  }

  cueVinyl() {
    this.#vinyl.cueTonearm();
  }

  dispose() {
    this.#retro.dispose();
    this.#vinyl.dispose();
    this.#walkieTalkie.dispose();
    this.#attached = false;
  }
}
