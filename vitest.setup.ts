import "@testing-library/jest-dom/vitest";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

const localStorage = createMemoryStorage();
const sessionStorage = createMemoryStorage();

Object.defineProperties(globalThis, {
  localStorage: { configurable: true, value: localStorage },
  sessionStorage: { configurable: true, value: sessionStorage },
});
Object.defineProperties(window, {
  localStorage: { configurable: true, value: localStorage },
  sessionStorage: { configurable: true, value: sessionStorage },
});
