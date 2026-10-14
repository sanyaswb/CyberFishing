class TestElement {
  constructor(document, tag) {
    this.document = document; this.tagName = tag; this.children = []; this.parentNode = null;
    this.dataset = {}; this.attributes = {}; this.listeners = new Map(); this.hidden = false;
    this.className = ""; this.value = ""; this.scrollTop = 0; this.text = "";
    const properties = new Map();
    this.style = {
      setProperty: (name, value) => properties.set(name, String(value)),
      getPropertyValue: (name) => properties.get(name) || "",
    };
    this.classList = {
      add: (name) => { this.className = [...new Set([...this.className.split(" "), name])].join(" "); },
      remove: (name) => { this.className = this.className.split(" ").filter((entry) => entry !== name).join(" "); },
      contains: (name) => this.className.split(" ").includes(name),
      toggle: (name, force = undefined) => {
        const enabled = force === undefined ? !this.className.split(" ").includes(name) : Boolean(force);
        if (enabled) this.classList.add(name); else this.classList.remove(name);
        return enabled;
      },
    };
  }
  get childNodes() { return this.children; }
  set textContent(value) { this.replaceChildren(); this.text = String(value); }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(""); }
  append(...children) { for (const child of children) { child.remove(); child.parentNode = this; this.children.push(child); } }
  appendChild(child) { this.append(child); return child; }
  replaceChildren(...children) { for (const child of [...this.children]) child.remove(); this.text = ""; this.append(...children); }
  remove() {
    if (this.contains(this.document.activeElement)) this.document.activeElement = this.document.body;
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  contains(element) { return element === this || this.children.some((child) => child.contains(element)); }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  removeAttribute(key) { delete this.attributes[key]; }
  getAttribute(key) { return this.attributes[key] ?? null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  fire(type, fields = {}) {
    const event = { target: this, key: "", shiftKey: false, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...fields };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
  focus() { this.document.activeElement = this; }
  click() { this.focus(); this.fire("click"); }
}

class TestDocument {
  constructor() { this.body = new TestElement(this, "body"); this.activeElement = this.body; this.listeners = new Map(); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  fire(type, fields = {}) {
    const event = { target: this.body, stopped: false, stopPropagation() { this.stopped = true; }, ...fields };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
  createElement(tag) { return new TestElement(this, tag); }
  all(predicate, root = this.body) {
    return [...(predicate(root) ? [root] : []), ...root.children.flatMap((child) => this.all(predicate, child))];
  }
  byClass(name) { return this.all((element) => element.className.split(" ").includes(name)); }
  byKey(key) { return this.all((element) => element.dataset.keepnetFocus === key)[0]; }
}
module.exports = { TestDocument };
