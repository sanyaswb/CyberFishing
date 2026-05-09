class MutableFightFrameContext {
  constructor() {
    this.floatEntity = null;
    this.bounds = null;
    this.input = null;
    this.env = null;
    this.getRodVirtualPos = null;
    this.getScreenOffsetRatio = null;
    this.checkWater = null;
    this.net = null;
    this.fishData = null;
    this.projectorScale = 1;
    this.catchLineOffsetPx = 5;
  }

  reset() {
    this.floatEntity = null;
    this.bounds = null;
    this.input = null;
    this.env = null;
    this.net = null;
    this.fishData = null;
  }

  setInput(input) {
    this.input = input;
  }

  setBounds(bounds) {
    this.bounds = bounds;
  }

  setEnvironment(env) {
    this.env = env;
  }
}
