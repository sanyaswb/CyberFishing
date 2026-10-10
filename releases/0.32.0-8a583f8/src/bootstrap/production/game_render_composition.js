import { BoatChumRenderer } from "../../game/presentation/world/boat_chum_renderer.js";
import { BoatChumRenderFrameBuilder } from "../../game/presentation/rendering/boat_chum_render_frame_builder.js";
import { CastingRenderFrameBuilder } from "../../game/presentation/rendering/casting_render_frame_builder.js";
import { CastingRenderPass } from "../../game/presentation/rendering/casting_render_pass.js";
import { CastSceneRenderer } from "../../game/presentation/casting/cast_scene_renderer.js";
import { FightAreaRenderer } from "../../game/presentation/fishing/fight_area_renderer.js";
import { FightAreaRenderFrameBuilder } from "../../game/presentation/rendering/fight_area_render_frame_builder.js";
import { FightHudFrameBuilder } from "../../game/presentation/hud/fight_hud_frame_builder.js";
import { FightHudRenderer } from "../../game/presentation/hud/fight_hud_renderer.js";
import { FightStatusBarsRenderer } from "../../game/presentation/hud/fight_status_bars_renderer.js";
import { FishingEquipmentRenderModelBuilder } from "../../game/presentation/fishing/fishing_equipment_render_model_builder.js";
import { FishingRenderFrameBuilder } from "../../game/presentation/rendering/fishing_render_frame_builder.js";
import { FishingRenderPass } from "../../game/presentation/rendering/fishing_render_pass.js";
import { FishingSceneRenderer } from "../../game/presentation/fishing/fishing_scene_renderer.js";
import { FloatRenderer } from "../../game/presentation/fishing/float_renderer.js";
import { GameOverRenderer } from "../../game/presentation/screens/game_over_renderer.js";
import { GameRenderCoordinator } from "../../game/presentation/rendering/game_render_coordinator.js";
import { GameRenderFrameBuilder } from "../../game/presentation/rendering/game_render_frame_builder.js";
import { GameRenderPipeline } from "../../game/presentation/rendering/game_render_pipeline.js";
import { HoldChargesRenderer } from "../../game/presentation/hud/hold_charges_renderer.js";
import { HudBarRenderer } from "../../game/presentation/hud/hud_bar_renderer.js";
import { HudRenderPass } from "../../game/presentation/rendering/hud_render_pass.js";
import { ImageAssetProvider } from "../../platform/browser/assets/image_asset_provider.js";
import { LandingAreaRenderFrameBuilder } from "../../game/presentation/rendering/landing_area_render_frame_builder.js";
import { LandingPolicyResolver } from "../../game/domain/fishing/landing_policy_resolver.js";
import { LineVisualStateController } from "../../game/presentation/fishing/line_visual_state_controller.js";
import { OutcomeRenderFrameBuilder } from "../../game/presentation/screens/outcome_render_frame_builder.js";
import { OutcomeRenderPass } from "../../game/presentation/rendering/outcome_render_pass.js";
import { PlayerPressureFatigueIndicatorRenderer } from "../../game/presentation/hud/player_pressure_fatigue_indicator_renderer.js";
import { PoleFightSectorGeometry } from "../../game/domain/fishing/pole_fight_sector_geometry.js";
import { RenderComponent } from "../../engine/rendering/render_component.js";
import { RenderFrameBuffer } from "../../game/presentation/rendering/render_frame_buffer.js";
import { GameRenderOrder } from "../../game/presentation/rendering/game_render_order.js";
import { RodLineRenderer } from "../../game/presentation/fishing/rod_line_renderer.js";
import { StarRatingRenderer } from "../../game/presentation/screens/star_rating_renderer.js";
import { VictoryRenderer } from "../../game/presentation/screens/victory_renderer.js";
import { VictoryThemeResolver } from "../../game/presentation/screens/victory_theme_resolver.js";
import { WorldRenderFrameBuilder } from "../../game/presentation/rendering/world_render_frame_builder.js";
import { WorldRenderPass } from "../../game/presentation/rendering/world_render_pass.js";
import { WorldSceneRenderer } from "../../game/presentation/world/world_scene_renderer.js";

// Composes the render pipeline, the render frame builders and the render coordinator for GameCompositionRoot.
// The DEV world debug renderer and location debug frame builder are optional factories from Development startup.
export class GameRenderComposition {
  #readRenderDiagnostics;
  #createOptionalDiagnostic;
  #createWorldDebugRenderer;
  #createLocationDebugRenderFrameBuilder;

  constructor({
    readRenderDiagnostics,
    createOptionalDiagnostic,
    createWorldDebugRenderer,
    createLocationDebugRenderFrameBuilder,
  }) {
    this.#readRenderDiagnostics = readRenderDiagnostics;
    this.#createOptionalDiagnostic = createOptionalDiagnostic;
    this.#createWorldDebugRenderer = createWorldDebugRenderer;
    this.#createLocationDebugRenderFrameBuilder = createLocationDebugRenderFrameBuilder;
  }

  // Renderers and the ordered render pipeline (world, casting, fishing, HUD, outcome).
  composePipeline({
    surface, imageAssets, primitives, hudStyleResolver, fightAreaStyleResolver, contracts,
    rarityVisualResolver,
  }) {
    const hudBarRenderer = new HudBarRenderer(surface);
    const worldSceneRenderer = new WorldSceneRenderer({
      surface,
      assets: imageAssets,
    });
    const worldDebugRenderer = this.#createOptionalDiagnostic(
      this.#createWorldDebugRenderer, "worldDebugRenderer", [{ surface }], ["render"],
    );
    const boatChumRenderer = new BoatChumRenderer({
      surface,
      primitives,
    });
    const castSceneRenderer = new CastSceneRenderer({
      surface,
      primitives,
      hudBarRenderer,
      hudStyleResolver,
    });
    const fightAreaRenderer = new FightAreaRenderer({
      surface,
      primitives,
      styleResolver: fightAreaStyleResolver,
    });
    const rodLineRenderer = new RodLineRenderer({ surface });
    const floatRenderer = new FloatRenderer({ surface });
    const fishingSceneRenderer = new FishingSceneRenderer({
      components: [
        new RenderComponent({
          id: "fight-area",
          order: GameRenderOrder.values.FIGHT_AREAS,
          renderer: fightAreaRenderer,
          selectModel: (model) => model.fightAreas,
        }),
        new RenderComponent({
          id: "rod-line",
          order: GameRenderOrder.values.FISHING_EQUIPMENT,
          renderer: rodLineRenderer,
          selectModel: (model) => model.rodLine,
        }),
        new RenderComponent({
          id: "float",
          order: GameRenderOrder.values.FISHING_EQUIPMENT + 1,
          renderer: floatRenderer,
          selectModel: (model) => model.float,
        }),
      ],
    });
    const statusBarsRenderer = new FightStatusBarsRenderer({
      surface,
      hudBarRenderer,
      styleResolver: hudStyleResolver,
    });
    const holdChargesRenderer = new HoldChargesRenderer({ surface });
    const playerPressureFatigueIndicatorRenderer =
      new PlayerPressureFatigueIndicatorRenderer({ surface });
    const fightHudRenderer = new FightHudRenderer({
      components: [
        new RenderComponent({
          id: "status-bars",
          order: GameRenderOrder.values.HUD,
          renderer: statusBarsRenderer,
          selectModel: (model) => model,
        }),
        new RenderComponent({
          id: "hold-charges",
          order: GameRenderOrder.values.HUD + 1,
          renderer: holdChargesRenderer,
          selectModel: (model) => model.holdCharges,
        }),
        new RenderComponent({
          id: "player-pressure-fatigue",
          order: GameRenderOrder.values.HUD + 2,
          renderer: playerPressureFatigueIndicatorRenderer,
          selectModel: (model) => model.playerPressureFatigue,
        }),
      ],
    });
    const invalidCastMarkerRenderer = {
      render: (model) => worldSceneRenderer.renderInvalidCastMarker(model),
    };
    this.#validateRenderContracts(contracts, {
      worldSceneRenderer,
      ...(worldDebugRenderer == null ? {} : { worldDebugRenderer }),
      boatChumRenderer,
      castSceneRenderer,
      fightAreaRenderer,
      rodLineRenderer,
      floatRenderer,
      fishingSceneRenderer,
      statusBarsRenderer,
      holdChargesRenderer,
      fightHudRenderer,
      invalidCastMarkerRenderer,
    });
    const pipeline = new GameRenderPipeline({
      diagnostics: this.#readRenderDiagnostics(),
      passes: GameRenderOrder.createPassList({
        world: new WorldRenderPass({
          components: [
            new RenderComponent({
              id: "world-background",
              order: GameRenderOrder.values.BACKGROUND,
              renderer: worldSceneRenderer,
              selectModel: (frame) => frame.world,
            }),
            ...(worldDebugRenderer == null ? [] : [new RenderComponent({
              id: "world-debug",
              order: GameRenderOrder.values.WORLD_DEBUG,
              renderer: worldDebugRenderer,
              selectModel: (frame) => frame.world,
            })]),
            new RenderComponent({
              id: "boat-chum",
              order: GameRenderOrder.values.WORLD_ENTITIES,
              renderer: boatChumRenderer,
              selectModel: (frame) => frame.world,
            }),
            new RenderComponent({
              id: "invalid-cast-marker",
              order: GameRenderOrder.values.WORLD_ENTITIES + 1,
              renderer: invalidCastMarkerRenderer,
              selectModel: (frame) => frame.world.invalidCastMarker,
            }),
          ],
        }),
        casting: new CastingRenderPass({ renderer: castSceneRenderer }),
        fishing: new FishingRenderPass({ renderer: fishingSceneRenderer }),
        hud: new HudRenderPass({ renderer: fightHudRenderer }),
        outcome: new OutcomeRenderPass({
          gameOverRenderer: new GameOverRenderer({ surface }),
          victoryRenderer: new VictoryRenderer({
            surface,
            primitives,
            assets: imageAssets,
            themeResolver: new VictoryThemeResolver({
              rarityVisualResolver,
            }),
            starRatingRenderer: new StarRatingRenderer({
              surface,
              primitives,
            }),
          }),
        }),
      }),
    });
    contracts.requireMethods(pipeline, "rendering.pipeline", [
      "render",
      "getPassCount",
      "copyPassIdsInto",
    ]);
    return { pipeline };
  }

  // Render frame builders for world, casting, fight areas, HUD, fishing and outcome.
  composeFrameBuilders({ runtime, config, canvasMetrics, appPorts, clock, contracts, fightService }) {
    const worldBuilder = new WorldRenderFrameBuilder({
      map: runtime.map,
      projector: runtime.projector,
      config,
      canvasMetrics,
      locationId: runtime.location.id,
      boatChumBuilder: new BoatChumRenderFrameBuilder({
        chum: runtime.chum,
        projector: runtime.projector,
        config,
      }),
      debugBuilder: this.#createOptionalDiagnostic(
        this.#createLocationDebugRenderFrameBuilder, "locationDebugRenderFrameBuilder", [{
          map: runtime.map,
          projector: runtime.projector,
          config,
          debugMapBuilder: runtime.rendering.locationDebugMapBuilder,
        }], ["buildInto"],
      ),
    });
    const castingBuilder = new CastingRenderFrameBuilder({
      projector: runtime.projector,
      config,
      canvasMetrics,
      hudStyleResolver: runtime.rendering.hudStyleResolver,
      chumSource: {
        isAiming: appPorts.isAimingChum,
        getEquipment: () => runtime.inventory.getEquipped(),
        getGameStateName: appPorts.getGameStateName,
        getCastDistance: appPorts.getChumCastDistance,
        getPowerAimVisual: appPorts.getChumPowerAimVisual,
        getAccuracyPreview: appPorts.getChumAccuracyPreview,
        getBounds: appPorts.getDynamicBounds,
        getNow: () => clock.now,
      },
    });
    const fightAreaBuilder = new FightAreaRenderFrameBuilder({
      projector: runtime.projector,
      config,
      canvasMetrics,
      getRodScreenX: appPorts.getRodScreenX,
      landingAreaBuilder: new LandingAreaRenderFrameBuilder({
        projector: runtime.projector,
        config,
        canvasMetrics,
        getNet: appPorts.getNet,
        getRodScreenX: appPorts.getRodScreenX,
        landingPolicyResolver: new LandingPolicyResolver(),
      }),
      sectorGeometry: new PoleFightSectorGeometry(),
    });
    const hudBuilder = new FightHudFrameBuilder({
      config,
      canvasMetrics,
    });
    const fishingBuilder = new FishingRenderFrameBuilder({
      inventory: runtime.inventory,
      projector: runtime.projector,
      canvasMetrics,
      clock,
      config,
      equipmentRules: runtime.equipmentRules,
      baitRules: runtime.baitRules,
      getFloat: appPorts.getFloat,
      getInputState: appPorts.getInputState,
      getCastDistanceRatio: appPorts.getCastDistanceRatio,
      getCurrentHookDepth: appPorts.getCurrentHookDepth,
      getHoldState: () => fightService.getHoldUiState(),
      lineVisualState: new LineVisualStateController(),
      fightAreaBuilder,
      hudBuilder,
      equipmentModelBuilder: new FishingEquipmentRenderModelBuilder({
        projector: runtime.projector,
        canvasMetrics,
        clock,
        config,
        getRodScreenX: appPorts.getRodScreenX,
      }),
    });
    const outcomeBuilder = new OutcomeRenderFrameBuilder({
      canvasMetrics,
      clock,
      styleResolver: runtime.rendering.outcomeStyleResolver,
      layoutResolver: runtime.rendering.victoryLayoutResolver,
      assetIdForSource: (source, namespace) => ImageAssetProvider.assetIdForSource(source, namespace),
    });
    runtime.inventory.setLineCapacityStateProvider?.(
      () => fightService.getLineCapacityState(),
    );
    const frameBuilder = new GameRenderFrameBuilder({
      canvasMetrics,
      projector: runtime.projector,
      worldBuilder,
      castingBuilder,
      fishingBuilder,
      outcomeBuilder,
    });
    this.#validateFrameBuilderContracts(contracts, {
      worldBuilder,
      castingBuilder,
      fightAreaBuilder,
      hudBuilder,
      fishingBuilder,
      outcomeBuilder,
      frameBuilder,
    });
    return { frameBuilder };
  }

  // Render coordinator: frame buffer, frame builder and pipeline.
  composeCoordinator({ stateMachine, frameBuilder, runtime, appPorts, contracts }) {
    const renderCoordinator = new GameRenderCoordinator({
      stateMachine,
      frameBuffer: new RenderFrameBuffer({
        diagnostics: this.#readRenderDiagnostics(),
      }),
      frameBuilder,
      pipeline: runtime.rendering.pipeline,
      getBounds: appPorts.getDynamicBounds,
      getInvalidCastMarker: appPorts.getInvalidCastMarker,
      isDebugEnabled: appPorts.isDebugEnabled,
      invalidateStyles: () => {
        runtime.rendering.hudStyleResolver.invalidate();
        runtime.rendering.fightAreaStyleResolver.invalidate();
        runtime.rendering.outcomeStyleResolver.invalidate();
        runtime.rendering.rarityVisualResolver.invalidate();
      },
    });
    contracts.requireMethods(renderCoordinator, "renderCoordinator", [
      "render",
      "invalidateStyles",
    ]);
    return { renderCoordinator };
  }

  #validateRenderContracts(contracts, renderers) {
    const names = Object.keys(renderers);
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      contracts.requireMethods(renderers[name], name, ["render"]);
    }
  }

  #validateFrameBuilderContracts(contracts, builders) {
    const names = Object.keys(builders);
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      contracts.requireMethods(builders[name], name, ["buildInto"]);
    }
  }
}
