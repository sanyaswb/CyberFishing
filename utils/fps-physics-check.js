const FPS_CASES = [30, 60, 144];
const DURATION_SEC = 5;
const TOLERANCE_RATIO = 0.02;

function simulate({ fps, initialVelocityPxPerSec, dampingPerSecond }) {
  let position = 0;
  let velocity = initialVelocityPxPerSec;
  let elapsed = 0;

  while (elapsed < DURATION_SEC - Number.EPSILON) {
    const dtSec = Math.min(1 / fps, DURATION_SEC - elapsed);
    position += velocity * dtSec;
    velocity *= Math.exp(-dampingPerSecond * dtSec);
    elapsed += dtSec;
  }

  return position;
}

const results = FPS_CASES.map((fps) => ({
  fps,
  distancePx: simulate({
    fps,
    initialVelocityPxPerSec: 160,
    dampingPerSecond: 0.35,
  }),
}));

const averageDistance =
  results.reduce((sum, result) => sum + result.distancePx, 0) / results.length;

const failed = results.filter((result) => {
  const ratio = Math.abs(result.distancePx - averageDistance) / averageDistance;
  result.deltaPercent = ratio * 100;
  return ratio > TOLERANCE_RATIO;
});

for (const result of results) {
  console.log(
    `${result.fps} FPS: ${result.distancePx.toFixed(3)} px ` +
      `(${result.deltaPercent.toFixed(3)}% from average)`,
  );
}

if (failed.length > 0) {
  console.error(
    `FPS physics check failed: max allowed delta is ${(
      TOLERANCE_RATIO * 100
    ).toFixed(1)}%.`,
  );
  process.exit(1);
}

console.log("FPS physics check passed.");
