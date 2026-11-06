
const os = require("os");
const mongoose = require("mongoose");
const UAParser = require("ua-parser-js");
const ClickEvent = require("../models/ClickEvent");
const ClickStat = require("../models/ClickStat");
const Url = require("../models/Url");
const {
  buildCounterUpdates,
  recomputeCounters,
  istDay,
  istDayRange,
} = require("../utils/clickStats");

// Daily counters (Phase 2). ANALYTICS_COUNTERS=false turns them off.
const COUNTERS_ENABLED = process.env.ANALYTICS_COUNTERS !== "false";

const STREAM_KEY = "url-click-events";
const GROUP_NAME = "url-click-workers";
const CONSUMER_NAME = `worker-${os.hostname()}-${process.pid}`;

const BATCH_SIZE = 100;
const MIN_IDLE_MS = 30000;
const TRIM_INTERVAL_MS = 5000;
const TRIM_ROUNDS_PER_CYCLE = 20;
// Consumer names left behind by stopped worker containers (each container has
// its own name) are removed once idle this long with nothing pending.
const STALE_CONSUMER_IDLE_MS = Number(process.env.STALE_CONSUMER_IDLE_MS) || 60 * 60 * 1000;
const STALE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
// Check-and-correct job for finished days (see reconcileClosedDays).
const DAY_MS = 24 * 60 * 60 * 1000;
const RECONCILE_INTERVAL_MS = Number(process.env.RECONCILE_INTERVAL_MS) || 10 * 60 * 1000;
const RECONCILE_GRACE_MS = 10 * 60 * 1000;
const RECONCILE_LOOKBACK_DAYS = 7;
// Allowance for clock differences between API servers and Redis.
const CLOCK_SKEW_MS = 60 * 1000;

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function processMessages(workerRedis, messages) {
  const events = [];
  const invalidIds = [];

  for (const entry of messages) {
    if (!entry) {
      continue;
    }

    const message = entry.message || {};
    const clickedAt = new Date(message.clickedAt);

    if (
      !mongoose.Types.ObjectId.isValid(message.urlId) ||
      Number.isNaN(clickedAt.getTime())
    ) {
      console.error("Skipping invalid click event:", entry.id);
      invalidIds.push(entry.id);
      continue;
    }
    let { browser, device, os: osName } = message;
    if (message.ua !== undefined) {
      const parser = new UAParser(message.ua);
      browser = parser.getBrowser().name;
      device = parser.getDevice().type;
      osName = parser.getOS().name;
    }

    events.push({
      streamId: entry.id,
      urlId: message.urlId,
      clickedAt,
      browser: browser || "Unknown",
      device: device || "Desktop",
      os: osName || "Unknown",
    });
  }

  if (events.length > 0) {
    const operations = events.map((event) => ({
      updateOne: {
        filter: { streamId: event.streamId },
        update: {
          $setOnInsert: event,
        },
        upsert: true,
      },
    }));

    // Indexes (in `events`) of clicks this call newly inserted. Only those are
    // counted: a redelivered click is already stored and was counted then.
    let upsertedIds = {};
    try {
      const result = await ClickEvent.bulkWrite(operations, {
        ordered: false,
      });
      upsertedIds = result.upsertedIds || {};
    } catch (error) {
      const saved = await ClickEvent.find({
        streamId: {
          $in: events.map((event) => event.streamId),
        },
      })
        .select("streamId")
        .lean();

      if (saved.length !== events.length) {
        throw error;
      }
      // Partly failed (e.g. another worker inserted some first): count only
      // the ones this call inserted; the other worker counts its own.
      upsertedIds = error.upsertedIds || {};
    }

    if (COUNTERS_ENABLED) {
      const newEvents = Object.keys(upsertedIds).map((i) => events[i]);
      const counterUpdates = buildCounterUpdates(newEvents);
      if (counterUpdates.length > 0) {
        try {
          await ClickStat.bulkWrite(counterUpdates, { ordered: false });
        } catch (error) {
          // Raw clicks are saved; the reconciliation job recomputes counters
          // from them, so log and carry on rather than retrying (no double count).
          console.error("Failed to update click counters:", error.message);
        }
      }
    }
  }
  const idsToAcknowledge = [
    ...events.map((event) => event.streamId),
    ...invalidIds,
  ];

  if (idsToAcknowledge.length > 0) {
    await workerRedis.xAck(
      STREAM_KEY,
      GROUP_NAME,
      idsToAcknowledge
    );
  }
}
const idLess = (a, b) => {
  const [am, as] = a.split("-").map(BigInt);
  const [bm, bs] = b.split("-").map(BigInt);
  return am < bm || (am === bm && as < bs);
};
async function trimProcessedEntries(workerRedis) {
  const groups = await workerRedis.xInfoGroups(STREAM_KEY);
  const group = groups.find((g) => g.name === GROUP_NAME);
  if (!group) return 0;

  let keepFrom = group["last-delivered-id"];
  if (!keepFrom || keepFrom === "0-0") return 0;

  const pending = await workerRedis.xPending(STREAM_KEY, GROUP_NAME);
  if (pending.pending > 0 && pending.firstId && idLess(pending.firstId, keepFrom)) {
    keepFrom = pending.firstId;
  }
  let removed = 0;
  for (let i = 0; i < TRIM_ROUNDS_PER_CYCLE; i++) {
    const n = await workerRedis.xTrim(STREAM_KEY, "MINID", keepFrom, {
      strategyModifier: "~",
    });
    removed += n;
    if (n === 0) break;
  }
  return removed;
}

// Remove consumer names of workers that are gone. Only names with 0 pending
// messages are removed (pending clicks must stay so XAUTOCLAIM can recover
// them). A live worker reads every second, so it never looks idle; if one were
// removed anyway, Redis recreates the name on its next read.
async function removeStaleConsumers(workerRedis) {
  const consumers = await workerRedis.xInfoConsumers(STREAM_KEY, GROUP_NAME);
  let removed = 0;
  for (const c of consumers) {
    if (c.name !== CONSUMER_NAME && c.pending === 0 && c.idle > STALE_CONSUMER_IDLE_MS) {
      await workerRedis.xGroupDelConsumer(STREAM_KEY, GROUP_NAME, c.name);
      removed += 1;
    }
  }
  if (removed > 0) {
    console.log(`Removed ${removed} stale consumer name(s); ${consumers.length - removed} left`);
  }
}

const streamIdMs = (id) => Number(String(id).split("-")[0]);

// True when every click with a stream ID before `beforeMs` has been fully
// processed (saved, counted and acknowledged). Stream IDs are the time the
// click was added, so this tells us whether a finished day can still change.
async function processedUpTo(workerRedis, beforeMs) {
  const [groups, pending, stream] = await Promise.all([
    workerRedis.xInfoGroups(STREAM_KEY),
    workerRedis.xPending(STREAM_KEY, GROUP_NAME),
    workerRedis.xInfoStream(STREAM_KEY),
  ]);
  const group = groups.find((g) => g.name === GROUP_NAME);
  if (!group) return false;
  // Read, not yet acknowledged: the oldest must be newer than the cut-off.
  if (pending.pending > 0 && streamIdMs(pending.firstId) < beforeMs) return false;
  // Not yet read at all (anything after last-delivered-id): if there is some,
  // it is at least as new as last-delivered-id.
  const lastDelivered = group["last-delivered-id"];
  const unread = lastDelivered !== stream["last-generated-id"];
  if (unread && streamIdMs(lastDelivered) < beforeMs) return false;
  return true;
}

// Check-and-correct job: recount finished IST days (yesterday and the day
// before) from the raw click events and overwrite their counters. A day is
// only touched once it has ended (plus a grace period) AND none of its clicks
// are still waiting in the stream, so nothing can change it while we recount.
// Fixes rare gaps such as a crash between saving clicks and counting them.
async function reconcileClosedDays(workerRedis) {
  const now = Date.now();
  // Oldest first. Looking back several days means a worker outage of a few
  // days still gets corrected once the backlog is processed. Each day is
  // recounted once (done marker); raw clicks are kept far longer (>= 14 days).
  for (let daysAgo = RECONCILE_LOOKBACK_DAYS; daysAgo >= 1; daysAgo--) {
    const day = istDay(now - daysAgo * DAY_MS);
    const { start, end } = istDayRange(day);
    if (now < end.getTime() + RECONCILE_GRACE_MS) continue;

    const doneKey = `clickstats:reconciled:${day}`;
    if (await workerRedis.exists(doneKey)) continue;
    if (!(await processedUpTo(workerRedis, end.getTime() + CLOCK_SKEW_MS))) continue;

    // Only one worker recounts a day, even with several workers running.
    const lockKey = `clickstats:reconcile-lock:${day}`;
    if (!(await workerRedis.set(lockKey, CONSUMER_NAME, { NX: true, EX: 600 }))) continue;
    try {
      const [before] = await ClickStat.aggregate([
        { $match: { day } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]);
      const { counters, clicks } = await recomputeCounters({
        ClickEvent,
        ClickStat,
        Url,
        match: { clickedAt: { $gte: start, $lt: end } },
      });
      await workerRedis.set(doneKey, String(clicks), {
        EX: ((RECONCILE_LOOKBACK_DAYS + 2) * DAY_MS) / 1000,
      });
      const was = before ? before.total : 0;
      console.log(
        `Reconciled ${day} (IST): ${clicks} clicks in ${counters} counters` +
          (was !== clicks ? ` (corrected from ${was})` : " (already correct)")
      );
    } finally {
      // Release the lock only if it is still ours: if a recount ever took
      // longer than the lock's expiry, another worker may now hold it.
      await workerRedis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        { keys: [lockKey], arguments: [CONSUMER_NAME] }
      );
    }
  }
}

async function startAnalyticsWorker(redisClient) {
  const workerRedis = redisClient.duplicate();

  workerRedis.on("error", (error) => {
    console.error("Analytics Redis error:", error);
  });

  await workerRedis.connect();
  await ClickEvent.init();
  // Unique { urlId, day } index must exist before counters are upserted.
  await ClickStat.init();

  try {
    await workerRedis.xGroupCreate(
      STREAM_KEY,
      GROUP_NAME,
      "$",
      { MKSTREAM: true }
    );
  } catch (error) {
    if (!String(error.message).includes("BUSYGROUP")) {
      throw error;
    }
  }

  console.log("Redis analytics worker started");

  let pendingCursor = "0-0";
  let lastTrim = 0;
  let lastStaleCheck = 0;
  let lastReconcile = 0;

  while (true) {
    try {
      if (COUNTERS_ENABLED && Date.now() - lastReconcile >= RECONCILE_INTERVAL_MS) {
        lastReconcile = Date.now();
        await reconcileClosedDays(workerRedis);
      }

      if (Date.now() - lastStaleCheck >= STALE_CHECK_INTERVAL_MS) {
        lastStaleCheck = Date.now();
        await removeStaleConsumers(workerRedis);
      }

      if (Date.now() - lastTrim >= TRIM_INTERVAL_MS) {
        lastTrim = Date.now();
        const removed = await trimProcessedEntries(workerRedis);
        if (removed > 0) {
          console.log(`Trimmed ${removed} processed click events from the stream`);
        }
      }

      const claimed = await workerRedis.xAutoClaim(
        STREAM_KEY,
        GROUP_NAME,
        CONSUMER_NAME,
        MIN_IDLE_MS,
        pendingCursor,
        { COUNT: BATCH_SIZE }
      );

      pendingCursor = claimed.nextId || "0-0";

      if (claimed.messages.length > 0) {
        await processMessages(workerRedis, claimed.messages);
        continue;
      }
      const streams = await workerRedis.xReadGroup(
        GROUP_NAME,
        CONSUMER_NAME,
        [{ key: STREAM_KEY, id: ">" }],
        { COUNT: BATCH_SIZE, BLOCK: 1000 }
      );

      if (!streams) {
        continue;
      }

      for (const stream of streams) {
        await processMessages(workerRedis, stream.messages);
      }
    } catch (error) {
      console.error("Analytics worker error:", error.message);
      await sleep(1000);
    }
  }
}

module.exports = startAnalyticsWorker;
