const Url = require("../models/Url");

const STREAM_KEY = "url-click-events";
const GROUP_NAME = "url-click-workers";
const CONSUMER_NAME = `worker-${process.pid}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startAnalyticsWorker(redisClient) {
  // Use a dedicated connection for blocking stream reads.
  const workerRedis = redisClient.duplicate();

  workerRedis.on("error", (error) => {
    console.error("Analytics Redis error:", error);
  });

  await workerRedis.connect();

  // Create the consumer group if it doesn't already exist.
  try {
    await workerRedis.xGroupCreate(STREAM_KEY, GROUP_NAME, "0", {
      MKSTREAM: true,
    });
  } catch (error) {
    if (!String(error.message).includes("BUSYGROUP")) {
      throw error;
    }
  }

  console.log("Redis analytics worker started");

  while (true) {
    try {
      const streams = await workerRedis.xReadGroup(
        GROUP_NAME,
        CONSUMER_NAME,
        [{ key: STREAM_KEY, id: ">" }],
        { COUNT: 100, BLOCK: 1000 },
      );

      if (!streams) {
        continue;
      }

      for (const stream of streams) {
        const groupedEvents = new Map();

        for (const entry of stream.messages) {
          const event = entry.message;

          if (!event.urlId) {
            console.error("Skipping analytics event without urlId:", entry.id);
            continue;
          }

          if (!groupedEvents.has(event.urlId)) {
            groupedEvents.set(event.urlId, []);
          }

          groupedEvents.get(event.urlId).push({
            clickedAt: new Date(event.clickedAt),
            browser: event.browser || "Unknown",
            device: event.device || "Desktop",
            os: event.os || "Unknown",
          });
        }

        const operations = [];

        for (const [urlId, events] of groupedEvents) {
          operations.push({
            updateOne: {
              filter: { _id: urlId },
              update: {
                $inc: { clicks: events.length },
                $push: {
                  analytics: {
                    $each: events,
                    $slice: -1000,
                  },
                },
              },
            },
          });
        }

        // Persist the batch before acknowledging stream events.
        if (operations.length > 0) {
          let saved = false;

          while (!saved) {
            try {
              await Url.bulkWrite(operations, {
                ordered: false,
              });

              saved = true;
            } catch (error) {
              console.error("Analytics batch failed; retrying:", error.message);

              await sleep(1000);
            }
          }
        }

        // Acknowledge only after processing finishes.
        for (const entry of stream.messages) {
          await workerRedis.xAck(STREAM_KEY, GROUP_NAME, entry.id);
        }
      }
    } catch (error) {
      console.error("Analytics worker error:", error);
      await sleep(1000);
    }
  }
}

module.exports = startAnalyticsWorker;
