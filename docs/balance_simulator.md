# Balance simulator

`utils/diagnostics/simulate-simple-fish-force.js` runs the simplified force
calculator without Canvas.

This is a manual diagnostic. It does not execute the complete modern fight
pipeline and must not be used as proof that gameplay integration works.

The simulator should be used to validate:

- fish passive force;
- fish active force;
- rod hold max;
- hold-to-tension ratio;
- movable fish tension cap;
- total tension;
- rod/line/hook stress;
- movement winner and speed.

The simulator no longer depends on the old `FishPullResistanceModel`.
