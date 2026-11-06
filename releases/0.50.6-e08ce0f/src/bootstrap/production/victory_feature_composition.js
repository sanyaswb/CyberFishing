import { VictoryActionGestureResolver } from "../../game/presentation/input/victory_action_gesture_resolver.js";
import { VictoryLayoutResolver } from "../../game/presentation/screens/victory_layout_resolver.js";
import { VictoryRenderer } from "../../game/presentation/screens/victory_renderer.js";
import { VictoryThemeResolver } from "../../game/presentation/screens/victory_theme_resolver.js";
import { StarRatingRenderer } from "../../game/presentation/screens/star_rating_renderer.js";

// Composition of the victory outcome screen (spec 100, 157 R12, TK-184) as a feature loaded after ready.
export function composeVictoryFeature({
  diagnostics = null,
  surface,
  primitives,
  assets,
  rarityVisualResolver,
}) {
  const victoryLayoutResolver = new VictoryLayoutResolver({ diagnostics });
  const victoryActionGestureResolver = new VictoryActionGestureResolver();
  const starRatingRenderer = new StarRatingRenderer({ surface, primitives });
  const themeResolver = new VictoryThemeResolver({ rarityVisualResolver });
  const victoryRenderer = new VictoryRenderer({
    surface,
    primitives,
    assets,
    themeResolver,
    starRatingRenderer,
  });
  return {
    victoryLayoutResolver,
    victoryActionGestureResolver,
    victoryRenderer,
  };
}
