// Inventory sections in tab order; icons are symbols of the sections sprite (asset ui.inventory-sections). Art is named
// by asset id (spec 157 R16). The root modifier and host class names are literal so the style guard can reach them
// (spec 068).
export const INVENTORY_SECTIONS = Object.freeze({
  label: "Розділи інвентарю",
  iconSpriteAsset: "ui.inventory-sections",
  defaultSectionId: "equipment",
  backpackAsset: "items.briefcases.briefcase--1--close",
  backpackBackdropAsset: "items.briefcases.briefcase--1--open",
  // A scale icon is interface: the vector backpack icon, never item artwork (DESIGN_RULES.md).
  backpackCapacityIconAsset: "ui.inventory.backpack",
  // Presentation scale only (spec 075): gameplay inventory capacity stays unlimited.
  backpackCapacity: Object.freeze({ maxItems: 100 }),
  labels: Object.freeze({
    backpackItems: (count, maxItems) => `Предметів у рюкзаку: ${count} з ${maxItems}`,
  }),
  items: Object.freeze([
    Object.freeze({ id: "equipment", icon: "equipment", label: "Екіпіровка",
      modifier: "inventory-modal--section-equipment", hostClass: "inventory-main__section--equipment" }),
    Object.freeze({ id: "backpack", icon: "backpack", label: "Рюкзак",
      modifier: "inventory-modal--section-backpack", hostClass: "inventory-main__section--backpack" }),
    Object.freeze({ id: "keepnet", icon: "keepnet", label: "Садок",
      modifier: "inventory-modal--section-keepnet", hostClass: "inventory-main__section--keepnet" }),
  ]),
  // The portrait backpack pager (spec 075): the item list on the left page, the backpack view on the right.
  backpackPager: Object.freeze({
    label: "Вміст рюкзака",
    iconSpriteAsset: "ui.inventory-sections",
    items: Object.freeze([
      Object.freeze({ id: "items", icon: "items", label: "Предмети" }),
      Object.freeze({ id: "backpack", icon: "backpack", label: "Рюкзак" }),
    ]),
  }),
  // The portrait keepnet pager (spec 088): the fish list on the left page, the keepnet view on the right. The capacity
  // scale uses the status sprite's fish icon (the House capacity icon).
  keepnetPager: Object.freeze({
    label: "Вміст садка",
    iconSpriteAsset: "ui.inventory-sections",
    capacityIconAsset: "ui.status-icons",
    capacityIconSymbol: "fish",
    items: Object.freeze([
      Object.freeze({ id: "fish", icon: "fish", label: "Риба" }),
      Object.freeze({ id: "keepnet", icon: "keepnet", label: "Садок" }),
    ]),
  }),
});
