// A tiny app-wide channel for messages, shown by <ErrorToast />.
// kind: "error" (something failed) | "warning" (the user needs to fix something)
// | "undo" (something just happened that can be taken back).
const listeners = new Set();

function emit(kind, message, onUndo) {
  listeners.forEach((listener) => listener({ kind, message, onUndo }));
}

export function notifyError(message) {
  emit("error", message);
}

export function notifyWarning(message) {
  emit("warning", message);
}

// A short note with an Undo button, e.g. after deleting or checking off a task.
export function notifyUndo(message, onUndo) {
  emit("undo", message, onUndo);
}

export function onNotify(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
