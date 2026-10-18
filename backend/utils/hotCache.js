// Small in-process LRU cache for hot short links, in front of Redis.
// Each API process has its own copy, so entries live only a few seconds:
// a deleted link can keep redirecting for at most `ttlMs` on other processes.
//
// HOT_CACHE_TTL_MS (default 5000; 0 disables) and HOT_CACHE_MAX (default 10000).
const ttlMs = Math.max(0, Number(process.env.HOT_CACHE_TTL_MS ?? 5000));
const maxEntries = Math.max(1, Number(process.env.HOT_CACHE_MAX) || 10000);

// A Map keeps insertion order: the first key is the least recently used.
const entries = new Map();

const enabled = ttlMs > 0;

const get = (key) => {
  if (!enabled) return undefined;
  const entry = entries.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    entries.delete(key);
    return undefined;
  }
  // Move to the end so it counts as recently used.
  entries.delete(key);
  entries.set(key, entry);
  return entry.value;
};

const set = (key, value) => {
  if (!enabled) return;
  entries.delete(key);
  entries.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (entries.size > maxEntries) {
    entries.delete(entries.keys().next().value);
  }
};

const remove = (key) => entries.delete(key);

module.exports = { get, set, remove, enabled, ttlMs, maxEntries };
