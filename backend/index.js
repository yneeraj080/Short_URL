const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

// Middleware
app.use(express.json());

//routes
const urlRoutes=require("./routes/url");
app.use("/api",urlRoutes);

// redirect route

const {redirectUrl}=require("./controllers/urlController");
app.get("/:code",redirectUrl);

// Connect to MongoDB

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.log("MongoDB connection error:", err));

// Start server

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});