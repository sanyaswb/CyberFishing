import { HouseView } from "../../game/presentation/house/house_view.js";
import { HouseNavigationController } from "../../game/presentation/house/house_navigation_controller.js";
import { HouseRoomView } from "../../game/presentation/house/house_room_view.js";
import { HouseLevelCard } from "../../game/presentation/house/house_level_card.js";
import { HouseFishListView } from "../../game/presentation/house/house_fish_list_view.js";

// One House view composition for the House page and the DEV UI catalog (which passes a preview-scoped document).
export function composeHouseView({ documentRef, windowTarget, domFactory, perform, roomConfig, uiConfig, labels,
  returnTo, onReturn, fishView, feedPicker, resourceMeters, sheetHeights, sheetHandleRenderer, autoSwitchRenderer, timeBlendMs }) {
  const node = (name) => documentRef.querySelector(`[data-house-${name}]`);
  const navigation = new HouseNavigationController({ documentRef, windowTarget, sheetHeights, sheetHandleRenderer,
    sheetDismissLabel: labels.sheetDismiss, menuHandleLabel: labels.menuHandle, feedPicker });
  const roomView = new HouseRoomView({ documentRef, roomConfig, labels, timeBlendMs,
    levelCard: new HouseLevelCard({ domFactory, segments: node("room-segments"), list: node("room-level-list"), labels }) });
  return new HouseView({ documentRef, windowTarget, perform, uiConfig, returnTo, onReturn, fishView, feedPicker,
    resourceMeters, autoSwitchRenderer, labels, navigation, roomView,
    aquariumLevelCard: new HouseLevelCard({ domFactory, segments: node("aquarium-segments"), labels }),
    liveBaitList: new HouseFishListView({ domFactory, container: node("live-baits"), live: true, labels }),
    keepnetList: new HouseFishListView({ domFactory, container: node("catches"), live: false, labels }) });
}
