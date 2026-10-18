
const os = require("os");
const mongoose = require("mongoose");
const UAParser = require("ua-parser-js");
const ClickEvent = require("../models/ClickEvent");

const STREAM_KEY = "url-click-events";
const GROUP_NAME = "url-click-workers";
const CONSUMER_NAME = `worker-${os.hostname()}-${process.pid}`;

const BATCH_SIZE = 100;
const MIN_IDLE_MS = 30000;
const TRIM_INTERVAL_MS = 5000;
const TRIM_ROUNDS_PER_CYCLE = 20;

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

    // New events carry the raw user-agent (`ua`) and are parsed here, off the
    // redirect path. Older events in the stream already have the parsed fields.
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

    try {
      await ClickEvent.bulkWrite(operations, {
        ordered: false,
      });
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

// Stream IDs are "<ms>-<seq>"; compare them numerically.
const idLess = (a, b) => {
  const [am, as] = a.split("-").map(BigInt);
  const [bm, bs] = b.split("-").map(BigInt);
  return am < bm || (am === bm && as < bs);
};

// Remove stream entries the consumer group has finished with, so Redis memory
// doesn't grow forever. Entries at or after the oldest one still needed are
// kept: anything not yet delivered (after last-delivered-id) and anything
// delivered but not yet acknowledged (pending, from firstId). If this worker
// is down, nothing is trimmed.
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

  // "~" lets Redis trim whole internal nodes only: much cheaper, and it may
  // keep a few extra entries, never fewer. Redis also caps each approximate
  // trim at ~10,000 entries so one call can't block it; repeat a few times per
  // cycle to work through a backlog (up to ~200k entries every 5 s).
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

async function startAnalyticsWorker(redisClient) {
  const workerRedis = redisClient.duplicate();

  workerRedis.on("error", (error) => {
    console.error("Analytics Redis error:", error);
  });

  await workerRedis.connect();
  await ClickEvent.init();

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

  while (true) {
    try {
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
