// Helpers for the daily click counters (models/ClickStat.js).

// IST is UTC+05:30 all year (no daylight saving), so a fixed offset is exact.
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

// "YYYY-MM-DD" of the IST calendar day a click happened on.
const istDay = (date) =>
  new Date(new Date(date).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

// Breakdown names become MongoDB field names ("browsers.<name>"), so they
// can't contain "." or start with "$". Real browser/OS names rarely do.
const statKey = (name) =>
  String(name || "Unknown").replace(/\./g, "_").replace(/^\$/, "_") || "Unknown";

// Turn saved click events into one $inc update per (link, day):
// a batch of 100 clicks on one link becomes a single counter write.
const buildCounterUpdates = (events) => {
  const groups = new Map();

  for (const event of events) {
    const day = istDay(event.clickedAt);
    const key = `${event.urlId}|${day}`;
    let inc = groups.get(key);
    if (!inc) {
      inc = { urlId: event.urlId, day, fields: { total: 0 } };
      groups.set(key, inc);
    }
    inc.fields.total += 1;
    for (const [prefix, value] of [
      ["browsers", event.browser],
      ["devices", event.device],
      ["os", event.os],
    ]) {
      const field = `${prefix}.${statKey(value)}`;
      inc.fields[field] = (inc.fields[field] || 0) + 1;
    }
  }

  return [...groups.values()].map(({ urlId, day, fields }) => ({
    updateOne: {
      filter: { urlId, day },
      update: { $inc: fields },
      upsert: true,
    },
  }));
};

// UTC instants where an IST day starts and ends: [start, end).
const istDayRange = (day) => {
  const start = new Date(new Date(`${day}T00:00:00Z`).getTime() - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};

// Prototype-free objects so a name like "constructor" can't collide with
// built-in object properties.
const emptyCounts = () => ({
  total: 0,
  browsers: Object.create(null),
  devices: Object.create(null),
  os: Object.create(null),
});

const addTo = (counts, browser, device, os, n) => {
  counts.total += n;
  for (const [field, value] of [
    ["browsers", browser],
    ["devices", device],
    ["os", os],
  ]) {
    const key = statKey(value);
    counts[field][key] = (counts[field][key] || 0) + n;
  }
};

// Recompute counters from raw click events (the source of truth) and
// OVERWRITE them with $set, so running it again gives the same result.
// `match` limits which raw events are counted (e.g. one IST day).
// With `includeLegacy`, clicks stored inside Url documents (the old
// `analytics` array, and any `clicks` count beyond it) are added too.
// Returns { counters: number of link/day documents written, clicks: total }.
async function recomputeCounters({ ClickEvent, ClickStat, Url, match = {}, includeLegacy = false }) {
  const counters = new Map();
  const bucket = (urlId, day) => {
    const key = `${urlId}|${day}`;
    if (!counters.has(key)) counters.set(key, { urlId, day, counts: emptyCounts() });
    return counters.get(key).counts;
  };

  const groups = ClickEvent.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          urlId: "$urlId",
          day: { $dateToString: { format: "%Y-%m-%d", date: "$clickedAt", timezone: "+05:30" } },
          browser: "$browser",
          device: "$device",
          os: "$os",
        },
        n: { $sum: 1 },
      },
    },
  ])
    .allowDiskUse(true)
    .cursor();
  for await (const g of groups) {
    addTo(bucket(g._id.urlId, g._id.day), g._id.browser, g._id.device, g._id.os, g.n);
  }

  if (includeLegacy) {
    const legacyUrls = Url.find({ $or: [{ clicks: { $gt: 0 } }, { "analytics.0": { $exists: true } }] })
      .select("analytics clicks createdAt")
      .lean()
      .cursor();
    for await (const url of legacyUrls) {
      const list = url.analytics || [];
      for (const a of list) {
        addTo(bucket(url._id, istDay(a.clickedAt || url.createdAt)), a.browser, a.device, a.os, 1);
      }
      // An old click count higher than the stored list: those clicks have no
      // time or details, so count them on the link's creation day as Unknown.
      const extra = (url.clicks || 0) - list.length;
      if (extra > 0) addTo(bucket(url._id, istDay(url.createdAt)), "Unknown", "Unknown", "Unknown", extra);
    }
  }

  const ops = [...counters.values()].map(({ urlId, day, counts }) => ({
    updateOne: {
      filter: { urlId, day },
      update: { $set: counts },
      upsert: true,
    },
  }));
  let clicks = 0;
  for (const c of counters.values()) clicks += c.counts.total;
  for (let i = 0; i < ops.length; i += 1000) {
    await ClickStat.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
  }
  return { counters: ops.length, clicks };
}

module.exports = {
  istDay,
  istDayRange,
  statKey,
  buildCounterUpdates,
  recomputeCounters,
  IST_OFFSET_MS,
};
