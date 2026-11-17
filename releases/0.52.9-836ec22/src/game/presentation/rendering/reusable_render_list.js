export class ReusableRenderList {
  #items = [];
  #count = 0;
  #bufferId;
  #diagnostics;

  // diagnostics: the render allocation diagnostics port injected by composition (DEV), or null.
  constructor(bufferId = "renderList", diagnostics = null) {
    this.#bufferId = bufferId;
    this.#diagnostics = diagnostics;
  }

  reset() {
    this.#count = 0;
    return this;
  }

  acquire() {
    let record = this.#items[this.#count];
    if (!record) {
      record = {};
      this.#items[this.#count] = record;
      this.#diagnostics?.recordBufferGrowth(this.#bufferId);
    }
    this.#count += 1;
    return record;
  }

  forEachActive(callback) {
    if (typeof callback !== "function") {
      throw new TypeError("ReusableRenderList forEachActive requires callback");
    }
    for (let index = 0; index < this.#count; index += 1) {
      callback(this.#items[index], index);
    }
  }

  getAt(index) {
    const activeIndex = Math.floor(Number(index));
    return activeIndex >= 0 && activeIndex < this.#count
      ? this.#items[activeIndex]
      : null;
  }

  getActiveUnchecked(index) {
    return this.#items[index];
  }

  get count() {
    return this.#count;
  }

}
