class CheckAssertion {
  static create(scope) {
    const normalizedScope = String(scope || "Check").trim();

    return class ScopedAssertion {
      static that(condition, message) {
        if (!condition) {
          throw new Error(`${normalizedScope} failed: ${message}`);
        }
      }

      static equal(actual, expected, message) {
        this.that(
          Object.is(actual, expected),
          `${message}; expected ${expected}, received ${actual}`,
        );
      }

      static deepEqual(actual, expected, message) {
        this.equal(JSON.stringify(actual), JSON.stringify(expected), message);
      }

      static jsonEqual(actual, expected, message) {
        this.deepEqual(actual, expected, message);
      }

      static near(actual, expected, message, epsilon = 1e-9) {
        this.that(
          Math.abs(actual - expected) <= epsilon,
          `${message}; expected ${expected}, received ${actual}`,
        );
      }

      static close(actual, expected, message, epsilon = 0.000001) {
        this.near(actual, expected, message, epsilon);
      }

      static throws(action, message) {
        let thrown = false;
        try {
          action();
        } catch (_error) {
          thrown = true;
        }
        this.that(thrown, `${message}; expected an error`);
      }

      static throwsCode(action, code, message) {
        let error = null;
        try {
          action();
        } catch (caught) {
          error = caught;
        }
        this.that(error, `${message}; expected an error`);
        this.equal(error.code, code, message);
      }
    };
  }
}

module.exports = { CheckAssertion };
