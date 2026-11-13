// Art size marks (TK-224): an item that comes in sizes shows its art smaller in the same box the smaller it is, so the
// largest fills the box and the smallest has the widest margin. Only marked items take part: an item definition carries
// `artSize: { step, of }` (step 1 = smallest, `of` = the number of sizes); a fish species with `visual.artSizeByLevel`
// uses the caught fish's level of its maxLevel. The art itself has no margins (TK-222): CSS sets the scale.
//
// applyArtSize marks the box that holds the image (class "art-size", --art-size-rank: 0 largest ... 1 smallest); the
// stylesheet scales the box's image from 1 down to --art-size-min-scale (shared-controls.css), the one value to tune.

// 0 for the largest size, 1 for the smallest, or null when the size is not a valid mark.
export function artSizeRank(size) {
  const of = Number(size?.of), step = Number(size?.step);
  if (!Number.isSafeInteger(of) || !Number.isSafeInteger(step) || of < 2 || step < 1 || step > of) return null;
  return (of - step) / (of - 1);
}

// Marks (or unmarks) the image box; unmarked items keep their art at full size.
export function applyArtSize(box, size) {
  const rank = artSizeRank(size);
  box.classList.toggle("art-size", rank !== null);
  if (rank === null) box.style.removeProperty("--art-size-rank");
  else box.style.setProperty("--art-size-rank", String(rank));
}
