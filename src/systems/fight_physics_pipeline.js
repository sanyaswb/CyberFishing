/**
 * Explicit orchestration map for one fight-physics frame.
 *
 * The class deliberately does not own domain calculations. It documents and
 * records the frame order so FightPhysicsSystem remains an orchestrator over
 * smaller systems/calculators instead of a hidden god object.
 */
class FightPhysicsPipeline {
  static STEPS = Object.freeze([
    "read_runtime_config",
    "resolve_rod_control_target_anchor",
    "resolve_delta_time",
    "compose_fight_input_actions",
    "read_input",
    "update_fish_motion",
    "resolve_player_force_budget",
    "resolve_player_pressure_fatigue_application",
    "resolve_drag_context",
    "resolve_rod_pull_and_retrieve",
    "resolve_rod_control_x",
    "update_player_pressure_fatigue",
    "preview_tension",
    "recover_line",
    "resolve_line_constraint",
    "inspect_pole_fight_sector",
    "update_rod_stroke_distance",
    "update_final_tension",
    "resolve_landing_frame",
    "resolve_stamina_frame",
    "write_debug_snapshot",
  ]);

  startFrame() {
    return new FightPhysicsPipelineFrame(FightPhysicsPipeline.STEPS);
  }
}

class FightPhysicsPipelineFrame {
  #steps;
  #nextIndex = 0;
  #completed = [];

  constructor(steps) {
    this.#steps = Array.isArray(steps) ? steps.slice() : [];
  }

  run(stepName, operation) {
    this.#assertKnownStep(stepName);
    this.#assertOrder(stepName);
    const startedAt =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    const result = typeof operation === "function" ? operation() : undefined;
    const finishedAt =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    this.#completed.push({
      step: stepName,
      durationMs: Math.max(0, finishedAt - startedAt),
    });
    this.#nextIndex += 1;
    return result;
  }

  toDebugData() {
    return this.#completed.map((entry) => ({ ...entry }));
  }

  #assertKnownStep(stepName) {
    if (!this.#steps.includes(stepName)) {
      throw new Error(`Unknown fight physics pipeline step: ${stepName}`);
    }
  }

  #assertOrder(stepName) {
    const expected = this.#steps[this.#nextIndex];
    if (expected !== stepName) {
      throw new Error(
        `Fight physics pipeline order mismatch: expected ${expected}, got ${stepName}`,
      );
    }
  }
}
