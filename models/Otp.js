const mongoose = require("mongoose");

const OtpSchema = new mongoose.Schema({
  mobile: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 300 } // expires in 5 min
});

module.exports = mongoose.model("Otp", OtpSchema);
