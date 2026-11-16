// Shared report parts of the weather probes in DevTools «РАНДОМАЙЗЕР» (spec 180 stage F, TK-335): the spread of the
// intervals between starts (mean, median, 10–90 %, min–max) and a histogram whose bucket is a round step that fits the
// spread, so a gust every few seconds and a storm every few hours both read well.
const BUCKETS = 12;
const STEPS_SEC = Object.freeze([1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600]);

export const quantile = (sorted, share) => sorted[Math.min(sorted.length - 1, Math.floor(share * (sorted.length - 1)))];
export const percent = (share) => `${(share * 100).toFixed(1)}%`;

// Seconds as the reader thinks of them: «12 с», «7.5 хв», «2.3 год».
export function duration(sec) {
  if (sec < 90) return `${sec.toFixed(sec < 10 ? 1 : 0)} с`;
  if (sec < 5400) return `${(sec / 60).toFixed(1)} хв`;
  return `${(sec / 3600).toFixed(1)} год`;
}

// A bucket edge in one unit for the whole histogram, chosen by its step: seconds, minutes or hours.
const edgeLabel = (sec, step) => (step < 60 ? `${sec} с` : step < 3600 ? `${sec / 60} хв` : `${sec / 3600} год`);

// Rows about the intervals (seconds) and their histogram: { rows, histogram }; empty when there are none.
export function intervalReport(intervals, label = "між початками") {
  if (!intervals.length) return { rows: [], histogram: [] };
  const sorted = [...intervals].sort((a, b) => a - b);
  const mean = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const rows = [
    [`${label}: середнє`, duration(mean)],
    ["медіана", duration(quantile(sorted, 0.5))],
    ["10% … 90%", `${duration(quantile(sorted, 0.1))} … ${duration(quantile(sorted, 0.9))}`],
    ["мін … макс", `${duration(sorted[0])} … ${duration(sorted[sorted.length - 1])}`],
  ];
  const span = quantile(sorted, 0.9);
  const step = STEPS_SEC.find((candidate) => candidate * BUCKETS >= span) ?? STEPS_SEC[STEPS_SEC.length - 1];
  const histogram = [];
  for (let bucket = 0; bucket <= BUCKETS; bucket += 1) {
    const from = bucket * step;
    const to = bucket === BUCKETS ? Infinity : from + step;
    const hits = intervals.filter((value) => value >= from && value < to).length;
    const name = bucket === BUCKETS ? `${edgeLabel(BUCKETS * step, step)}+` : `${edgeLabel(from, step)}–${edgeLabel(from + step, step)}`;
    histogram.push([name, hits / intervals.length]);
  }
  return { rows, histogram };
}
