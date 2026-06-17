class OutcomeRenderPass extends RenderPass {
  #gameOverRenderer;
  #victoryRenderer;

  constructor({ gameOverRenderer, victoryRenderer }) {
    super();
    if (!gameOverRenderer || typeof gameOverRenderer.render !== "function") {
      throw new TypeError("OutcomeRenderPass requires gameOverRenderer");
    }
    if (!victoryRenderer || typeof victoryRenderer.render !== "function") {
      throw new TypeError("OutcomeRenderPass requires victoryRenderer");
    }
    this.#gameOverRenderer = gameOverRenderer;
    this.#victoryRenderer = victoryRenderer;
  }

  render(frame) {
    if (!frame.outcome.visible) return;
    if (frame.outcome.mode === "failed") {
      this.#gameOverRenderer.render(frame.outcome.gameOver);
      return;
    }
    if (frame.outcome.mode === "victory") {
      this.#victoryRenderer.render(frame.outcome.victory);
    }
  }
}
