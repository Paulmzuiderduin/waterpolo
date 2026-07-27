import { createEmptyData, ensureDataShape } from './dataModel';

const STORAGE_KEY = 'lope-docent-toolkit';

const safeParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

export const storage = {
  async load() {
    if (typeof window === 'undefined') return createEmptyData();
    try {
      const parsed = safeParse(window.localStorage.getItem(STORAGE_KEY));
      return ensureDataShape(parsed);
    } catch (error) {
      return createEmptyData();
    }
  },
  async save(data) {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      // Storage might be full or blocked; ignore here and surface via UI.
    }
  },
  async clear() {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(STORAGE_KEY);
  }
};
