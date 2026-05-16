class ReelSystem {
  #config;

  constructor(config = {}) {
    this.#config = config || {};
  }

  recoverSlack({
    dtSec,
    lineSystem,
    reel,
    tensionKg,
    inputRecover = true,
  }) {
    if (this.#config.autoRecoverSlack === false) return 0;
    if (!lineSystem || !reel?.hasReel?.()) return 0;
    return lineSystem.recoverSlack({
      hasReel: true,
      inputRecover,
      reel,
      tensionKg,
      dtSec,
    });
  }
}
