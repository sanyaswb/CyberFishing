import { HorizontalScrollController } from "../../platform/browser/dom/horizontal_scroll_controller.js";
import { RadioControlsRenderer } from "../../game/presentation/radio/radio_controls_renderer.js";
import { RADIO_LABELS } from "../../game/presentation/radio/radio_labels.js";
import { InventoryActionContract } from "../../game/presentation/inventory/inventory_action_contract.js";
import { InventoryActionType } from "../../game/presentation/inventory/inventory_action_type.js";
import { InventoryFacadeContract } from "../../game/presentation/inventory/inventory_facade_contract.js";
import { InventoryViewModelNormalizer } from "../../game/presentation/inventory/inventory_view_model_normalizer.js";
import { InventoryAssemblyEditorRenderer } from "../../game/presentation/inventory/inventory_assembly_editor_renderer.js";
import { InventoryAssemblyParameterSectionResolver } from "../../game/presentation/inventory/inventory_assembly_parameter_section_resolver.js";
import { InventoryAttachmentBadgeRenderer } from "../../game/presentation/inventory/inventory_attachment_badge_renderer.js";
import { InventoryEditorTabsRenderer } from "../../game/presentation/inventory/inventory_editor_tabs_renderer.js";
import { InventoryEditorTabsResolver } from "../../game/presentation/inventory/inventory_editor_tabs_resolver.js";
import { INVENTORY_EDITOR_TABS_LABELS } from "../../game/presentation/inventory/inventory_editor_tabs_labels.js";
import { INVENTORY_EDITOR_CONFIG } from "../../game/presentation/inventory/inventory_editor_config.js";
import { InventoryRodRemovalRenderer } from "../../game/presentation/inventory/inventory_rod_removal_renderer.js";
import { InventoryBalanceParameterResolver } from "../../game/presentation/inventory/inventory_balance_parameter_resolver.js";
import { InventoryDomFactory } from "../../platform/browser/dom/inventory_dom_factory.js";
import { ImageAssetProvider } from "../../platform/browser/assets/image_asset_provider.js";
import { ConsoleLogger } from "../../platform/browser/diagnostics/console_logger.js";
import { inventorySlotIconPaths } from "../../game/presentation/inventory/inventory_slot_icons.js";
import { InventoryHeaderRenderer } from "../../game/presentation/inventory/inventory_header_renderer.js";
import { InventoryLoadRenderer } from "../../game/presentation/inventory/inventory_load_renderer.js";
import { InventoryScaleRenderer } from "../../game/presentation/inventory/inventory_scale_renderer.js";
import { InventoryCollectionPagerRenderer } from "../../game/presentation/inventory/inventory_collection_pager_renderer.js";
import { SwipePagerController } from "../../platform/browser/dom/swipe_pager_controller.js";
import { ScrollContainerAligner } from "../../platform/browser/dom/scroll_container_aligner.js";
import { INVENTORY_LOAD_METER_CONFIG } from "../../game/presentation/inventory/inventory_load_meter_config.js";
import { InventoryGridRenderer } from "../../game/presentation/inventory/inventory_grid_renderer.js";
import { InventoryItemCardRenderer } from "../../game/presentation/inventory/inventory_item_card_renderer.js";
import { InventoryItemParametersRenderer } from "../../game/presentation/inventory/inventory_item_parameters_renderer.js";
import { InventoryItemParametersResolver } from "../../game/presentation/inventory/inventory_item_parameters_resolver.js";
import { InventoryLoadoutPanelRenderer } from "../../game/presentation/inventory/inventory_loadout_panel_renderer.js";
import { InventorySectionTabsRenderer } from "../../game/presentation/inventory/inventory_section_tabs_renderer.js";
import { InventoryBackpackSummaryRenderer } from "../../game/presentation/inventory/inventory_backpack_summary_renderer.js";
import { INVENTORY_SECTIONS } from "../../game/presentation/inventory/inventory_sections.js";
import { InventoryLongPressController } from "../../platform/browser/dom/inventory_long_press_controller.js";
import { InventoryPickCancelController } from "../../platform/browser/dom/inventory_pick_cancel_controller.js";
import { BrowserTimeoutScheduler } from "../../platform/browser/time/browser_timeout_scheduler.js";
import { InventoryResourceMeterRenderer } from "../../game/presentation/inventory/inventory_resource_meter_renderer.js";
import { InventoryResourceMeterResolver } from "../../game/presentation/inventory/inventory_resource_meter_resolver.js";
import { InventorySavedLoadoutPreviewRenderer } from "../../game/presentation/inventory/inventory_saved_loadout_preview_renderer.js";
import { InventoryTooltipPresenter } from "../../game/presentation/inventory/inventory_tooltip_presenter.js";
import { InventoryUI } from "../../game/presentation/inventory/inventory_ui.js";
import { KeepnetSectionView } from "../../game/presentation/keepnet/keepnet_section_view.js";
import { KeepnetViewModel } from "../../game/presentation/keepnet/keepnet_view_model.js";
import { KeepnetCardRenderer } from "../../game/presentation/keepnet/keepnet_card_renderer.js";
import { KeepnetOverviewRenderer } from "../../game/presentation/keepnet/keepnet_overview_renderer.js";
import { KeepnetFiltersRenderer } from "../../game/presentation/keepnet/keepnet_filters_renderer.js";
import { KEEPNET_ART_STAGES } from "../../game/presentation/keepnet/keepnet_art_config.js";
import { KeepnetFillImageResolver } from "../../game/presentation/keepnet/keepnet_fill_image_resolver.js";
import { KEEPNET_LABELS } from "../../game/presentation/keepnet/keepnet_labels.js";
import { UiCloseButtonRenderer } from "../../game/presentation/ui/ui_close_button_renderer.js";
import { UiAutoSwitchRenderer } from "../../game/presentation/ui/ui_auto_switch_renderer.js";
import { UiHintRenderer } from "../../game/presentation/ui/ui_hint_renderer.js";
import { composeHintRenderer } from "./hint_renderer_composition.js";

export class InventoryUiBootstrap {
  // The keepnet is the inventory's keepnet section (spec 067); its toolbar button opens the inventory there.
  static createKeepnet({ documentRef, liveBait, inventoryUI, degradationColorResolver, uiSurface = null,
    buttonMountNode = documentRef?.body, showHelp = false }) {
    if (!documentRef?.body?.append || typeof documentRef.createElement !== "function") return null;
    const keepnet = InventoryUiBootstrap.createKeepnetView({ documentRef, liveBait, buttonMountNode, uiSurface,
      degradationColorResolver, showHelp,
      openSection: () => inventoryUI.openSection("keepnet"),
      toggleSection: () => inventoryUI.toggleSection("keepnet"),
      onPagerEdge: (step) => inventoryUI.swipeSection(step) });
    inventoryUI.attachKeepnetSection(keepnet);
    return keepnet;
  }

  // The keepnet section view with the backpack's collaborators (spec 088): scale, filter rows and the swipe pager.
  // The UI catalog builds the same view without an inventory. The help button stays a component but the game hides
  // it for now (spec 089).
  static createKeepnetView({ documentRef, liveBait, buttonMountNode, uiSurface, degradationColorResolver,
    openSection, toggleSection, onPagerEdge = null, showHelp = false }) {
    const dom = new InventoryDomFactory(documentRef);
    const resourceMeterRenderer = new InventoryResourceMeterRenderer({ domFactory: dom, degradationColorResolver });
    const pagerConfig = INVENTORY_SECTIONS.keepnetPager;
    // Only the current fill stage loads with the view (its images); the other stages wait for preloadKeepnetStages
    // after the game is ready (spec 157 R5).
    const imageResolver = new KeepnetFillImageResolver({ stages: KEEPNET_ART_STAGES });
    return new KeepnetSectionView({ documentRef, liveBait, buttonMountNode, openSection, toggleSection, onPagerEdge,
      imageResolver, shortcutIcon: `${INVENTORY_SECTIONS.iconSprite}#keepnet`,
      model: new KeepnetViewModel(), labels: KEEPNET_LABELS,
      overviewRenderer: new KeepnetOverviewRenderer({ domFactory: dom, labels: KEEPNET_LABELS,
        scaleRenderer: new InventoryScaleRenderer({ domFactory: dom, resourceMeterRenderer }),
        imageResolver, capacityIcon: pagerConfig.capacityIcon, showHelp }),
      filtersRenderer: new KeepnetFiltersRenderer({ domFactory: dom, labels: KEEPNET_LABELS,
        horizontalScrollController: new HorizontalScrollController({ uiSurface }) }),
      pagerRenderer: new InventoryCollectionPagerRenderer({ domFactory: dom,
        tabsRenderer: new InventorySectionTabsRenderer({ domFactory: dom, sections: pagerConfig }),
        isPagingEnabled: InventoryUiBootstrap.#swipeEnabled(dom),
        swipeController: new SwipePagerController({ isEnabled: InventoryUiBootstrap.#swipeEnabled(dom, "--inventory-section-swipe") }),
        config: pagerConfig }),
      cards: new KeepnetCardRenderer({ documentRef, labels: KEEPNET_LABELS }),
      hintRenderer: new UiHintRenderer({ domFactory: dom }),
      listScrollController: InventoryUiBootstrap.createListScrollController(uiSurface) });
  }

  // CSS owns separate flags for portrait collection paging and all-layout section/editor navigation.
  static #swipeEnabled(dom, property = "--inventory-swipe") {
    return (node) => dom.view.getComputedStyle(node).getPropertyValue(property).trim() === "on";
  }

  // Vertical drag-to-scroll for item and fish lists (spec 076); filters keep the horizontal default.
  static createListScrollController(uiSurface) {
    return new HorizontalScrollController({ uiSurface, axis: "y", className: "inventory-vertical-scroll",
      dragClassName: "inventory-vertical-scroll--dragging" });
  }

  // Spec 157 R5: every keepnet fill stage, warmed after the game is ready so a filling keepnet swaps its art without
  // a network wait; startup loads only the current stage (createKeepnetView).
  static preloadKeepnetStages(documentRef) {
    const imagePreloader = new ImageAssetProvider({ imageFactory: () => documentRef.createElement("img") });
    return imagePreloader.preload(KEEPNET_ART_STAGES.map((stage) => ({ id: stage.imagePath, src: stage.imagePath })))
      .catch((error) => new ConsoleLogger().warn("[Keepnet] Artwork preload failed", error));
  }

  // The empty-slot placeholders appear only once the inventory opens; warming them here instead of <link preload>
  // keeps them cached without the browser's "preloaded but not used" warning (TK-081).
  static preloadSlotIcons(documentRef) {
    const imagePreloader = new ImageAssetProvider({ imageFactory: () => documentRef.createElement("img") });
    return imagePreloader.preload(inventorySlotIconPaths().map((src) => ({ id: src, src })))
      .catch((error) => new ConsoleLogger().warn("[Inventory] Slot icon preload failed", error));
  }

  // radio: the radio receiver's port (spec 142), whose controls the radio's editor shows; null without one.
  // radioTuning: DEV only, the enabled sound effects' main parameters as sliders (TK-098); null in production.
  static create({ autoMount = true, autoOpen = false, radio = null, radioTuning = null, ...options } = {}) {
    InventoryUiBootstrap.preloadSlotIcons(options.documentRef);
    const ui = new InventoryUI({
      ...options,
      facadeContract: InventoryFacadeContract,
      actionContract: InventoryActionContract,
      actionTypes: InventoryActionType,
      createPresentation: (presentationOptions) =>
        InventoryUiBootstrap.#createPresentation({ ...presentationOptions, radio, radioTuning }),
    });
    if (autoMount) ui.mount();
    if (autoOpen) ui.open();
    return ui;
  }

  // Create the existing UI tree only after UI validates its facade/mount; keep collaborator order and overrides.
  static #createPresentation({
    documentRef,
    uiSurface,
    radio = null,
    radioTuning = null,
    rarityDomAdapter,
    rarityVisualResolver,
    progressionDomAdapter,
    conditionDomAdapter,
    normalizer,
    longPressController,
    headerRenderer,
    loadoutRenderer,
    assemblyRenderer,
    savedLoadoutRenderer,
    inventoryRenderer,
    tooltipPresenter,
    balanceParameterResolver,
    resourceMeterResolver,
    resourceMeterRenderer,
    degradationColorResolver,
    warningTimers,
  }) {
    const LongPressController = InventoryLongPressController;
    const dom = new InventoryDomFactory(documentRef);
    const resolvedNormalizer =
      normalizer || new InventoryViewModelNormalizer();
    const resolvedLongPressController =
      longPressController || new LongPressController({
        degradationColorResolver,
      });
    const resolvedTooltipPresenter =
      tooltipPresenter ||
      new InventoryTooltipPresenter({
        documentRef,
        uiSurface,
        getView: () => dom.view,
        rarityDomAdapter,
        balanceParameterResolver:
          balanceParameterResolver ||
          new InventoryBalanceParameterResolver({
            rarityVisualResolver,
          }),
      });

    const attachmentRenderer =
      new InventoryAttachmentBadgeRenderer({
        domFactory: dom,
        rarityDomAdapter,
      });
    const resolvedResourceMeterResolver =
      resourceMeterResolver || new InventoryResourceMeterResolver();
    const resolvedResourceMeterRenderer =
      resourceMeterRenderer ||
      new InventoryResourceMeterRenderer({ domFactory: dom, degradationColorResolver });
    const scaleRenderer = new InventoryScaleRenderer({ domFactory: dom, resourceMeterRenderer: resolvedResourceMeterRenderer });
    const itemParametersResolver =
      new InventoryItemParametersResolver({
        resourceMeterResolver: resolvedResourceMeterResolver,
        progressionDomAdapter,
        rarityVisualResolver,
      });
    const itemParametersRenderer =
      new InventoryItemParametersRenderer({
        domFactory: dom,
        resolver: itemParametersResolver,
        resourceMeterRenderer: resolvedResourceMeterRenderer,
      });
    const resolvedItemRenderer = new InventoryItemCardRenderer({
      domFactory: dom,
      attachmentRenderer,
      longPressController: resolvedLongPressController,
      rarityDomAdapter,
      progressionDomAdapter,
      conditionDomAdapter,
      tooltipPresenter: resolvedTooltipPresenter,
      resourceMeterResolver: resolvedResourceMeterResolver,
      resourceMeterRenderer: resolvedResourceMeterRenderer,
    });
    const resolvedHeaderRenderer =
      headerRenderer ||
      new InventoryHeaderRenderer({ domFactory: dom,
        closeButtonRenderer: new UiCloseButtonRenderer({ domFactory: dom }),
        autoSwitchRenderer: new UiAutoSwitchRenderer({ domFactory: dom,
          longPressController: resolvedLongPressController, longPressDurationMs: LongPressController.DURATION_MS,
          longPressActivationDelayMs: LongPressController.ACTIVATION_DELAY_MS }),
        loadRenderer: new InventoryLoadRenderer({ scaleRenderer, config: INVENTORY_LOAD_METER_CONFIG }),
      });
    const resolvedLoadoutRenderer =
      loadoutRenderer ||
      new InventoryLoadoutPanelRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        resourceMeterRenderer: resolvedResourceMeterRenderer,
        getEquippedLongPressDurationMs: () => LongPressController.EQUIPPED_DURATION_MS,
        // Spec 142: the auxiliary wells scroll along the axis their layout declares (row: x, column: y).
        auxiliaryScrollController: new HorizontalScrollController({ uiSurface,
          resolveAxis: (node) => dom.view.getComputedStyle(node).getPropertyValue("--inventory-scroll-axis").trim() }),
      });
    const resolvedAssemblyRenderer =
      assemblyRenderer ||
      new InventoryAssemblyEditorRenderer({
        domFactory: dom,
        scrollbarEnabled: INVENTORY_EDITOR_CONFIG.scrollbar.enabled,
        itemRenderer: resolvedItemRenderer,
        parametersRenderer: itemParametersRenderer,
        deviceControlsRenderer: radio ? new RadioControlsRenderer({ domFactory: dom, radio, labels: RADIO_LABELS,
          tuning: radioTuning }) : null,
        rodRemovalRenderer: new InventoryRodRemovalRenderer({ domFactory: dom }),
        // Item editor tabs (spec 091, every layout since spec 094): their own swipe flag, so the section swipe can be
        // off in the editor.
        tabsRenderer: new InventoryEditorTabsRenderer({ domFactory: dom, resolver: new InventoryEditorTabsResolver(),
          itemRenderer: resolvedItemRenderer, parametersRenderer: itemParametersRenderer,
          swipeController: new SwipePagerController({ isEnabled: InventoryUiBootstrap.#swipeEnabled(dom, "--inventory-editor-swipe"),
            positionProperty: null, draggingClassName: "inventory-editor-tabs__panel--dragging" }),
          rowScrollController: new HorizontalScrollController({ uiSurface }), labels: INVENTORY_EDITOR_TABS_LABELS,
          longPressDurationMs: LongPressController.EQUIPPED_DURATION_MS,
          scrollAligner: new ScrollContainerAligner({ windowRef: dom.view }) }),
      });
    const resolvedSavedLoadoutRenderer =
      savedLoadoutRenderer ||
      new InventorySavedLoadoutPreviewRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        parametersRenderer: itemParametersRenderer,
        parameterSectionResolver: new InventoryAssemblyParameterSectionResolver(),
      });
    const swipeEnabled = InventoryUiBootstrap.#swipeEnabled(dom);
    const sectionSwipeEnabled = InventoryUiBootstrap.#swipeEnabled(dom, "--inventory-section-swipe");
    const resolvedInventoryRenderer =
      inventoryRenderer ||
      new InventoryGridRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        createHorizontalScrollController: () => new HorizontalScrollController({ uiSurface }),
        listScrollController: InventoryUiBootstrap.createListScrollController(uiSurface),
        backdropImage: INVENTORY_SECTIONS.backpackBackdropImage,
        pagerRenderer: new InventoryCollectionPagerRenderer({ domFactory: dom,
          tabsRenderer: new InventorySectionTabsRenderer({ domFactory: dom, sections: INVENTORY_SECTIONS.backpackPager }),
          isPagingEnabled: swipeEnabled,
          swipeController: new SwipePagerController({ isEnabled: sectionSwipeEnabled }), config: INVENTORY_SECTIONS.backpackPager }),
      });
    return {
      dom,
      resolvedNormalizer,
      resolvedLongPressController,
      pickCancelController: new InventoryPickCancelController({
        timers: warningTimers || new BrowserTimeoutScheduler(dom.view), holdMs: 200,
        moveTolerancePx: InventoryLongPressController.MOVEMENT_TOLERANCE_PX,
      }),
      resolvedTooltipPresenter,
      resolvedItemRenderer,
      resolvedHeaderRenderer,
      resolvedLoadoutRenderer,
      resolvedAssemblyRenderer,
      resolvedSavedLoadoutRenderer,
      resolvedInventoryRenderer,
      sections: INVENTORY_SECTIONS,
      sectionSwipeController: new SwipePagerController({ isEnabled: sectionSwipeEnabled, positionProperty: null,
        draggingClassName: "inventory-main--swiping" }),
      sectionTabsRenderer: new InventorySectionTabsRenderer({ domFactory: dom, sections: INVENTORY_SECTIONS }),
      backpackSummaryRenderer: new InventoryBackpackSummaryRenderer({ domFactory: dom, sections: INVENTORY_SECTIONS, scaleRenderer }),
      hintRenderer: composeHintRenderer({ domFactory: dom, uiSurface, timers: warningTimers }),
    };
  }
}
