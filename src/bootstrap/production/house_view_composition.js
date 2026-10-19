import { HouseView } from "../../game/presentation/house/house_view.js";
import { HouseNavigationController } from "../../game/presentation/house/house_navigation_controller.js";
import { HouseRoomView } from "../../game/presentation/house/house_room_view.js";
import { HouseLevelCard } from "../../game/presentation/house/house_level_card.js";
import { HouseFishListView } from "../../game/presentation/house/house_fish_list_view.js";
import { composeHintRenderer } from "./hint_renderer_composition.js";

// One House view composition for the House screen and the DEV UI catalog (which passes a preview-scoped document).
// rootNode is the screen root that receives the view's delegated events (spec 084).
export function composeHouseView({ documentRef, rootNode, windowTarget, domFactory, perform, roomConfig, uiConfig, labels,
  onReturn, fishView, feedPicker, resourceMeters, sheetHeights, sheetHandleRenderer, autoSwitchRenderer, timeBlendMs, uiSurface = null }) {
  const node = (name) => documentRef.querySelector(`[data-house-${name}]`);
  const navigation = new HouseNavigationController({ documentRef, rootNode, windowTarget, sheetHeights, sheetHandleRenderer,
    sheetDismissLabel: labels.sheetDismiss, menuHandleLabel: labels.menuHandle, feedPicker });
  const roomView = new HouseRoomView({ documentRef, roomConfig, labels, timeBlendMs,
    levelCard: new HouseLevelCard({ domFactory, segments: node("room-segments"), list: node("room-level-list"), labels }) });
  return new HouseView({ documentRef, rootNode, windowTarget, perform, uiConfig, onReturn, fishView, feedPicker,
    resourceMeters, autoSwitchRenderer, hintRenderer: composeHintRenderer({ domFactory, uiSurface, timers: windowTarget }), labels, navigation, roomView,
    aquariumLevelCard: new HouseLevelCard({ domFactory, segments: node("aquarium-segments"), labels }),
    liveBaitList: new HouseFishListView({ domFactory, container: node("live-baits"), live: true, labels }),
    keepnetList: new HouseFishListView({ domFactory, container: node("catches"), live: false, labels }) });
}
