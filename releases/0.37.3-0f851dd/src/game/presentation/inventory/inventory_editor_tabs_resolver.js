// Tabs of the phone item editor (spec 091): the editor's root item first, then every addressed cell of the model in
// its order (an equipped rod's equipment cells or an assembly's sockets), then the nested items that only have
// parameters (an equipped rod's leader, hooks, baits, chum). Each cell keeps its own tab: equal items in different
// cells are never merged. A key names the address, not the item in it, so a tab survives a replaced or removed item.
export class InventoryEditorTabsResolver {
  resolve(model = {}) {
    const root = model.root || null;
    if (!root) return Object.freeze([]);
    const rootInstanceId = root.instanceId || model.rootInstanceId || "";
    const tabs = [Object.freeze({ key: `root:${rootInstanceId}`, kind: "root", item: root, label: root.name || model.rootLabel })];
    const shown = new Set([rootInstanceId]);
    for (const socket of model.sockets || []) {
      const key = ["socket", socket.parentInstanceId || rootInstanceId, socket.socketId, socket.slotId, socket.slotIndex]
        .join(":");
      tabs.push(Object.freeze({ key, kind: "socket", item: socket.item || null, socket, label: socket.label }));
      if (socket.item?.instanceId) shown.add(socket.item.instanceId);
    }
    for (const item of model.parameterItems || []) {
      if (!item?.instanceId || shown.has(item.instanceId)) continue;
      shown.add(item.instanceId);
      tabs.push(Object.freeze({ key: `item:${item.instanceId}`, kind: "view", item, label: item.name }));
    }
    return Object.freeze(tabs);
  }
}
