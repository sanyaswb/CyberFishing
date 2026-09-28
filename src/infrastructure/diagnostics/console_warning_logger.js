/**
 * Platform diagnostics: forwards non-fatal warnings to the browser console.
 * Composition injects it wherever a rule reports such a warning.
 */
class ConsoleWarningLogger {
  warn(...args) {
    console.warn(...args);
  }
}
