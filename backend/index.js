const express = require("express");
const { createClient } = require("redis");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const cors = require("cors");
const startAnalyticsWorker = require("./workers/analyticsWorker");

dotenv.config();

const app = express();
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

app.locals.redis = redisClient;

app.disable("x-powered-by");
const { redirectUrl } = require("./controllers/urlController");
app.get("/:code", redirectUrl);

// CORS
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://54.87.185.37:3000",
    ],
    credentials: true,
  })
);

// Middleware
app.use(express.json());

// API rate limit, counted in Redis so every API process/server shares one
// count per IP (an in-memory count allowed N x the limit with N processes).
// Created in startServer() after Redis connects: the store loads a script
// into Redis when it is created. The server only listens after that.
let apiLimiter = null;
const createApiLimiter = () => {
  const store = new RedisStore({
    // Time out after 1 s so a hung/unreachable Redis doesn't make every API
    // request (logins included) wait forever; passOnStoreError then lets
    // the request through.
    sendCommand: (...args) =>
      Promise.race([
        redisClient.sendCommand(args),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("rate limit store timeout")), 1000).unref()
        ),
      ]),
    prefix: "rl:api:",
  });
  // The store loads its Lua scripts as soon as it is created; one of those
  // promises is never awaited. If Redis is slow at that moment the rejection
  // would be unhandled and crash the process. The store reloads the script
  // by itself on the next request, so ignoring the error here is safe.
  store.incrementScriptSha.catch(() => {});
  store.getScriptSha.catch(() => {});

  return rateLimit({
    windowMs:
      Number(process.env.RATE_LIMIT_WINDOW_MS) ||
      10 * 60 * 1000,
    limit:
      Number(process.env.RATE_LIMIT_MAX) || 100,
    message: {
      error: "Too many requests, please try again after 10 mins",
    },
    store,
    // If Redis has a problem, let requests through rather than failing them.
    passOnStoreError: true,
  });
};

app.use("/api", (req, res, next) => apiLimiter(req, res, next));

// URL routes
const urlRoutes = require("./routes/url");
app.use("/api", urlRoutes);

// Authentication routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// Error handler
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");

    
    await redisClient.connect();
    console.log("Redis connected successfully");
    apiLimiter = createApiLimiter();
    if (process.env.RUN_ANALYTICS_WORKER !== "false") {
      startAnalyticsWorker(redisClient).catch((error) => {
        console.error("Failed to start analytics worker:", error);
      });
    } else {
      console.log("In-process analytics worker disabled (RUN_ANALYTICS_WORKER=false)");
    }
    const server = app.listen(PORT, () => {
      console.log(`Server is working on port ${PORT}`);
    });
    let stopping = false;
    const shutdown = async (signal) => {
      if (stopping) return;
      stopping = true;
      setTimeout(() => process.exit(1), 8000).unref();
      server.close();
      server.closeIdleConnections();
      await new Promise((resolve) => setTimeout(resolve, 300));
      server.closeAllConnections();
      console.log(`Received ${signal}: stopped accepting requests, exiting`);
      // quit() waits for commands already sent (e.g. click XADDs) to finish.
      await redisClient.quit().catch(() => {});
      await mongoose.disconnect().catch(() => {});
      process.exit(0);
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } catch (error) {
    console.error("Server startup failed:", error);

    if (redisClient.isOpen) {
      await redisClient.quit().catch(() => {});
    }

    await mongoose.disconnect().catch(() => {});

    process.exit(1);
  }
}
startServer();