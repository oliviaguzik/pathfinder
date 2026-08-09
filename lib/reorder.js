// Fractional-index positioning: dropping an item between two neighbors gets a
// position value between theirs, so reordering never requires rewriting every row.
export function positionBetween(prevPos, nextPos) {
  const hasPrev = prevPos !== null && prevPos !== undefined;
  const hasNext = nextPos !== null && nextPos !== undefined;
  if (!hasPrev && !hasNext) return 1;
  if (!hasPrev) return nextPos - 1;
  if (!hasNext) return prevPos + 1;
  return (prevPos + nextPos) / 2;
}

export function nextPosition(list) {
  const max = list.reduce((m, item) => (typeof item.position === "number" ? Math.max(m, item.position) : m), 0);
  return max + 1;
}

export function sortByPosition(list) {
  return [...list].sort((a, b) => {
    const ap = typeof a.position === "number" ? a.position : Infinity;
    const bp = typeof b.position === "number" ? b.position : Infinity;
    return ap - bp;
  });
}
