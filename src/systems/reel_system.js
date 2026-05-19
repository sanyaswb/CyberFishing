class ReelSystem {
  #config;

  constructor(config = {}) {
    this.#config = config || {};
  }

  recoverLineCredit({
    dtSec,
    lineSystem,
    reel,
    tensionKg,
    inputRecover = true,
  }) {
    if (this.#config.autoRecoverSlack === false) return 0;
    if (!lineSystem || !reel?.hasReel?.()) return 0;
    const recover = lineSystem.recoverLineCredit || lineSystem.recoverSlack;
    return recover.call(lineSystem, {
      hasReel: true,
      inputRecover,
      reel,
      tensionKg,
      dtSec,
    });
  }

  recoverSlack(args) {
    // Deprecated compatibility alias. Reels recover pump credit / released line,
    // not physical loose line.
    return this.recoverLineCredit(args || {});
  }
}
