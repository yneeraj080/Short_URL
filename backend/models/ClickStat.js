const mongoose = require("mongoose");


const clickStatSchema = new mongoose.Schema(
  {
    urlId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Url",
      required: true,
    },
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
