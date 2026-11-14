// Active listener count for the DEV memory watchdog. Development startup creates one per page and gives it to the
// event lifecycles, event buses and input controller it composes; production composes none.
export class ManagedListenerCounter {
  #activeCount = 0;

  added() {
    this.#activeCount += 1;
  }

  removed(count = 1) {
    this.#activeCount = Math.max(0, this.#activeCount - count);
  }

  getActiveCount() {
    return this.#activeCount;
  }
}
