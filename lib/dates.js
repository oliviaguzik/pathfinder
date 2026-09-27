// Date-only strings (YYYY-MM-DD) parse as UTC midnight by default, which drifts
// to the wrong local calendar day near midnight. Anchor them to local midnight instead.
export function parseLocalDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

export function toISODateLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function todayLocalISODate() {
  return toISODateLocal(new Date());
}
