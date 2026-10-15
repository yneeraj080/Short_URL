
const mongoose = require("mongoose");

const clickEventSchema = new mongoose.Schema(
  {
    // Redis Stream message ID; used to identify duplicate events.
    streamId: {
      type: String,
      required: true,
      unique: true,
    },

    urlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Url",
      required: true,
    },

    clickedAt: {
      type: Date,
      required: true,
    },

    browser: {
      type: String,
      default: "Unknown",
    },

    device: {
      type: String,
      default: "Desktop",
    },

    os: {
      type: String,
      default: "Unknown",
    },
  },
  { timestamps: true }
);

// Efficiently fetch recent events for a particular URL.
clickEventSchema.index({ urlId: 1, clickedAt: -1 });

module.exports = mongoose.model("ClickEvent", clickEventSchema);
