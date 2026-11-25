type OpenDialog = { element: HTMLDialogElement; close: () => void };

const dialogs: OpenDialog[] = [];
const stateKey = "tradeifyDialog";
let entry: string | null = null;
let returning = false;
let listening = false;

function syncHistory() {
  if (returning) return;
  if (dialogs.length) {
    if (!entry || window.history.state?.[stateKey] !== entry) {
      entry = crypto.randomUUID();
      window.history.pushState({ ...window.history.state, [stateKey]: entry }, "");
    }
    return;
  }
  if (entry && window.history.state?.[stateKey] === entry) {
    returning = true;
    entry = null;
    window.history.back();
    return;
  }
  entry = null;
  window.removeEventListener("popstate", onPopState);
  listening = false;
}

function onPopState() {
  if (returning) {
    returning = false;
    syncHistory();
    return;
  }
  entry = null;
  dialogs.at(-1)?.close();
  queueMicrotask(syncHistory);
}

export function trackDialog(element: HTMLDialogElement, close: () => void) {
  const dialog = { element, close };
  dialogs.push(dialog);
  if (!listening) {
    window.addEventListener("popstate", onPopState);
    listening = true;
  }
  syncHistory();
  return () => {
    const index = dialogs.indexOf(dialog);
    if (index !== -1) dialogs.splice(index, 1);
    // A saved editor can be replaced by a detail in the same React commit.
    // Reuse the entry when another dialog mounts before this cleanup finishes.
    queueMicrotask(syncHistory);
  };
}
