class RenderAllocationDiagnostics {
  static #enabled = false;
  static #frameCreations = 0;
  static #listRecordGrowth = 0;
  static #sectorPointBufferGrowth = 0;
  static #lineRadiusPointBufferGrowth = 0;
  static #renderPassCreations = 0;
  static #victoryLayoutCreations = 0;
  static #assetRequestCreations = 0;

  static enable() {
    RenderAllocationDiagnostics.#enabled = true;
  }

  static disable() {
    RenderAllocationDiagnostics.#enabled = false;
  }

  static isEnabled() {
    return RenderAllocationDiagnostics.#enabled;
  }

  static reset() {
    RenderAllocationDiagnostics.#frameCreations = 0;
    RenderAllocationDiagnostics.#listRecordGrowth = 0;
    RenderAllocationDiagnostics.#sectorPointBufferGrowth = 0;
    RenderAllocationDiagnostics.#lineRadiusPointBufferGrowth = 0;
    RenderAllocationDiagnostics.#renderPassCreations = 0;
    RenderAllocationDiagnostics.#victoryLayoutCreations = 0;
    RenderAllocationDiagnostics.#assetRequestCreations = 0;
  }

  static recordFrameCreated() {
    if (!RenderAllocationDiagnostics.#enabled) return;
    RenderAllocationDiagnostics.#frameCreations += 1;
  }

  static recordBufferGrowth(bufferId) {
    if (!RenderAllocationDiagnostics.#enabled) return;
    RenderAllocationDiagnostics.#listRecordGrowth += 1;
    if (bufferId === "sectorPoints") {
      RenderAllocationDiagnostics.#sectorPointBufferGrowth += 1;
    } else if (bufferId === "lineRadiusPoints") {
      RenderAllocationDiagnostics.#lineRadiusPointBufferGrowth += 1;
    }
  }

  static recordRenderPassCreated() {
    if (!RenderAllocationDiagnostics.#enabled) return;
    RenderAllocationDiagnostics.#renderPassCreations += 1;
  }

  static recordVictoryLayoutCreated() {
    if (!RenderAllocationDiagnostics.#enabled) return;
    RenderAllocationDiagnostics.#victoryLayoutCreations += 1;
  }

  static recordAssetRequestCreated() {
    if (!RenderAllocationDiagnostics.#enabled) return;
    RenderAllocationDiagnostics.#assetRequestCreations += 1;
  }

  static snapshot(target) {
    target.frameCreations = RenderAllocationDiagnostics.#frameCreations;
    target.listRecordGrowth = RenderAllocationDiagnostics.#listRecordGrowth;
    target.sectorPointBufferGrowth =
      RenderAllocationDiagnostics.#sectorPointBufferGrowth;
    target.lineRadiusPointBufferGrowth =
      RenderAllocationDiagnostics.#lineRadiusPointBufferGrowth;
    target.renderPassCreations = RenderAllocationDiagnostics.#renderPassCreations;
    target.victoryLayoutCreations =
      RenderAllocationDiagnostics.#victoryLayoutCreations;
    target.assetRequestCreations =
      RenderAllocationDiagnostics.#assetRequestCreations;
    return target;
  }
}
