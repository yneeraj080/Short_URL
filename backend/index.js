const express = require("express");
const { createClient } = require("redis");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const startAnalyticsWorker = require("./workers/analyticsWorker");

dotenv.config();

const app = express();

// Redis client
const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

// Make Redis available to controllers through req.app.locals.redis
app.locals.redis = redisClient;

app.disable("x-powered-by");

// Redirect route, registered before cors/json middleware: a redirect is a GET
// with no body that browsers follow directly, so it needs neither (profiling
// showed they cost ~17% of the CPU per redirect). `/:code` only matches
// single-segment paths, so /api/... routes are unaffected.
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

const limiter = rateLimit({
  windowMs:
    Number(process.env.RATE_LIMIT_WINDOW_MS) ||
    10 * 60 * 1000,
  limit:
    Number(process.env.RATE_LIMIT_MAX) || 100,
  message: {
    error: "Too many requests, please try again after 10 mins",
  },
});

app.use("/api", limiter);

// URL routes
const urlRoutes = require("./routes/url");
app.use("/api", urlRoutes);

// Authentication routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// Error handler
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// Start server only after MongoDB and Redis connect
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");

    
    await redisClient.connect();
    console.log("Redis connected successfully");
    if (process.env.RUN_ANALYTICS_WORKER !== "false") {
      startAnalyticsWorker(redisClient).catch((error) => {
        console.error("Failed to start analytics worker:", error);
      });
    } else {
      console.log("In-process analytics worker disabled (RUN_ANALYTICS_WORKER=false)");
    }
    app.listen(PORT, () => {
      console.log(`Server is working on port ${PORT}`);
    });
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