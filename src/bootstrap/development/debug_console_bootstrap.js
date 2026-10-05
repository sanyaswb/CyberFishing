import { BiteSequenceLogPrinter, BiteTickLogPrinter, BiteTicksDebugModule } from "../../dev/modules/bite_ticks_debug_module.js";
import { CatchTimeDebugModule } from "../../dev/modules/catch_time_debug_module.js";
import { DebugConsole } from "../../dev/core/debug_console.js";
import { DebugContext } from "../../dev/core/debug_context.js";
import { DebugEventBinder } from "../../dev/core/debug_event_binder.js";
import { DebugModuleRegistry } from "../../dev/core/debug_module_registry.js";
import { DeviationsDebugModule } from "../../dev/modules/deviations_debug_module.js";
import { ExhaustionDebugModule } from "../../dev/modules/exhaustion_debug_module.js";
import { ForcesDebugModule } from "../../dev/modules/forces_debug_module.js";
import { LocationDebugDataProvider, LocationDebugPrinter } from "../../dev/location/location_debug_data_provider.js";
import { LocationDebugModule } from "../../dev/modules/location_debug_module.js";
import { MapDebugModule } from "../../dev/modules/map_debug_module.js";
import { NetDebugModule } from "../../dev/modules/net_debug_module.js";
import { PredictionDebugModule } from "../../dev/modules/prediction_debug_module.js";
import { ReelHoldGateDebugModule } from "../../dev/modules/reel_hold_gate_debug_module.js";
import { RodStrokeDebugModule } from "../../dev/modules/rod_stroke_debug_module.js";
import { StaminaDebugModule } from "../../dev/modules/stamina_debug_module.js";
import { TensionDebugModule } from "../../dev/modules/tension_debug_module.js";

export function createDebugConsoleRuntime({config, debugModulesSource, documentTarget, windowTarget, logger}) {
  const configSource = () => config;
  const registry = new DebugModuleRegistry();
  const context = new DebugContext();
  const locationProvider = new LocationDebugDataProvider({configSource});
  const locationPrinter = new LocationDebugPrinter({provider: locationProvider, configSource, viewportSource: () => windowTarget, logger});
  const moduleOptions = {configSource};
  [new BiteTicksDebugModule(moduleOptions), new LocationDebugModule({provider: locationProvider}),
    new MapDebugModule({printer: locationPrinter}), new ForcesDebugModule(moduleOptions), new DeviationsDebugModule(moduleOptions),
    new TensionDebugModule(moduleOptions), new RodStrokeDebugModule(moduleOptions), new ReelHoldGateDebugModule(moduleOptions),
    new StaminaDebugModule(moduleOptions), new ExhaustionDebugModule(moduleOptions), new CatchTimeDebugModule(moduleOptions),
    new PredictionDebugModule(moduleOptions), new NetDebugModule(moduleOptions)].forEach(module => registry.register(module));
  const debugConsole = new DebugConsole({context, registry, debugModulesSource});
  const biteTickLogger = new BiteTickLogPrinter({debugModulesSource});
  const biteSequenceLogger = new BiteSequenceLogPrinter({debugModulesSource});
  const binder = new DebugEventBinder({documentTarget, debugConsole, debugModulesSource, biteTickLogger, biteSequenceLogger}).bind();
  return {registry, context, debugConsole, binder, locationProvider, locationPrinter, biteTickLogger, biteSequenceLogger,
    dispose: () => binder.dispose()};
}
