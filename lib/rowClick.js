// Rows open when you click anywhere on them, except on their own controls
// (checkbox, buttons, links, drag handle).
export function openOnRowClick(open) {
  return (e) => {
    if (e.target.closest("input, button, a, .drag-handle")) return;
    open();
  };
}

// Keyboard: Enter or Space on a row's title opens it, like a click.
export function openOnKey(open) {
  return (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      open();
    }
  };
}
