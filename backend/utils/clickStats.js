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

module.exports = { istDay, statKey, buildCounterUpdates, IST_OFFSET_MS };
