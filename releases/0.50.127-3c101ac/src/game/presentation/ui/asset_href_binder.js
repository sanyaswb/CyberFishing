// Static markup names sprite symbols by asset id (spec 157 R16): <use data-asset-href="ui.status-icons#fish">. After the
// markup is inserted, this sets each href to the registry's file with the symbol, so the markup holds no file paths.
export function bindAssetHrefs(root, assets) {
  for (const use of root.querySelectorAll("[data-asset-href]")) {
    const [assetId, symbol = ""] = use.getAttribute("data-asset-href").split("#");
    use.setAttribute("href", symbol ? `${assets.pathOf(assetId)}#${symbol}` : assets.pathOf(assetId));
  }
}
