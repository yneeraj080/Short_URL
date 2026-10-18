
const os = require("os");
const mongoose = require("mongoose");
const UAParser = require("ua-parser-js");
const ClickEvent = require("../models/ClickEvent");

const STREAM_KEY = "url-click-events";
const GROUP_NAME = "url-click-workers";
const CONSUMER_NAME = `worker-${os.hostname()}-${process.pid}`;

const BATCH_SIZE = 100;
const MIN_IDLE_MS = 30000;

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

  while (true) {
    try {
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
