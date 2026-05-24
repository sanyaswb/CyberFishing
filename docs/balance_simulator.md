# Balance simulator

The headless simulator runs a simplified fight loop without Canvas. It is meant for balance checks, not for rendering or exact player input reproduction.

Run the default scenario:

```bash
node utils/simulate-fish-fight.js
```

Example scenario:

```bash
node utils/simulate-fish-fight.js \
  --fish=perch_radioactive \
  --weightKg=0.6 \
  --durationSec=60 \
  --lineMaxLoadKg=2 \
  --dragLimitKg=1.4 \
  --playerPullPressureKg=0.9 \
  --behavior=swim
```

The report includes:

```txt
max tension
average tension
line break risk
time to land
average retrieve speed
fish exhaustion curve
```

Assumptions:

- fish distance starts at `startDistanceMeters`;
- player pressure is constant unless changed by arguments;
- behavior state is fixed for deterministic testing;
- retrieve movement uses `FishPullResistanceModel`;
- final tension uses `TensionSystem`.
