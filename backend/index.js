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

// Configurable rate limiter
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

app.use(limiter);

// URL routes
const urlRoutes = require("./routes/url");
app.use("/api", urlRoutes);

// Authentication routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// Redirect route
const { redirectUrl } = require("./controllers/urlController");
app.get("/:code", redirectUrl);

// Error handler
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// Start server only after MongoDB and Redis connect
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected successfully");

    // Connect to Redis
    await redisClient.connect();
    console.log("Redis connected successfully");

    // Start the analytics worker in the background
    startAnalyticsWorker(redisClient).catch((error) => {
      console.error("Failed to start analytics worker:", error);
    });

    // Start the Express server
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