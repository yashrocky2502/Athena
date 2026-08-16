class MemoryStorage {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] !== undefined ? keys[index] : null;
  }

  get length(): number {
    return Object.keys(this.store).length;
  }
}

let isBrowser = false;
try {
  isBrowser = typeof window !== "undefined" && typeof window.localStorage !== "undefined" && window.localStorage !== null;
} catch (e) {
  isBrowser = false;
}
const memoryStorageInstance = new MemoryStorage();

export const safeLocalStorage = {
  getItem(key: string): string | null {
    if (isBrowser) {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return memoryStorageInstance.getItem(key);
      }
    }
    return memoryStorageInstance.getItem(key);
  },

  setItem(key: string, value: string): void {
    if (isBrowser) {
      try {
        window.localStorage.setItem(key, value);
        return;
      } catch (e) {
        memoryStorageInstance.setItem(key, value);
        return;
      }
    }
    memoryStorageInstance.setItem(key, value);
  },

  removeItem(key: string): void {
    if (isBrowser) {
      try {
        window.localStorage.removeItem(key);
        return;
      } catch (e) {
        memoryStorageInstance.removeItem(key);
        return;
      }
    }
    memoryStorageInstance.removeItem(key);
  },

  clear(): void {
    if (isBrowser) {
      try {
        window.localStorage.clear();
        return;
      } catch (e) {
        memoryStorageInstance.clear();
        return;
      }
    }
    memoryStorageInstance.clear();
  },

  key(index: number): string | null {
    if (isBrowser) {
      try {
        return window.localStorage.key(index);
      } catch (e) {
        return memoryStorageInstance.key(index);
      }
    }
    return memoryStorageInstance.key(index);
  },

  get length(): number {
    if (isBrowser) {
      try {
        return window.localStorage.length;
      } catch (e) {
        return memoryStorageInstance.length;
      }
    }
    return memoryStorageInstance.length;
  }
};
