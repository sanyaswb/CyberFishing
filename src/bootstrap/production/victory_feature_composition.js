import { InventoryDomFactory } from "../../platform/browser/dom/inventory_dom_factory.js";
import { RarityStarsRenderer } from "../../game/presentation/ui/rarity_stars_renderer.js";
import { VICTORY_LABELS } from "../../game/presentation/screens/victory_labels.js";
import { VictoryThemeResolver } from "../../game/presentation/screens/victory_theme_resolver.js";
import { VictoryViewModelBuilder } from "../../game/presentation/screens/victory_view_model_builder.js";
import { VictoryWeightScaleRenderer } from "../../game/presentation/screens/victory_weight_scale_renderer.js";
import { VictoryWindow } from "../../game/presentation/screens/victory_window.js";

// The victory window (spec 161) as a feature loaded after ready (spec 157 R12, TK-184): a DOM dialog in the UI
// surface's portals, built once. show(fish, { onAction }) fills it from the caught fish; hide() closes it.
export function composeVictoryFeature({ documentRef, assets, mountNode, rarityVisualResolver, resolveFishImage, species }) {
  const domFactory = new InventoryDomFactory(documentRef, { assets });
  const viewModels = new VictoryViewModelBuilder({ themeResolver: new VictoryThemeResolver({ rarityVisualResolver }),
    resolveFishImage, species });
  const window = new VictoryWindow({ domFactory, mountNode, labels: VICTORY_LABELS,
    stars: new RarityStarsRenderer({ documentRef }),
    scale: new VictoryWeightScaleRenderer({ documentRef, format: VICTORY_LABELS.scaleValue }),
    icons: { sprite: "ui.status-icons", weight: "ui.inventory.weight" } });
  return Object.freeze({
    show: (fish, handlers) => window.show(viewModels.build(fish), handlers),
    hide: () => window.hide(),
    dispose: () => window.dispose(),
  });
}
