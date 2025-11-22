const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema({
  reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ["pending", "reviewed"], default: "pending" }
}, { timestamps: true });

module.exports = mongoose.model("report", reportSchema);
