import { HorizontalScrollController } from "../../platform/browser/dom/horizontal_scroll_controller.js";
import { InventoryActionContract } from "../../game/presentation/inventory/inventory_action_contract.js";
import { InventoryActionType } from "../../game/presentation/inventory/inventory_action_type.js";
import { InventoryFacadeContract } from "../../game/presentation/inventory/inventory_facade_contract.js";
import { InventoryViewModelNormalizer } from "../../game/presentation/inventory/inventory_view_model_normalizer.js";
import { InventoryAssemblyEditorRenderer } from "../../game/presentation/inventory/inventory_assembly_editor_renderer.js";
import { InventoryAssemblyParameterSectionResolver } from "../../game/presentation/inventory/inventory_assembly_parameter_section_resolver.js";
import { InventoryAttachmentBadgeRenderer } from "../../game/presentation/inventory/inventory_attachment_badge_renderer.js";
import { InventoryBalanceParameterResolver } from "../../game/presentation/inventory/inventory_balance_parameter_resolver.js";
import { InventoryDomFactory } from "../../platform/browser/dom/inventory_dom_factory.js";
import { InventoryHeaderRenderer } from "../../game/presentation/inventory/inventory_header_renderer.js";
import { InventoryGridRenderer } from "../../game/presentation/inventory/inventory_grid_renderer.js";
import { InventoryItemCardRenderer } from "../../game/presentation/inventory/inventory_item_card_renderer.js";
import { InventoryItemParametersRenderer } from "../../game/presentation/inventory/inventory_item_parameters_renderer.js";
import { InventoryItemParametersResolver } from "../../game/presentation/inventory/inventory_item_parameters_resolver.js";
import { InventoryLoadoutPanelRenderer } from "../../game/presentation/inventory/inventory_loadout_panel_renderer.js";
import { InventoryLongPressController } from "../../platform/browser/dom/inventory_long_press_controller.js";
import { InventoryResourceMeterRenderer } from "../../game/presentation/inventory/inventory_resource_meter_renderer.js";
import { InventoryResourceMeterResolver } from "../../game/presentation/inventory/inventory_resource_meter_resolver.js";
import { InventorySavedLoadoutPreviewRenderer } from "../../game/presentation/inventory/inventory_saved_loadout_preview_renderer.js";
import { InventoryTooltipPresenter } from "../../game/presentation/inventory/inventory_tooltip_presenter.js";
import { InventoryUI } from "../../game/presentation/inventory/inventory_ui.js";

export class InventoryUiBootstrap {
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
      });
    const resolvedResourceMeterResolver =
      resourceMeterResolver || new InventoryResourceMeterResolver();
    const resolvedResourceMeterRenderer =
      resourceMeterRenderer ||
      new InventoryResourceMeterRenderer({ domFactory: dom });
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
      new InventoryHeaderRenderer({ domFactory: dom });
    const resolvedLoadoutRenderer =
      loadoutRenderer ||
      new InventoryLoadoutPanelRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        getEquippedLongPressDurationMs: () => LongPressController.EQUIPPED_DURATION_MS,
      });
    const resolvedAssemblyRenderer =
      assemblyRenderer ||
      new InventoryAssemblyEditorRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        parametersRenderer: itemParametersRenderer,
        createParameterSectionResolver: () => new InventoryAssemblyParameterSectionResolver(),
      });
    const resolvedSavedLoadoutRenderer =
      savedLoadoutRenderer ||
      new InventorySavedLoadoutPreviewRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
      });
    const resolvedInventoryRenderer =
      inventoryRenderer ||
      new InventoryGridRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        createHorizontalScrollController: () => new HorizontalScrollController(),
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
    };
  }
}
