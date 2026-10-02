/**
 * Platform diagnostics: forwards log, warning and error output to the browser console.
 * Composition injects it wherever a rule or entity reports diagnostics.
 */
export class ConsoleLogger {
  log(...args) {
    console.log(...args);
  }

  warn(...args) {
    console.warn(...args);
  }

  error(...args) {
    console.error(...args);
  }

  groupCollapsed(...args) {
    console.groupCollapsed?.(...args);
  }

  table(data) {
    if (typeof console.table === "function") {
      console.table(data);
    } else {
      console.log(data);
    }
  }

  groupEnd() {
    console.groupEnd?.();
  }
}
