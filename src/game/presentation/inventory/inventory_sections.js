// Inventory sections in tab order; icons are symbols of assets/ui/inventory-sections.svg.
export const INVENTORY_SECTIONS = Object.freeze({
  label: "Розділи інвентарю",
  iconSprite: "assets/ui/inventory-sections.svg",
  defaultSectionId: "equipment",
  items: Object.freeze([
    Object.freeze({ id: "equipment", icon: "equipment", label: "Екіпіровка" }),
    Object.freeze({ id: "backpack", icon: "backpack", label: "Рюкзак" }),
    Object.freeze({ id: "keepnet", icon: "keepnet", label: "Садок" }),
  ]),
});
