import { FISHING_MESSAGES } from "../../game/presentation/fishing/fishing_messages.js";
import { CastService } from "../../game/application/fishing/cast_service.js";
import { CatchResolutionService } from "../../game/application/fishing/catch_resolution_service.js";
import { FightService } from "../../game/application/fishing/fight_service.js";
import { FightSessionFactory } from "../../game/application/fishing/fight_session_factory.js";

// Composes the DOM-free casting and fight services. GameCompositionRoot and the game-cycle check call this same
// function, so the behavior reference runs the production composition; hosts differ only in the injected ports
// (clocks, loggers, the DEV fight diagnostics builder).
export function composeFishingServices({
  config,
  rng,
  clock,
  stepClock,
  devFlags,
  runtimeConfig,
  equipmentRules,
  baitRules,
  castDistanceCalculator,
  getRodVirtualPos,
  getDynamicBounds,
  getWaterMetric,
  castReadinessEvaluator = null,
  debugEvents = null,
  fightLogger = null,
  catchResolutionLogger = null,
  isCatchResolutionLogEnabled = null,
  fightDiagnosticsBuilder = null,
}) {
  const castService = new CastService({
    messages: FISHING_MESSAGES,
    config,
    rng,
    clock,
    equipmentRules,
    baitRules,
    getRodVirtualPos,
    getDynamicBounds,
    getWaterMetric,
    debugEvents,
    devFlags,
    runtimeConfig,
    castReadinessEvaluator,
  });

  const fightService = new FightService({
    config,
    rng,
    devFlags,
    catchResolver: new CatchResolutionService({
      logger: catchResolutionLogger,
      isLogEnabled: isCatchResolutionLogEnabled,
    }),
    fightSessionFactory: new FightSessionFactory({
      config,
      rng,
      devFlags,
      runtimeConfig,
      castDistanceCalculator,
      logger: fightLogger,
      stepClock,
      fightDiagnosticsBuilder,
    }),
  });

  return { castService, fightService };
}
