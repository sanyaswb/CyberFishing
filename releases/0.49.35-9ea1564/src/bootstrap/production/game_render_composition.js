import { BoatChumRenderer } from "../../game/presentation/world/boat_chum_renderer.js";
import { BoatChumRenderFrameBuilder } from "../../game/presentation/rendering/boat_chum_render_frame_builder.js";
import { BoatWakeEmitter } from "../../game/presentation/world/boat_wake_emitter.js";
import { CastingRenderFrameBuilder } from "../../game/presentation/rendering/casting_render_frame_builder.js";
import { CastingRenderPass } from "../../game/presentation/rendering/casting_render_pass.js";
import { CastSceneRenderer } from "../../game/presentation/casting/cast_scene_renderer.js";
import { HUD_LABELS } from "../../game/presentation/hud/hud_labels.js";
import { FightAreaRenderer } from "../../game/presentation/fishing/fight_area_renderer.js";
import { fishDisplayImagePath } from "../../game/presentation/fish/fish_art_variants.js";
import { FightAreaRenderFrameBuilder } from "../../game/presentation/rendering/fight_area_render_frame_builder.js";
import { FightHudFrameBuilder } from "../../game/presentation/hud/fight_hud_frame_builder.js";
import { FightHudRenderer } from "../../game/presentation/hud/fight_hud_renderer.js";
import { FightStatusBarsRenderer } from "../../game/presentation/hud/fight_status_bars_renderer.js";
import { FishingEquipmentRenderModelBuilder } from "../../game/presentation/fishing/fishing_equipment_render_model_builder.js";
import { FloatPoseAnimator } from "../../game/presentation/fishing/float_pose_animator.js";import { FishingRenderFrameBuilder } from "../../game/presentation/rendering/fishing_render_frame_builder.js";
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
import { RodSpineRenderer } from "../../game/presentation/fishing/rod_spine_renderer.js";
import { RodStaticRenderer } from "../../game/presentation/fishing/rod_static_renderer.js";
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
  #frameProbe;

  constructor({
    readRenderDiagnostics,
    createOptionalDiagnostic,
    createWorldDebugRenderer,
    createLocationDebugRenderFrameBuilder,
    frameProbe,
  }) {
    this.#frameProbe = frameProbe;
    this.#readRenderDiagnostics = readRenderDiagnostics;
    this.#createOptionalDiagnostic = createOptionalDiagnostic;
    this.#createWorldDebugRenderer = createWorldDebugRenderer;
    this.#createLocationDebugRenderFrameBuilder = createLocationDebugRenderFrameBuilder;
  }

  // Renderers and the ordered render pipeline (world, casting, fishing, HUD, outcome).
  // sceneRouter (spec 104): a world kind's 2D component draws only while the kind is on the 2D canvas.
  composePipeline({
    surface, imageAssets, primitives, hudStyleResolver, fightAreaStyleResolver, contracts,
    rarityVisualResolver, rodAnimation, sceneRouter,
  }) {
    const hudBarRenderer = new HudBarRenderer(surface);
    const worldSceneRenderer = new WorldSceneRenderer({
      surface,
      assets: imageAssets,
    });
    const worldDebugRenderer = this.#createOptionalDiagnostic(
      this.#createWorldDebugRenderer, "worldDebugRenderer", [{ surface, sceneRouter }], ["render"],
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
    const rodStaticRenderer = new RodStaticRenderer({ surface });
    const rodSpineRenderer = new RodSpineRenderer({ surface, controller: rodAnimation, probe: this.#frameProbe });
    const floatRenderer = new FloatRenderer({ surface, images: imageAssets });
    const fishingSceneRenderer = new FishingSceneRenderer({
      components: [
        new RenderComponent({
          id: "fight-area",
          order: GameRenderOrder.values.FIGHT_AREAS,
          renderer: fightAreaRenderer,
          selectModel: (model) => model.fightAreas,
          isVisible: sceneRouter.canvasVisibility("fight-areas"),
        }),
        // Depth order (spec 100 D5): the line first, then the rod picture (static or Spine, spec 099), which is nearer
        // the camera and covers the line where it leaves the tip. The rectangle and the line stay one component.
        new RenderComponent({
          id: "rod-line",
          order: GameRenderOrder.values.FISHING_EQUIPMENT - 2,
          renderer: rodLineRenderer,
          selectModel: (model) => model.rodLine,
          isVisible: sceneRouter.canvasVisibility("line"),
        }),
        new RenderComponent({
          id: "rod-static",
          order: GameRenderOrder.values.FISHING_EQUIPMENT - 1,
          renderer: rodStaticRenderer,
          selectModel: (model) => model.rodLine,
          isVisible: sceneRouter.canvasVisibility("rod"),
        }),
        new RenderComponent({
          id: "rod-spine",
          order: GameRenderOrder.values.FISHING_EQUIPMENT,
          renderer: rodSpineRenderer,
          selectModel: (model) => model.rodLine,
          isVisible: sceneRouter.canvasVisibility("rod"),
        }),
        new RenderComponent({
          id: "float",
          order: GameRenderOrder.values.FISHING_EQUIPMENT + 1,
          renderer: floatRenderer,
          selectModel: (model) => model.float,
          isVisible: sceneRouter.canvasVisibility("float"),
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
      rodStaticRenderer,
      rodSpineRenderer,
      floatRenderer,
      fishingSceneRenderer,
      statusBarsRenderer,
      holdChargesRenderer,
      fightHudRenderer,
      invalidCastMarkerRenderer,
    });
    const pipeline = new GameRenderPipeline({
      diagnostics: this.#readRenderDiagnostics(),
      probe: this.#frameProbe,
      passes: GameRenderOrder.createPassList({
        world: new WorldRenderPass({
          components: [
            new RenderComponent({
              id: "world-background",
              order: GameRenderOrder.values.BACKGROUND,
              renderer: worldSceneRenderer,
              selectModel: (frame) => frame.world,
              isVisible: sceneRouter.canvasVisibility("background"),
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
              isVisible: sceneRouter.canvasVisibility("world-entities"),
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
  composeFrameBuilders({ runtime, config, canvasMetrics, appPorts, clock, contracts, fightService, devFlags = null }) {
    const worldBuilder = new WorldRenderFrameBuilder({
      map: runtime.map,
      isAssetReady: (assetId) => runtime.rendering.imageAssets.isReady(assetId),
      getWaterMetric: appPorts.getWaterMetric,
      projector: runtime.projector,
      config,
      canvasMetrics,
      locationId: runtime.location.id,
      boatChumBuilder: new BoatChumRenderFrameBuilder({
        chum: runtime.chum,
        getWaterMetric: appPorts.getWaterMetric,
        projector: runtime.projector,
        config,
        boatAnimation: runtime.rendering.boatAnimation?.controller ?? runtime.rendering.boatAnimation,
        getTimeOfDay: () => runtime.env?.getSnapshot?.()?.time ?? (typeof clock?.getHours === "function" ? clock.getHours() : 12),
        clock,
        // Spec 154 Q3: production's inactive DEV flags never show the boat route.
        isRouteVisible: () => devFlags?.isEnabled("showBoatRoute") === true,
        // Spec 155: the procedural wake, read live from CONFIG.ui.boat.wake.
        wake: new BoatWakeEmitter({ getSettings: () => config.ui?.boat?.wake }),
      }),
      debugBuilder: this.#createOptionalDiagnostic(
        this.#createLocationDebugRenderFrameBuilder, "locationDebugRenderFrameBuilder", [{
          map: runtime.map,
          projector: runtime.projector,
          config,
          debugMapBuilder: runtime.rendering.locationDebugMapBuilder,
          getWaterMetric: appPorts.getWaterMetric,
          canvasMetrics,
          // Spec 136: what the DEV editor previews the castable area's zones from (read only): equipment, the rod.
          getEquipment: () => runtime.inventory.getEquipped(),
          getRodScreenX: appPorts.getRodScreenX,
          // Spec 136 R3: the cast float and the limits it obeys, for the editor's float anchor.
          getFloat: appPorts.getFloat,
          getGameStateName: appPorts.getGameStateName,
          checkWater: appPorts.checkWater,
          equipmentRules: runtime.equipmentRules,
          getHookDepthMeters: () => appPorts.currentHookDepthRef?.get?.() ?? null,
          // TK-088: the game's chum zones the editor lists and edits.
          getChumZones: () => runtime.chum.getZones(),
          saveChumZones: () => runtime.chum.saveToStorage(),
        }], ["buildInto"],
      ),
    });
    const castingBuilder = new CastingRenderFrameBuilder({
      projector: runtime.projector,
      getWaterMetric: appPorts.getWaterMetric,
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
      labels: HUD_LABELS,
    });
    const fightAreaBuilder = new FightAreaRenderFrameBuilder({
      projector: runtime.projector,
      getWaterMetric: appPorts.getWaterMetric,
      config,
      canvasMetrics,
      getRodScreenX: appPorts.getRodScreenX,
      landingAreaBuilder: new LandingAreaRenderFrameBuilder({
        projector: runtime.projector,
        getWaterMetric: appPorts.getWaterMetric,
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
      getCastRodMovement: appPorts.getCastRodMovement,
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
        rodAnimation: runtime.rendering.rodAnimation.controller,
        getWind: () => runtime.env.getSnapshot()?.wind ?? null,
        getTimeOfDay: () => runtime.env.getSnapshot().time,
        floatPose: new FloatPoseAnimator({ getConfig: () => config.physics?.floatPose }),
        floatRocking: runtime.rendering.floatRocking,
        getWaterMetric: appPorts.getWaterMetric,
      }),
    });
    const outcomeBuilder = new OutcomeRenderFrameBuilder({
      // The victory image: the fish's 768 px display variant, the same source the preloader loads (spec 100 D4).
      resolveFishImage: fishDisplayImagePath,
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
      sceneLayer: runtime.rendering.sceneLayer,
      sceneRouter: runtime.rendering.sceneRouter,
      probe: this.#frameProbe,
      getBounds: appPorts.getDynamicBounds,
      getInvalidCastMarker: appPorts.getInvalidCastMarker,
      isDebugEnabled: appPorts.isDebugEnabled,
      beginFrame: () => runtime.rendering.surface.beginFrame(runtime.rendering.sceneRouter.clearsCanvas()),
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
