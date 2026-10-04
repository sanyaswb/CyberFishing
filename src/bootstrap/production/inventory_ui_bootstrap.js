import { HorizontalScrollController } from "../../platform/browser/dom/horizontal_scroll_controller.js";
import { InventoryV2ActionContract, InventoryV2ActionType, InventoryV2FacadeContract, InventoryV2ViewModelNormalizer } from "../../game/presentation/inventory/inventory_view_model.js";
import { InventoryV2AssemblyEditorRenderer } from "../../game/presentation/inventory/inventory_assembly_editor_renderer.js";
import { InventoryV2AssemblyParameterSectionResolver } from "../../game/presentation/inventory/inventory_assembly_parameter_section_resolver.js";
import { InventoryV2AttachmentBadgeRenderer } from "../../game/presentation/inventory/inventory_attachment_badge_renderer.js";
import { InventoryV2BalanceParameterResolver } from "../../game/presentation/inventory/inventory_balance_parameter_resolver.js";
import { InventoryV2DomFactory } from "../../platform/browser/dom/inventory_v2_dom_factory.js";
import { InventoryV2HeaderRenderer } from "../../game/presentation/inventory/inventory_header_renderer.js";
import { InventoryV2InventoryGridRenderer } from "../../game/presentation/inventory/inventory_grid_renderer.js";
import { InventoryV2ItemCardRenderer } from "../../game/presentation/inventory/inventory_item_card_renderer.js";
import { InventoryV2ItemParametersRenderer } from "../../game/presentation/inventory/inventory_item_parameters_renderer.js";
import { InventoryV2ItemParametersResolver } from "../../game/presentation/inventory/inventory_item_parameters_resolver.js";
import { InventoryV2LoadoutPanelRenderer } from "../../game/presentation/inventory/inventory_loadout_panel_renderer.js";
import { InventoryV2LongPressController } from "../../platform/browser/dom/inventory_v2_long_press_controller.js";
import { InventoryV2ResourceMeterRenderer } from "../../game/presentation/inventory/inventory_resource_meter_renderer.js";
import { InventoryV2ResourceMeterResolver } from "../../game/presentation/inventory/inventory_v2_resource_meter_resolver.js";
import { InventoryV2SavedLoadoutPreviewRenderer } from "../../game/presentation/inventory/inventory_saved_loadout_preview_renderer.js";
import { InventoryV2TooltipPresenter } from "../../game/presentation/inventory/inventory_tooltip_presenter.js";
import { InventoryV2UI } from "../../game/presentation/inventory/inventory_ui.js";

export class InventoryV2Bootstrap {
  static create({ autoMount = true, autoOpen = false, ...options } = {}) {
    const ui = new InventoryV2UI({
      ...options,
      facadeContract: InventoryV2FacadeContract,
      actionContract: InventoryV2ActionContract,
      actionTypes: InventoryV2ActionType,
      createPresentation: (presentationOptions) => InventoryV2Bootstrap.#createPresentation(presentationOptions),
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
    const LongPressController = InventoryV2LongPressController;
    const dom = new InventoryV2DomFactory(documentRef);
    const resolvedNormalizer =
      normalizer || new InventoryV2ViewModelNormalizer();
    const resolvedLongPressController =
      longPressController || new LongPressController({
        degradationColorResolver,
      });
    const resolvedTooltipPresenter =
      tooltipPresenter ||
      new InventoryV2TooltipPresenter({
        documentRef,
        getView: () => dom.view,
        rarityDomAdapter,
        balanceParameterResolver:
          balanceParameterResolver ||
          new InventoryV2BalanceParameterResolver({
            rarityVisualResolver,
          }),
      });

    const attachmentRenderer =
      new InventoryV2AttachmentBadgeRenderer({
        domFactory: dom,
      });
    const resolvedResourceMeterResolver =
      resourceMeterResolver || new InventoryV2ResourceMeterResolver();
    const resolvedResourceMeterRenderer =
      resourceMeterRenderer ||
      new InventoryV2ResourceMeterRenderer({ domFactory: dom });
    const itemParametersResolver =
      new InventoryV2ItemParametersResolver({
        resourceMeterResolver: resolvedResourceMeterResolver,
        progressionDomAdapter,
        rarityVisualResolver,
      });
    const itemParametersRenderer =
      new InventoryV2ItemParametersRenderer({
        domFactory: dom,
        resolver: itemParametersResolver,
        resourceMeterRenderer: resolvedResourceMeterRenderer,
      });
    const resolvedItemRenderer = new InventoryV2ItemCardRenderer({
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
      new InventoryV2HeaderRenderer({ domFactory: dom });
    const resolvedLoadoutRenderer =
      loadoutRenderer ||
      new InventoryV2LoadoutPanelRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        getEquippedLongPressDurationMs: () => LongPressController.EQUIPPED_DURATION_MS,
      });
    const resolvedAssemblyRenderer =
      assemblyRenderer ||
      new InventoryV2AssemblyEditorRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
        parametersRenderer: itemParametersRenderer,
        createParameterSectionResolver: () => new InventoryV2AssemblyParameterSectionResolver(),
      });
    const resolvedSavedLoadoutRenderer =
      savedLoadoutRenderer ||
      new InventoryV2SavedLoadoutPreviewRenderer({
        domFactory: dom,
        itemRenderer: resolvedItemRenderer,
      });
    const resolvedInventoryRenderer =
      inventoryRenderer ||
      new InventoryV2InventoryGridRenderer({
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
