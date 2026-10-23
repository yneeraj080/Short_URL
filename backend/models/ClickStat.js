const mongoose = require("mongoose");

// Daily click counters per link: one small document per link per IST day,
// updated by the analytics worker. Dashboards read these instead of counting
// raw click events. Breakdown keys are browser/device/OS names (see statKey).
const clickStatSchema = new mongoose.Schema(
  {
    urlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Url",
      required: true,
    },
    // Calendar day in IST (UTC+05:30), "YYYY-MM-DD".
    day: {
      type: String,
      required: true,
    },
    total: { type: Number, default: 0 },
    browsers: { type: mongoose.Schema.Types.Mixed, default: {} },
    devices: { type: mongoose.Schema.Types.Mixed, default: {} },
    os: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { minimize: false, timestamps: true }
);

clickStatSchema.index({ urlId: 1, day: 1 }, { unique: true });

module.exports = mongoose.model("ClickStat", clickStatSchema);
