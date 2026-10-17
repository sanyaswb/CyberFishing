// Reads a Spine 4.x atlas text without the runtime (spec 099): page names, sizes, filters and PMA, and region bounds.
// The bundle loader needs the page names before the runtime is imported; the static rod picture needs a region.
// Format: a page block starts at the first line or after a blank line with the page name; "key:value" lines belong
// to the current region (or the page before any region); a line without ":" starts a region.
export class SpineAtlasTextReader {
  static read(text) {
    if (typeof text !== "string" || text.trim() === "") throw new Error("SpineAtlasTextReader: empty atlas");
    const pages = [];
    let page = null;
    let region = null;
    let expectPage = true;
    for (const rawLine of text.split(/\r\n|\n|\r/u)) {
      const line = rawLine.trim();
      if (line === "") {
        expectPage = true;
        continue;
      }
      if (expectPage) {
        page = { name: line, width: 0, height: 0, pma: false, minFilter: "Nearest", magFilter: "Nearest", regions: [] };
        pages.push(page);
        region = null;
        expectPage = false;
        continue;
      }
      const colon = line.indexOf(":");
      if (colon < 0) {
        region = { name: line, x: 0, y: 0, width: 0, height: 0, rotate: 0, index: -1 };
        page.regions.push(region);
        continue;
      }
      const key = line.slice(0, colon).trim();
      const values = line.slice(colon + 1).split(",").map((value) => value.trim());
      if (region) SpineAtlasTextReader.#regionValue(region, key, values);
      else SpineAtlasTextReader.#pageValue(page, key, values);
    }
    for (const entry of pages) {
      if (!(entry.width > 0 && entry.height > 0)) throw new Error(`SpineAtlasTextReader: page ${entry.name} has no size`);
      if (/^[a-z]+:|^\/|(^|\/)\.\.(\/|$)/iu.test(entry.name)) {
        throw new Error(`SpineAtlasTextReader: page ${entry.name} must be a relative file name`);
      }
    }
    return { pages };
  }

  static #pageValue(page, key, values) {
    if (key === "size") [page.width, page.height] = values.map(Number);
    else if (key === "filter") [page.minFilter, page.magFilter] = values;
    else if (key === "pma") page.pma = values[0] === "true";
  }

  static #regionValue(region, key, values) {
    if (key === "bounds") [region.x, region.y, region.width, region.height] = values.map(Number);
    else if (key === "rotate") region.rotate = values[0] === "true" ? 90 : values[0] === "false" ? 0 : Number(values[0]) || 0;
    else if (key === "index") region.index = Number(values[0]);
  }
}
