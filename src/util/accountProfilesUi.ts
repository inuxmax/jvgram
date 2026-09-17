type Listener = NoneToVoidFunction;

let isOpen = false;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((cb) => cb());
}

export function openAccountProfiles() {
  isOpen = true;
  notify();
}

export function closeAccountProfiles() {
  isOpen = false;
  notify();
}

export function isAccountProfilesOpen() {
  return isOpen;
}

export function subscribeAccountProfilesUi(cb: Listener) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
