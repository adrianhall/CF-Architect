import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { THEME_KEY, getTheme, setTheme } from "@lib/preferences";

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

let mockStorage: Storage;
const originalLocalStorage = globalThis.localStorage;

beforeEach(() => {
  mockStorage = createMockStorage();
  Object.defineProperty(globalThis, "localStorage", {
    value: mockStorage,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(globalThis, "localStorage", {
    value: originalLocalStorage,
    writable: true,
    configurable: true,
  });
});

describe("THEME_KEY", () => {
  it('equals "theme"', () => {
    expect(THEME_KEY).toBe("theme");
  });
});

describe("getTheme", () => {
  it('returns "dark" when stored value is "dark"', () => {
    mockStorage.setItem("theme", "dark");
    expect(getTheme()).toBe("dark");
  });

  it('returns "light" when stored value is "light"', () => {
    mockStorage.setItem("theme", "light");
    expect(getTheme()).toBe("light");
  });

  it("returns null when no value is stored", () => {
    expect(getTheme()).toBeNull();
  });

  it("returns null for an unrecognised value", () => {
    mockStorage.setItem("theme", "sepia");
    expect(getTheme()).toBeNull();
  });

  it("returns null when localStorage throws", () => {
    Object.defineProperty(globalThis, "localStorage", {
      get() {
        throw new Error("access denied");
      },
      configurable: true,
    });
    expect(getTheme()).toBeNull();
  });
});

describe("setTheme", () => {
  it('persists "dark" to localStorage', () => {
    setTheme("dark");
    expect(mockStorage.getItem("theme")).toBe("dark");
  });

  it('persists "light" to localStorage', () => {
    setTheme("light");
    expect(mockStorage.getItem("theme")).toBe("light");
  });

  it("does not throw when localStorage throws", () => {
    Object.defineProperty(globalThis, "localStorage", {
      get() {
        throw new Error("quota exceeded");
      },
      configurable: true,
    });
    expect(() => setTheme("dark")).not.toThrow();
  });
});
