class MutableFightFrameContext {
  constructor() {
    this.floatEntity = null;
    this.bounds = null;
    this.input = null;
    this.env = null;
    this.getRodVirtualPos = null;
    this.getBaseRodVirtualPos = null;
    this.getScreenOffsetRatio = null;
    this.rodControlCastAnchor = null;
    this.checkWater = null;
    this.net = null;
    this.fishData = null;
  }

  reset() {
    this.floatEntity = null;
    this.bounds = null;
    this.input = null;
    this.env = null;
    this.net = null;
    this.fishData = null;
    this.rodControlCastAnchor = null;
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
