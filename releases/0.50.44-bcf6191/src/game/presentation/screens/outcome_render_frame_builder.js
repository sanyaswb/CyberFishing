// The game-over panel's frame model. The victory window is DOM (spec 161) and takes no part in the render frame.
export class OutcomeRenderFrameBuilder {
  #canvasMetrics;

  constructor({ canvasMetrics }) {
    this.#canvasMetrics = canvasMetrics;
  }

  buildInto({ target, intent }) {
    if (!intent.visible) return;
    target.visible = true;
    target.mode = intent.mode;
    if (intent.mode === "failed") this.#buildGameOver(target.gameOver, intent.reason);
  }

  #buildGameOver(target, reason) {
    let title = "LINE SNAPPED";
    let titleColor = "#ff4444";
    let description = "Tension exceeded line capacity.";
    if (reason === "rod") {
      title = "ROD BROKEN";
      titleColor = "#ff0000";
      description = "Your rod could not handle the stress.";
    } else if (reason === "reel") {
      title = "REEL FAILED";
      titleColor = "#ff2200";
      description = "The reel was the weakest part of the rig.";
    } else if (reason === "leader") {
      title = "LEADER SNAPPED";
      titleColor = "#ff6644";
      description = "The leader was the weakest part of the rig.";
    } else if (reason === "hook" || reason === "net_escape") {
      title = "FISH ESCAPED";
      titleColor = "#ffaa00";
      description =
        reason === "net_escape"
          ? "The fish was too heavy and broke out of the net!"
          : "The hook bent and the fish got away.";
    }
    target.visible = true;
    target.width = this.#canvasMetrics.width;
    target.height = this.#canvasMetrics.height;
    target.title = title;
    target.titleColor = titleColor;
    target.description = description;
  }
}
