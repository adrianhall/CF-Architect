/**
 * In-memory KVNamespace mock for testing.
 *
 * Backs `get`, `put`, and `delete` with a simple Map. Tracks
 * `expirationTtl` options passed to `put` so tests can assert on them.
 */

interface StoredEntry {
  value: string;
  expirationTtl?: number;
}

export class MockKV {
  private store = new Map<string, StoredEntry>();

  /** All `expirationTtl` values passed to `put`, keyed by KV key. */
  public ttls = new Map<string, number>();

  get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    return Promise.resolve(entry?.value ?? null);
  }

  put(
    key: string,
    value: string,
    options?: KVNamespacePutOptions,
  ): Promise<void> {
    this.store.set(key, { value, expirationTtl: options?.expirationTtl });
    if (options?.expirationTtl) {
      this.ttls.set(key, options.expirationTtl);
    }
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.store.delete(key);
    this.ttls.delete(key);
    return Promise.resolve();
  }

  /** Clear all stored entries and TTL tracking. */
  reset(): void {
    this.store.clear();
    this.ttls.clear();
  }

  /** Check if a key exists (test helper). */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /** Get raw stored value (test helper). */
  raw(key: string): string | undefined {
    return this.store.get(key)?.value;
  }
}

/** Create a fresh MockKV instance cast as KVNamespace for use in tests. */
export function createMockKV(): MockKV {
  return new MockKV();
}
