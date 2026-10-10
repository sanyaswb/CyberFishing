export class GridCell {
  constructor(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.depth = 0;
    this.isWater = false;
    this.isCastable = false;
    this.hasCollision = false;
    this.hasSnag = false;
  }
}
