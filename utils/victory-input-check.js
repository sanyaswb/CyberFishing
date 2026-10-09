const { CheckAssertion } = require("./testing/core/check_assertion");
const { SourceRuntime } = require("./testing/core/source_runtime");

class EventTargetStub {
  constructor() {
    this.listeners = new Map();
    this.width = 1280;
    this.clientWidth = 1280;
  }

  addEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }

  removeEventListener(type, handler) {
    const handlers = this.listeners.get(type) || [];
    this.listeners.set(
      type,
      handlers.filter((candidate) => candidate !== handler),
    );
  }

  dispatch(type, event = {}) {
    const payload = { type, preventDefault() {}, ...event };
    for (const handler of this.listeners.get(type) || []) handler(payload);
  }
}

const Assertion = CheckAssertion.create("Victory input check");

class RuntimeLoader {
  load() {
    const windowTarget = new EventTargetStub();
    const clock = { now: 1000 };
    class TestDate extends Date {
      static now() {
        return clock.now;
      }
    }
    const runtime = new SourceRuntime({
      globals: {
        clearTimeout,
        setTimeout,
        Date: TestDate,
        window: windowTarget,
        TEST_CLOCK: clock,
        CONFIG: {
          input: {
            pullHoldMinMs: 120,
            keys: {},
          },
        },
      },
    });
    this.#run(runtime, "src/engine/math/vector2.js", ["Vector2"]);
    this.#run(runtime, "src/engine/events/event_lifecycle.js", ["EventLifecycle"]);
    this.#run(runtime, "src/platform/browser/input/input_controller.js", ["InputController"]);
    this.#run(
      runtime,
      "src/game/presentation/input/victory_action_gesture_resolver.js",
      ["VictoryActionGestureResolver"],
    );
    this.#run(
      runtime,
      "src/game/presentation/screens/victory_layout_resolver.js",
      ["VictoryLayoutResolver"],
    );
    this.#run(runtime, "src/game/application/state/victory_state.js", ["VictoryState"]);
    return runtime.context;
  }

  #run(runtime, relativePath, classNames) {
    runtime.load(relativePath, { expose: classNames });
  }
}

class VictoryStateFixture {
  constructor(runtime, inputBoundary) {
    this.transitions = [];
    this.layoutResolver = new runtime.VictoryLayoutResolver();
    this.viewport = { width: 1280, height: 720 };
    this.config = { ui: { victory: {} } };
    this.state = new runtime.VictoryState({
      input: inputBoundary,
      ui: {
        updateContinueButtonState() {},
        setOutcomeOverlayActive() {},
      },
      config: this.config,
      getViewportSize: () => this.viewport,
      victoryLayoutResolver: this.layoutResolver,
      victoryActionGestureResolver:
        new runtime.VictoryActionGestureResolver(),
      commands: {
        setState: (name) => this.transitions.push(name),
      },
    });
    this.state.enter({ fish: {} });
  }

  pointInside(actionName) {
    const actions = this.layoutResolver.resolve({
      width: this.viewport.width,
      height: this.viewport.height,
      config: this.config.ui.victory,
      statCount: 3,
    });
    const rect = actions[actionName];
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    };
  }

  handle(input) {
    this.state.handleInput(input);
  }
}

class VictoryInputCheck {
  constructor(runtime) {
    this.runtime = runtime;
  }

  run() {
    this.#rejectsFightGestureRelease();
    this.#acceptsHeldVictoryButtonPress();
    this.#rejectsPressStartedOutsideAction();
    this.#rejectsReleaseOnDifferentAction();
    this.#rejectsCancelledPointer();
    this.#acceptsReleaseAction();
    console.log("Victory input checks passed.");
  }

  #createInputManager() {
    const canvas = new EventTargetStub();
    return {
      canvas,
      manager: new this.runtime.InputController(canvas, null, {
        runtimeConfig: this.runtime.CONFIG,
        listeners: new this.runtime.EventLifecycle(),
      }),
    };
  }

  #rejectsFightGestureRelease() {
    const input = this.#createInputManager();
    const layoutFixture = new VictoryStateFixture(this.runtime, {
      getPointerGestureId: () => 0,
    });
    const point = layoutFixture.pointInside("claim");

    input.canvas.dispatch("pointerdown", {
      clientX: point.x,
      clientY: point.y,
    });
    const fixture = new VictoryStateFixture(this.runtime, input.manager);
    this.runtime.TEST_CLOCK.now += 1000;
    this.runtime.window.dispatch("pointerup", {
      clientX: point.x,
      clientY: point.y,
    });
    fixture.handle(input.manager.getState());

    Assertion.equal(
      fixture.transitions.length,
      0,
      "a gesture started during the fight must not activate Victory",
    );
    input.manager.dispose();
  }

  #acceptsHeldVictoryButtonPress() {
    const input = this.#createInputManager();
    const fixture = new VictoryStateFixture(this.runtime, input.manager);
    const point = fixture.pointInside("claim");

    input.canvas.dispatch("pointerdown", {
      clientX: point.x,
      clientY: point.y,
    });
    this.runtime.TEST_CLOCK.now += 1000;
    this.runtime.window.dispatch("pointerup", {
      clientX: point.x,
      clientY: point.y,
    });
    const releaseFrame = input.manager.getState();
    Assertion.equal(
      releaseFrame.clickPos,
      null,
      "a held pointer is not a short gameplay click",
    );
    fixture.handle(releaseFrame);

    Assertion.equal(
      fixture.transitions.at(-1),
      "scouting",
      "a held press released on the same Victory button must activate it",
    );
    input.manager.dispose();
  }

  #rejectsPressStartedOutsideAction() {
    const fixture = this.#createSyntheticFixture();
    fixture.handle(this.#releaseInput({
      start: { x: 0, y: 0 },
      end: fixture.pointInside("claim"),
    }));
    Assertion.equal(
      fixture.transitions.length,
      0,
      "pressing outside and releasing over a button must not activate it",
    );
  }

  #rejectsReleaseOnDifferentAction() {
    const fixture = this.#createSyntheticFixture();
    fixture.handle(this.#releaseInput({
      start: fixture.pointInside("claim"),
      end: fixture.pointInside("release"),
    }));
    Assertion.equal(
      fixture.transitions.length,
      0,
      "press and release must belong to the same Victory action",
    );
  }

  #rejectsCancelledPointer() {
    const fixture = this.#createSyntheticFixture();
    const point = fixture.pointInside("claim");
    fixture.handle(this.#releaseInput({
      start: point,
      end: point,
      cancelled: true,
    }));
    Assertion.equal(
      fixture.transitions.length,
      0,
      "pointer cancellation must not activate Victory",
    );
  }

  #acceptsReleaseAction() {
    const fixture = this.#createSyntheticFixture();
    const point = fixture.pointInside("release");
    const input = this.#releaseInput({ start: point, end: point });
    fixture.handle(input);
    Assertion.equal(
      fixture.transitions.at(-1),
      "scouting",
      "the Release action must use the same press-release behavior",
    );
    Assertion.equal(
      input.pointerReleased,
      false,
      "an accepted UI release must be consumed",
    );
  }

  #createSyntheticFixture() {
    return new VictoryStateFixture(this.runtime, {
      getPointerGestureId: () => 7,
    });
  }

  #releaseInput({ start, end, cancelled = false }) {
    return {
      pointerGestureId: 8,
      pointerReleased: true,
      pointerReleaseCancelled: cancelled,
      pointerStart: start,
      pointerRelease: end,
    };
  }
}

new VictoryInputCheck(new RuntimeLoader().load()).run();

// Shared fight-input coverage: independent result and edge-history owners, exercised on every frame.
function checkFightInputFrames() {
  const assert=require("node:assert/strict");
  const runtime=new SourceRuntime({globals:{window:{}}});
  runtime.load("src/game/application/input/fight_input_action_composer.js",{expose:["FightInputActionComposer"]});
  runtime.load("src/game/application/input/pull_input_mapper.js",{expose:["PullInputMapper"]});
  runtime.run('globalThis.inputFreezeCount=0; const originalInputFreeze=Object.freeze; Object.freeze=value=>{globalThis.inputFreezeCount++;return originalInputFreeze(value);};');
  const composer=new runtime.context.FightInputActionComposer(),mapper=new runtime.context.PullInputMapper();
  const before=runtime.run("globalThis.inputFreezeCount");
  let previousHeld=false,previousActions=null,mappedIdentity=null;
  for(let frame=0;frame<120;frame++){
    const held=frame%24<12,left=frame%3===0;
    const input={isPulling:held,keys:{KeyA:left},pointerDown:true,pointerDelta:{x:90,y:0}};
    const actions=composer.compose(input);
    assert.equal(actions.hold.active,held);
    assert.equal(actions.lateralControl.source,left?"keyboard":"pointer");
    assert.equal(actions.lateralControl.directionX,left?-1:1);
    assert.equal(actions.lateralControl.inputRatio,1);
    assert([actions,actions.hold,actions.lateralControl,actions.raw].every(Object.isFrozen));
    if(previousActions)assert.notEqual(actions,previousActions,"previous immutable snapshots remain detached");
    previousActions=actions;
    const mapped=mapper.update(input);
    if(mappedIdentity)assert.equal(mapped,mappedIdentity,"edge mapper reuses its output on every frame");
    mappedIdentity=mapped;
    assert.equal(mapped.pullHeld,held);assert.equal(mapped.pullStartedThisFrame,held&&!previousHeld);
    assert.equal(mapped.pullReleasedThisFrame,!held&&previousHeld);previousHeld=held;
  }
  assert.equal(runtime.run("globalThis.inputFreezeCount")-before,480,"original four frozen output objects per composed frame");
  assert.equal(composer.compose({fightActions:previousActions}),previousActions,"precomposed input returns the original identity");
  assert.equal(runtime.run("globalThis.inputFreezeCount")-before,480,"pass-through adds no frozen output allocation");
  mapper.reset();
  assert.equal(mappedIdentity.pullHeld,false);assert.equal(mappedIdentity.pullStartedThisFrame,false);assert.equal(mappedIdentity.pullReleasedThisFrame,false);
  assert.equal(mapper.update({isPulling:true}).pullStartedThisFrame,true,"reset clears prior held history");
  console.log("Fight input passed: 120 frames, control priority/clamps, unchanged four frozen outputs per compose, pass-through identity, reused edge state and reset.");
}
checkFightInputFrames();
