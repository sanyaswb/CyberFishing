import { FightPhysicsPipelineFrame } from "./fight_physics_pipeline_frame.js";

/**
 * Explicit orchestration map for one fight-physics frame.
 *
 * The class deliberately does not own domain calculations. It documents and
 * records the frame order so FightPhysicsOrchestrator remains an orchestrator over
 * smaller systems/calculators instead of a hidden god object.
 */
export class FightPhysicsPipeline {
  static STEPS = Object.freeze([
    "read_runtime_config",
    "resolve_rod_control_target_anchor",
    "resolve_delta_time",
    "compose_fight_input_actions",
    "read_input",
    "update_fish_motion",
    "resolve_player_force_budget",
    "resolve_player_pressure_gain",
    "resolve_player_tension_build_rate",
    "resolve_player_pressure_fatigue_application",
    "resolve_drag_context",
    "resolve_rod_pull_and_retrieve",
    "resolve_rod_control_x",
    "preview_tension",
    "update_rod_stroke_distance",
    "recover_line",
    "update_player_reel_fatigue_session",
    "resolve_player_pressure_fatigue_source",
    "update_player_pressure_fatigue",
    "resolve_line_constraint",
    "inspect_pole_fight_sector",
    "update_final_tension",
    "resolve_landing_frame",
    "resolve_stamina_frame",
    "write_debug_snapshot",
  ]);

  #now;

  // now: the injected high-resolution clock (platform); without it a frame reads Date.now().
  constructor({ now = null } = {}) {
    this.#now = now;
  }

  startFrame() {
    return new FightPhysicsPipelineFrame(FightPhysicsPipeline.STEPS, this.#now);
  }
}
