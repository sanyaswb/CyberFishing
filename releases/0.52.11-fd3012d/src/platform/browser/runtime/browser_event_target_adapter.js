export class BrowserEventTargetAdapter {
  constructor(target) {
    this.target = target;
  }

  add(type, handler, options) {
    this.target.addEventListener(type, handler, options);
    return () => this.target.removeEventListener(type, handler, options);
  }

  emit(type, detail) {
    this.target.dispatchEvent(new CustomEvent(type, { detail }));
  }
}
