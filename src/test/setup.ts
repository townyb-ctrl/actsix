import "@testing-library/jest-dom";

// jsdom 20 in this environment does not expose localStorage, so any component
// that persists to it throws before its test can run. An in-memory Storage is
// enough for tests and keeps each file isolated via the usual clear() call.
if (typeof window.localStorage === "undefined") {
  const store = new Map<string, string>();

  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };

  Object.defineProperty(window, "localStorage", { writable: true, value: memoryStorage });
  Object.defineProperty(globalThis, "localStorage", { writable: true, value: memoryStorage });
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
