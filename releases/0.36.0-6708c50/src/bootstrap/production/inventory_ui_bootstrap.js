import { HorizontalScrollController } from "../../platform/browser/dom/horizontal_scroll_controller.js";
import { InventoryActionContract } from "../../game/presentation/inventory/inventory_action_contract.js";
import { InventoryActionType } from "../../game/presentation/inventory/inventory_action_type.js";
import { InventoryFacadeContract } from "../../game/presentation/inventory/inventory_facade_contract.js";
import { InventoryViewModelNormalizer } from "../../game/presentation/inventory/inventory_view_model_normalizer.js";
import { InventoryAssemblyEditorRenderer } from "../../game/presentation/inventory/inventory_assembly_editor_renderer.js";
import { InventoryAssemblyParameterSectionResolver } from "../../game/presentation/inventory/inventory_assembly_parameter_section_resolver.js";
import { InventoryAttachmentBadgeRenderer } from "../../game/presentation/inventory/inventory_attachment_badge_renderer.js";
import { InventoryRodRemovalRenderer } from "../../game/presentation/inventory/inventory_rod_removal_renderer.js";
import { InventoryBalanceParameterResolver } from "../../game/presentation/inventory/inventory_balance_parameter_resolver.js";
import { InventoryDomFactory } from "../../platform/browser/dom/inventory_dom_factory.js";
import { InventoryHeaderRenderer } from "../../game/presentation/inventory/inventory_header_renderer.js";
import { InventoryLoadRenderer } from "../../game/presentation/inventory/inventory_load_renderer.js";
import { InventoryScaleRenderer } from "../../game/presentation/inventory/inventory_scale_renderer.js";
import { InventoryCollectionPagerRenderer } from "../../game/presentation/inventory/inventory_collection_pager_renderer.js";
import { SwipePagerController } from "../../platform/browser/dom/swipe_pager_controller.js";
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
import { InventoryResourceMeterRenderer } from "../../game/presentation/inventory/inventory_resource_meter_renderer.js";
import { InventoryResourceMeterResolver } from "../../game/presentation/inventory/inventory_resource_meter_resolver.js";
import { InventorySavedLoadoutPreviewRenderer } from "../../game/presentation/inventory/inventory_saved_loadout_preview_renderer.js";
import { InventoryTooltipPresenter } from "../../game/presentation/inventory/inventory_tooltip_presenter.js";
import { InventoryUI } from "../../game/presentation/inventory/inventory_ui.js";
import { KeepnetSectionView } from "../../game/presentation/keepnet/keepnet_section_view.js";
import { KeepnetViewModel } from "../../game/presentation/keepnet/keepnet_view_model.js";
import { KeepnetCardRenderer } from "../../game/presentation/keepnet/keepnet_card_renderer.js";
import { KEEPNET_LABELS } from "../../game/presentation/keepnet/keepnet_labels.js";
import { UiCloseButtonRenderer } from "../../game/presentation/ui/ui_close_button_renderer.js";
import { UiAutoSwitchRenderer } from "../../game/presentation/ui/ui_auto_switch_renderer.js";

export class InventoryUiBootstrap {
  // The keepnet is the inventory's keepnet section (spec 067); its toolbar button opens the inventory there.
  static createKeepnet({ documentRef, liveBait, inventoryUI, degradationColorResolver, uiSurface = null,
    buttonMountNode = documentRef?.body }) {
    if (!documentRef?.body?.append || typeof documentRef.createElement !== "function") return null;
    const keepnet = new KeepnetSectionView({ documentRef, liveBait, buttonMountNode,
      model: new KeepnetViewModel(), labels: KEEPNET_LABELS,
      openSection: () => inventoryUI.openSection("keepnet"),
      toggleSection: () => inventoryUI.toggleSection("keepnet"),
      resourceMeterRenderer: new InventoryResourceMeterRenderer({
        domFactory: new InventoryDomFactory(documentRef), degradationColorResolver,
      }),
      cards: new KeepnetCardRenderer({ documentRef, labels: KEEPNET_LABELS }),
      listScrollController: InventoryUiBootstrap.createListScrollController(uiSurface) });
    inventoryUI.attachKeepnetSection(keepnet);
    return keepnet;
  }

  // Vertical drag-to-scroll for item and fish lists (spec 076); filters keep the horizontal default.
  static createListScrollController(uiSurface) {
    return new HorizontalScrollController({ uiSurface, axis: "y", className: "inventory-vertical-scroll",
      dragClassName: "inventory-vertical-scroll--dragging" });
  }

  static create({ autoMount = true, autoOpen = false, ...options } = {}) {
    const ui = new InventoryUI({
      ...options,
      facadeContract: InventoryFacadeContract,
      actionContract: InventoryActionContract,
      actionTypes: InventoryActionType,
      createPresentation: (presentationOptions) => InventoryUiBootstrap.#createPresentation(presentationOptions),
    });
    if (autoMount) ui.mount();
    if (autoOpen) ui.open();
    return ui;
  }

  // Create the existing UI tree only after UI validates its facade/mount; keep collaborator order and overrides.
  static #createPresentation({
    documentRef,
    uiSurface,
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
        autoSwitchRenderer: new UiAutoSwitchRenderer({ domFactory: dom }),
        loadRenderer: new InventoryLoadRenderer({ scaleRenderer, config: INVENTORY_LOAD_METER_CONFIG }),
      });
    const resolvedLoadoutRenderer =
      loadoutRenderer ||
      new InventoryLoadoutPanelRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        resourceMeterRenderer: resolvedResourceMeterRenderer,
        getEquippedLongPressDurationMs: () => LongPressController.EQUIPPED_DURATION_MS,
      });
    const resolvedAssemblyRenderer =
      assemblyRenderer ||
      new InventoryAssemblyEditorRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        parametersRenderer: itemParametersRenderer,
        createParameterSectionResolver: () => new InventoryAssemblyParameterSectionResolver(),
        rodRemovalRenderer: new InventoryRodRemovalRenderer({ domFactory: dom }),
      });
    const resolvedSavedLoadoutRenderer =
      savedLoadoutRenderer ||
      new InventorySavedLoadoutPreviewRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        parametersRenderer: itemParametersRenderer,
        parameterSectionResolver: new InventoryAssemblyParameterSectionResolver(),
      });
    const resolvedInventoryRenderer =
      inventoryRenderer ||
      new InventoryGridRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        createHorizontalScrollController: () => new HorizontalScrollController({ uiSurface }),
        listScrollController: InventoryUiBootstrap.createListScrollController(uiSurface),
        backdropImage: INVENTORY_SECTIONS.backpackImage,
        pagerRenderer: new InventoryCollectionPagerRenderer({ domFactory: dom,
          tabsRenderer: new InventorySectionTabsRenderer({ domFactory: dom, sections: INVENTORY_SECTIONS.backpackPager }),
          swipeController: new SwipePagerController(), config: INVENTORY_SECTIONS.backpackPager }),
      });
    return {
      dom,
      resolvedNormalizer,
      resolvedLongPressController,
      resolvedTooltipPresenter,
      resolvedItemRenderer,
      resolvedHeaderRenderer,
      resolvedLoadoutRenderer,
      resolvedAssemblyRenderer,
      resolvedSavedLoadoutRenderer,
      resolvedInventoryRenderer,
      sections: INVENTORY_SECTIONS,
      sectionTabsRenderer: new InventorySectionTabsRenderer({ domFactory: dom, sections: INVENTORY_SECTIONS }),
      backpackSummaryRenderer: new InventoryBackpackSummaryRenderer({ domFactory: dom, sections: INVENTORY_SECTIONS, scaleRenderer }),
    };
  }
}
