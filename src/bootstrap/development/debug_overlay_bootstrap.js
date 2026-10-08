import { BehaviorOverlayModule } from "../../dev/overlay/modules/behavior_overlay_module.js";
import { ChancesDetailOverlayModule } from "../../dev/overlay/modules/chances_detail_overlay_module.js";
import { ChumOverlayModule } from "../../dev/overlay/modules/chum_overlay_module.js";
import { DebuffsOverlayModule } from "../../dev/overlay/modules/debuffs_overlay_module.js";
import { EchoOverlayModule } from "../../dev/overlay/modules/echo_overlay_module.js";
import { FightAutoRecoverySection } from "../../dev/overlay/fight_physics/fight_auto_recovery_section.js";
import { FightDragSection } from "../../dev/overlay/fight_physics/fight_drag_section.js";
import { FightFishSection } from "../../dev/overlay/fight_physics/fight_fish_section.js";
import { FightLineSection } from "../../dev/overlay/fight_physics/fight_line_section.js";
import { FightMovementSection } from "../../dev/overlay/fight_physics/fight_movement_section.js";
import { FightPhysicsOverlayModule } from "../../dev/overlay/modules/fight_physics/fight_physics_overlay_module.js";
import { FightReelHoldSection } from "../../dev/overlay/fight_physics/fight_reel_hold_section.js";
import { FightRodControlForceSection } from "../../dev/overlay/fight_physics/fight_rod_control_force_section.js";
import { FightRodControlGeometrySection } from "../../dev/overlay/fight_physics/fight_rod_control_geometry_section.js";
import { FightRodControlInputSection } from "../../dev/overlay/fight_physics/fight_rod_control_input_section.js";
import { FightRodControlSection } from "../../dev/overlay/fight_physics/fight_rod_control_section.js";
import { FightRodControlVisualSection } from "../../dev/overlay/fight_physics/fight_rod_control_visual_section.js";
import { FightRodHoldSection } from "../../dev/overlay/fight_physics/fight_rod_hold_section.js";
import { FightRodStrokeSection } from "../../dev/overlay/fight_physics/fight_rod_stroke_section.js";
import { FightSummaryOverlayModule } from "../../dev/overlay/fight_summary/fight_summary_overlay_module.js";
import { FightTensionSection } from "../../dev/overlay/fight_physics/fight_tension_section.js";
import { FishBalanceOverlayModule } from "../../dev/overlay/modules/fish_balance_overlay_module.js";
import { FishCurrentForceOverlayModule } from "../../dev/overlay/fish_balance/fish_current_force_overlay_module.js";
import { FishDebuffsSummaryOverlayModule } from "../../dev/overlay/fish_balance/fish_debuffs_summary_overlay_module.js";
import { FishLiveForceSummarySection } from "../../dev/overlay/fish_balance/fish_live_force_summary_section.js";
import { FishMovementSummaryOverlayModule } from "../../dev/overlay/fight_summary/fish_movement_summary_overlay_module.js";
import { FishPowerOverlayModule } from "../../dev/overlay/modules/fish_power_overlay_module.js";
import { FishStateForcePreviewSection } from "../../dev/overlay/fish_balance/fish_state_force_preview_section.js";
import { FishSummaryOverlayModule } from "../../dev/overlay/fish_balance/fish_summary_overlay_module.js";
import { LineAndDragSummaryOverlayModule } from "../../dev/overlay/fight_summary/line_and_drag_summary_overlay_module.js";
import { LiveForcesOverlayModule } from "../../dev/overlay/modules/live_forces_overlay_module.js";
import { OverlayConsoleMetricInspector } from "../../dev/overlay/overlay_console_metric_inspector.js";
import { OverlayController } from "../../dev/overlay/core/overlay_controller.js";
import { OverlayDomAdapter } from "../../dev/overlay/dom/overlay_dom_adapter.js";
import { OverlayHtmlBuilder } from "../../dev/overlay/services/overlay_html_builder.js";
import { OverlayInteractionBridge } from "../../dev/overlay/dom/overlay_interaction_bridge.js";
import { OverlayMetricCatalog } from "../../dev/overlay/services/overlay_metric_catalog.js";
import { OverlayMetricInfoBridge } from "../../dev/overlay/dom/overlay_metric_info_bridge.js";
import { OverlayMetricResolver } from "../../dev/overlay/overlay_metric_resolver.js";
import { OverlayModuleRegistry } from "../../dev/overlay/core/overlay_module_registry.js";
import { OverlayScaleControls } from "../../dev/overlay/dom/overlay_scale_controls.js";
import { OverlayUpdateLoop } from "../../dev/overlay/core/overlay_update_loop.js";
import { OverlayValueFormatter } from "../../dev/overlay/services/overlay_value_formatter.js";
import { OverlayViewStateStore } from "../../dev/overlay/services/overlay_view_state_store.js";
import { OverlayWindowDragController } from "../../dev/overlay/dom/overlay_window_drag_controller.js";
import { PlayerMaxOverlayModule } from "../../dev/overlay/modules/player_max_overlay_module.js";
import { RodControlSummaryOverlayModule } from "../../dev/overlay/fight_summary/rod_control_summary_overlay_module.js";
import { StaminaBalanceOverlayModule } from "../../dev/overlay/modules/stamina_balance_overlay_module.js";
import { WorstCaseForceDebugSelector } from "../../dev/fishing/worst_case_force_debug_selector.js";
import { WorstCaseOverlayModule } from "../../dev/overlay/modules/worst_case_overlay_module.js";

export function createDebugOverlayRuntime({config, baseConfig, settingsStore, documentTarget, windowTarget}) {
  const configSource = () => config;
  const htmlBuilder = new OverlayHtmlBuilder();
  const formatter = new OverlayValueFormatter();
  const viewStateStore = new OverlayViewStateStore({fishStatesDirectionMode: "away",
    fishStateForceDetails: {active: false, force: false, speed: false, weight: false}});
  const moduleOptions = {settingsStore, htmlBuilder, formatter, viewStateStore, configSource};
  const sectionOptions = {settingsStore, htmlBuilder, formatter};
  const rodSections = [
        new FightRodControlInputSection(sectionOptions),
        new FightRodControlForceSection(sectionOptions),
        new FightRodControlGeometrySection(sectionOptions),
        new FightRodControlVisualSection(sectionOptions),
      ];
  const rodControlSection = new FightRodControlSection({...sectionOptions, sections: rodSections});
  const groups = [
        {
          key: "fightCore",
          title: "CORE",
          sections: [
            new FightFishSection(sectionOptions),
            new FightMovementSection(sectionOptions),
          ],
        },
        {
          key: "fightPlayerForce",
          title: "PLAYER FORCE",
          sections: [
            new FightRodHoldSection(sectionOptions),
            new FightReelHoldSection(sectionOptions),
            new FightAutoRecoverySection(sectionOptions),
          ],
        },
        {
          key: "fightLineDrag",
          title: "LINE & DRAG",
          sections: [
            new FightLineSection(sectionOptions),
            new FightDragSection(sectionOptions),
          ],
        },
        {
          key: "fightRodControl",
          title: "ROD CONTROL",
          sections: [rodControlSection],
        },
        {
          key: "fightStress",
          title: "STRESS",
          sections: [new FightTensionSection(sectionOptions)],
        },
        {
          key: "fightStroke",
          title: "STROKE",
          sections: [new FightRodStrokeSection(sectionOptions)],
        },
      ];
  const registry = new OverlayModuleRegistry();
  registry.registerMany([
    new EchoOverlayModule(moduleOptions), new ChancesDetailOverlayModule(moduleOptions), new BehaviorOverlayModule(moduleOptions),
    new FishBalanceOverlayModule({...moduleOptions, liveForceSection: new FishLiveForceSummarySection(moduleOptions),
      forcePreviewSection: new FishStateForcePreviewSection(moduleOptions)}),
    new FishSummaryOverlayModule(moduleOptions), new FishCurrentForceOverlayModule(moduleOptions), new FishDebuffsSummaryOverlayModule(moduleOptions),
    new FightSummaryOverlayModule(moduleOptions), new LineAndDragSummaryOverlayModule(moduleOptions),
    new RodControlSummaryOverlayModule(moduleOptions), new FishMovementSummaryOverlayModule(moduleOptions),
    new FishPowerOverlayModule(moduleOptions), new DebuffsOverlayModule(moduleOptions), new FightPhysicsOverlayModule({...moduleOptions, groups}),
    new PlayerMaxOverlayModule(moduleOptions), new LiveForcesOverlayModule(moduleOptions), new ChumOverlayModule(moduleOptions),
    new StaminaBalanceOverlayModule(moduleOptions), new WorstCaseOverlayModule({...moduleOptions, selector: new WorstCaseForceDebugSelector({configSource})})]);
  const domAdapter = new OverlayDomAdapter({documentTarget,
    createScaleControls: options => new OverlayScaleControls(options),
    createDragController: element => new OverlayWindowDragController({element, config, id: "debug_overlay", windowTarget})});
  const interactionBridge = new OverlayInteractionBridge({rootElementProvider: () => domAdapter.getRootElement(), viewStateStore});
  let controller;
  const updateLoop = new OverlayUpdateLoop({callback: () => controller.update(), intervalMs: Number(configSource()?.debug?.overlayUpdateMs) || 150});
  controller = new OverlayController({registry, domAdapter, documentTarget, configSource, updateLoop, viewStateStore, interactionBridge});
  controller.start();
  const metricInfoBridge = new OverlayMetricInfoBridge({documentTarget, catalog: new OverlayMetricCatalog(),
    inspector: new OverlayConsoleMetricInspector({resolver: new OverlayMetricResolver({baseConfig, configSource})})});
  metricInfoBridge.start();
  let disposed = false;
  return {settingsStore, viewStateStore, registry, controller, metricInfoBridge, dispose() {
    if (disposed) return;
    disposed = true;
    metricInfoBridge.dispose();
    controller.dispose();
  }};
}
