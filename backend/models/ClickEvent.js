
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

// Raw clicks are deleted automatically after RAW_CLICK_RETENTION_DAYS (default
// 90); the daily counters (ClickStat) keep the totals forever. Also speeds up
// the daily recount, which looks clicks up by time. Note: changing the number
// later needs a MongoDB `collMod` (an existing TTL index isn't updated).
// At least 14 days: the worker's check-and-correct job recounts the last 7
// finished days from raw clicks, so they must still exist.
const RETENTION_DAYS = Math.max(14, Number(process.env.RAW_CLICK_RETENTION_DAYS) || 90);
clickEventSchema.index(
  { clickedAt: 1 },
  { expireAfterSeconds: RETENTION_DAYS * 24 * 60 * 60 }
);

module.exports = mongoose.model("ClickEvent", clickEventSchema);
