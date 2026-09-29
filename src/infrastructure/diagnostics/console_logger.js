/**
 * Platform diagnostics: forwards log, warning and error output to the browser console.
 * Composition injects it wherever a rule or entity reports diagnostics.
 */
class ConsoleLogger {
  log(...args) {
    console.log(...args);
  }

  warn(...args) {
    console.warn(...args);
  }

  error(...args) {
    console.error(...args);
  }
}
