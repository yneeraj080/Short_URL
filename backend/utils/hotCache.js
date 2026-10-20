const ttlMs = Math.max(0, Number(process.env.HOT_CACHE_TTL_MS ?? 5000));
const maxEntries = Math.max(1, Number(process.env.HOT_CACHE_MAX) || 10000);
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
