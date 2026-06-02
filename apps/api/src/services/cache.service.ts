type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const store = new Map<string, CacheEntry<unknown>>();
const defaultTtlMs = 30_000;

function namespaced(namespace: string, key: string) {
  return `${namespace}:${key}`;
}

export function cacheKey(parts: Record<string, unknown>) {
  return JSON.stringify(
    Object.keys(parts)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = parts[key];
        return acc;
      }, {})
  );
}

export const cache = {
  async getOrSet<T>(namespace: string, key: string, loader: () => Promise<T>, ttlMs = defaultTtlMs): Promise<T> {
    const now = Date.now();
    const fullKey = namespaced(namespace, key);
    const cached = store.get(fullKey) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > now) return cached.value;

    const value = await loader();
    store.set(fullKey, { value, expiresAt: now + ttlMs });
    return value;
  },

  invalidate(namespace: string) {
    const prefix = `${namespace}:`;
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
  },

  clear() {
    store.clear();
  }
};
