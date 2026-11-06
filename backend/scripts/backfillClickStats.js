// One-off: rebuild the daily click counters (clickstats) from every saved click
// event plus the old clicks stored inside Url documents. It overwrites counters
// with $set, so running it again gives the same result.
//
// Run it with the analytics worker STOPPED (otherwise the worker could add to
// today's counter while this overwrites it). Clicks keep queueing in Redis
// meanwhile and are processed when the worker starts again:
//
//   docker compose stop worker
//   docker compose exec backend node scripts/backfillClickStats.js
//   docker compose start worker
//
// --force skips the "is a worker running?" check (use only when you have just
//   stopped the worker yourself, as the deploy script does).
// --once  does nothing if a previous run already completed (recorded in the
//   MongoDB `app_meta` collection). The deploy script uses this so the
//   backfill runs exactly once per server. Re-running it much later is not
//   wanted: after the raw-click retention period, the oldest day's raw clicks
//   are partly deleted and the recount would lower that day's counter.
const mongoose = require("mongoose");
const { createClient } = require("redis");
const dotenv = require("dotenv");
const ClickEvent = require("../models/ClickEvent");
const ClickStat = require("../models/ClickStat");
const Url = require("../models/Url");
const { recomputeCounters } = require("../utils/clickStats");

dotenv.config();

const ACTIVE_WORKER_IDLE_MS = 15000;

(async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const meta = mongoose.connection.db.collection("app_meta");
  if (process.argv.includes("--once")) {
    const done = await meta.findOne({ _id: "clickstats-backfill" });
    if (done) {
      console.log(`Click counters were already backfilled on ${done.completedAt.toISOString()}; skipping.`);
      await mongoose.disconnect();
      return;
    }
  }

  if (!process.argv.includes("--force")) {
    const redis = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
    await redis.connect();
    const consumers = await redis
      .xInfoConsumers("url-click-events", "url-click-workers")
      .catch(() => []);
    await redis.quit();
    const active = consumers.filter((c) => c.idle < ACTIVE_WORKER_IDLE_MS);
    if (active.length > 0) {
      console.error(
        `An analytics worker is running (${active.map((c) => c.name).join(", ")}).\n` +
          "Stop it first:  docker compose stop worker   (or pass --force)"
      );
      await mongoose.disconnect();
      process.exit(1);
    }
  }

  await ClickStat.init();
  const started = Date.now();
  console.log("Rebuilding click counters from raw click events + legacy Url data...");
  const { counters, clicks } = await recomputeCounters({
    ClickEvent,
    ClickStat,
    Url,
    includeLegacy: true,
  });
  console.log(
    `Done in ${((Date.now() - started) / 1000).toFixed(1)} s: ${clicks} clicks -> ${counters} daily counter documents.`
  );
  await meta.updateOne(
    { _id: "clickstats-backfill" },
    { $set: { completedAt: new Date(), clicks, counters } },
    { upsert: true }
  );
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error("Backfill failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
