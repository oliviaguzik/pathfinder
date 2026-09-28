// A tiny app-wide channel for messages, shown by <ErrorToast />.
// kind: "error" (something failed) | "warning" (the user needs to fix something).
const listeners = new Set();

function emit(kind, message) {
  listeners.forEach((listener) => listener({ kind, message }));
}

export function notifyError(message) {
  emit("error", message);
}

export function notifyWarning(message) {
  emit("warning", message);
}

export function onNotify(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
