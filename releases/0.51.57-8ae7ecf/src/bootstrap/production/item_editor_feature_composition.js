import { HorizontalScrollController } from "../../platform/browser/dom/horizontal_scroll_controller.js";
import { SwipePagerController } from "../../platform/browser/dom/swipe_pager_controller.js";
import { ScrollContainerAligner } from "../../platform/browser/dom/scroll_container_aligner.js";
import { InventoryLongPressController as LongPressController } from "../../platform/browser/dom/inventory_long_press_controller.js";
import { InventoryAssemblyEditorRenderer } from "../../game/presentation/inventory/inventory_assembly_editor_renderer.js";
import { InventoryEditorTabsRenderer } from "../../game/presentation/inventory/inventory_editor_tabs_renderer.js";
import { InventoryEditorTabsResolver } from "../../game/presentation/inventory/inventory_editor_tabs_resolver.js";
import { INVENTORY_EDITOR_TABS_LABELS } from "../../game/presentation/inventory/inventory_editor_tabs_labels.js";
import { INVENTORY_EDITOR_CONFIG } from "../../game/presentation/inventory/inventory_editor_config.js";
import { InventoryRodRemovalRenderer } from "../../game/presentation/inventory/inventory_rod_removal_renderer.js";

// Composition of the item assembly editor (spec 091, 094, 142) as a feature loaded after ready (spec 157 R12, TK-184).
export function composeItemEditorRenderer({
  domFactory,
  itemRenderer,
  parametersRenderer,
  deviceControlsRenderer,
  uiSurface,
  swipeEnabled = null,
}) {
  return new InventoryAssemblyEditorRenderer({
    domFactory,
    scrollbarEnabled: INVENTORY_EDITOR_CONFIG.scrollbar.enabled,
    itemRenderer,
    parametersRenderer,
    deviceControlsRenderer,
    rodRemovalRenderer: new InventoryRodRemovalRenderer({ domFactory }),
    tabsRenderer: new InventoryEditorTabsRenderer({
      domFactory,
      resolver: new InventoryEditorTabsResolver(),
      itemRenderer,
      parametersRenderer,
      swipeController: new SwipePagerController({
        isEnabled: swipeEnabled ?? ((node) => domFactory.view.getComputedStyle(node).getPropertyValue("--inventory-editor-swipe").trim() === "on"),
        positionProperty: null,
        draggingClassName: "inventory-editor-tabs__panel--dragging",
      }),
      rowScrollController: new HorizontalScrollController({ uiSurface }),
      labels: INVENTORY_EDITOR_TABS_LABELS,
      longPressDurationMs: LongPressController.EQUIPPED_DURATION_MS,
      scrollAligner: new ScrollContainerAligner({ windowRef: domFactory.view }),
    }),
  });
}
