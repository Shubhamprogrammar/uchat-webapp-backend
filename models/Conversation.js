const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  lastMessage: { type: String, default: "" },
  unreadCount: {
      type: Map,
      of: Number,
      default: {}
    },
}, { timestamps: true });

module.exports =  mongoose.model("Conversation", conversationSchema);