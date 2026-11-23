import { RenderPass } from "../../../engine/rendering/render_pass.js";

// The game-over panel on the HUD canvas. The victory window is DOM (spec 161): this pass draws nothing for it.
export class OutcomeRenderPass extends RenderPass {
  #gameOverRenderer;

  constructor({ gameOverRenderer }) {
    super();
    if (!gameOverRenderer || typeof gameOverRenderer.render !== "function") {
      throw new TypeError("OutcomeRenderPass requires gameOverRenderer");
    }
    this.#gameOverRenderer = gameOverRenderer;
  }

  render(frame) {
    if (!frame.outcome.visible || frame.outcome.mode !== "failed") return;
    this.#gameOverRenderer.render(frame.outcome.gameOver);
  }
}
