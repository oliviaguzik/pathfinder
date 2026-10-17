// Splits `text` into parts, marking where each of `phrases` appears (first
// match, ignoring case, no overlaps): [{ text, hit }].
export function splitHighlights(text, phrases) {
  const lower = text.toLowerCase();
  const ranges = [];
  for (const phrase of phrases) {
    if (!phrase) continue;
    let from = 0;
    while (from <= lower.length) {
      const start = lower.indexOf(phrase.toLowerCase(), from);
      if (start === -1) break;
      const end = start + phrase.length;
      if (!ranges.some((r) => start < r.end && end > r.start)) {
        ranges.push({ start, end });
        break;
      }
      from = start + 1;
    }
  }
  ranges.sort((a, b) => a.start - b.start);
  const parts = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start > at) parts.push({ text: text.slice(at, r.start), hit: false });
    parts.push({ text: text.slice(r.start, r.end), hit: true });
    at = r.end;
  }
  if (at < text.length) parts.push({ text: text.slice(at), hit: false });
  return parts;
}
