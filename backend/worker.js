const { createClient } = require("redis");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const startAnalyticsWorker = require("./workers/analyticsWorker");

dotenv.config();

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
});
const shutdown = async (signal) => {
  console.log(`Analytics worker received ${signal}, shutting down`);
  await redisClient.quit().catch(() => {});
  await mongoose.disconnect().catch(() => {});
  process.exit(0);
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function start() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");

    await redisClient.connect();
    console.log("Redis connected successfully");
    await startAnalyticsWorker(redisClient);
  } catch (error) {
    console.error("Analytics worker failed:", error);
    await redisClient.quit().catch(() => {});
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  }
}

start();
