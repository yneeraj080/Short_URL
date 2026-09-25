const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit");
const cors = require("cors");

dotenv.config();

const app = express();

// CORS
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

// Middleware
app.use(express.json());

// Rate limiter
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 100,
  message: {
    error: "Too many requests, please try again after 10 mins",
  },
});
app.use(limiter);

// Routes
const urlRoutes = require("./routes/url");
app.use("/api", urlRoutes);

// Auth routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

// Redirect route
const { redirectUrl } = require("./controllers/urlController");
app.get("/:code", redirectUrl);

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Error handling
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});