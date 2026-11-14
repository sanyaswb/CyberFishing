export class ItemAssemblyPath {
  static parse(path) {
    if (typeof path !== "string" || path.trim().length === 0) {
      throw new TypeError("Assembly path must be a non-empty string");
    }
    return path.split(".").map((rawSegment) => {
      const match = rawSegment.match(/^([A-Za-z][A-Za-z0-9_-]*)(?:\[(\d+)\])?$/);
      if (!match) throw new RangeError(`Invalid assembly path segment: ${rawSegment}`);
      return {
        slotId: match[1],
        slotIndex: match[2] == null ? 0 : Number(match[2]),
      };
    });
  }
}
