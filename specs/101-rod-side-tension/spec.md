# Rod side tension compensation and cast line feedback

Owner request: 2026-10-17. Status: implemented and checked in v0.40.0; owner play acceptance pending.

## Requirements

- Only when `physics.fight.rodControl.alignment.enabled = false`, moving the rod toward the side occupied by the fish progressively compensates line tension. Fish location determines the side, independently of fish velocity or dash direction.
- Owner clarified: actual on-screen displacement is required. Holding against either the aim limit or the location/canvas clamp gives no compensation. Automatic return gives none. Stop, reversal away from the fish, disabled control or alignment mode clears the accumulated relief immediately; the visible meter keeps its normal smoothing.
- Greater tension relative to the rod limit produces faster relief, allowing a timed stroke toward the fish to compensate a dash. Balance belongs in injected runtime configuration and is live-editable.
- Compensation affects supported/raw line tension and tackle stress, including rod bend readings, rather than only the HUD. It does not cancel the fish's dash velocity, modify its force/AI, recover line, or directly change stamina.
- While waiting or biting, real lateral rod movement uses the existing line tightening/straightening response. After motion stops it relaxes using the existing line response. Explicit retrieval retains its behavior.
- Before hooking, lateral rod motion makes the float lean opposite the rod displacement via its existing pull impulse. Tilt must not trigger passive retrieval or depth rise. The established motion angle/response/decay configuration remains authoritative. Existing sinking and bite animation layers retain their behavior.
- Add independent `lineTension.enabled` and `floatTilt.enabled` under `physics.castRodControl`, both true by default. Preserve normal/guaranteed bite handling, float disturbance bite chance, spinning exemption, save format and unrelated owner changes.

## Ownership and integration

- The application rod motion model is composed in bootstrap and injected into the viewport. Presentation reads its position. The pre-physics application update measures clamped screen displacement and publishes one reused motion observation into the fight context. This ordering applies only to the new free-alignment compensation mode; other fight aim ordering remains unchanged.
- `RodSideTensionCompensation` is a stateless Domain policy. `FightLandingTensionStage` owns the accumulated relief for its fight session. Preview calculations do not advance it; the final tension stage advances it once.
- Waiting/biting pass actual cast displacement to the float. The renderer reads the cast controller's reused movement frame and drives the existing line response. Neither rendering nor DEV owns compensation or bite state.

## Validation

- First deterministic reproduction: `node utils/checks/gameplay/rod-side-tension-check.js` failed because moving toward the fish left 8 kg unchanged. It now verifies both sides, dash scaling, stop/return/limits, disabled/live settings, partial strokes, 30/60/120 Hz consistency, pure previews, accumulation and actual tackle stress.
- The same focused check verifies opposite float tilt, settling and unchanged position/velocity/depth. Cast, application-composition and render-composition checks verify propagation of real movement, same-frame rod measurement, held limits, pointer retrieval isolation and the existing line response. Application projection scratch space uses `Vector2`; the production projector's `out.set()` contract is enforced by the composition fixture after a browser reproduction exposed the old plain-object scratch value.
- Architecture: 4 checks passed; Quick: 29; Full: 55. The existing game-cycle report/baseline is unchanged. Windows temporary filesystem fixture checks ran outside the sandbox for junction/rename support.
- Browser smoke: `index.html` and `dev.html` load v0.40.0 without console errors/warnings. Production post-cast lateral motion/line feedback and DEV guaranteed lateral strike into `playing` were observed. DEV exposes compensation defaults enabled/4/1/0.001. The random browser fight did not provide a controlled dash load; deterministic checks provide evidence for dash load compensation. Owner play acceptance is still required for compensation strength and animation feel.
- Local ignored browser evidence: [production rod and line](../../utils/generated/rod-side-tension/index-line.png), [DEV configuration](../../utils/generated/rod-side-tension/dev-config.png).
- Owner instruction: further visual tests and visual/feel acceptance are reserved for the owner. No additional browser testing is required from the agent.
