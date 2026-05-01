const mongoose = require("mongoose");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");

// GET MESSAGES
exports.getMessages = async (req, res) => {
  try {
    const userId = req.user.id;
    const { receiverId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({
        message: "Invalid receiverId"
      });
    }

    const conversation = await Conversation.findOne({
      participants: { $all: [userId, receiverId] }
    });

    if (!conversation) {
      return res.status(200).json({
        messages: [],
        message: "No conversation found"
      });
    }

    const messages = await Message.find({
      conversationId: conversation._id,
      is_deleted: false
    }).sort({ createdAt: 1 });

    res.status(200).json({
      conversationId: conversation._id,
      messages
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

// EDIT MESSAGE
exports.editMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { newText } = req.body;

    if (!newText || newText.trim() === "") {
      return res.status(400).json({
        message: "Message cannot be empty"
      });
    }

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message not found"
      });
    }

    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "Only sender can edit"
      });
    }

    message.text = newText;
    await message.save();

    const latestMessage = await Message.findOne({
      conversationId: message.conversationId
    }).sort({ createdAt: -1 });

    if (
      latestMessage &&
      latestMessage._id.toString() === message._id.toString()
    ) {
      await Conversation.findByIdAndUpdate(
        message.conversationId,
        { lastMessage: newText }
      );
    }

    if (req.io) {
      req.io
        .to(message.conversationId.toString())
        .emit("messageEdited", message);
    }

    res.status(200).json({
      message: "Message updated",
      data: message
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

// DELETE MESSAGE
exports.deleteMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({
        message: "Message not found"
      });
    }

    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        message: "Only sender can delete"
      });
    }

    message.is_deleted = true;
    await message.save();

    const latestMessage = await Message.findOne({
      conversationId: message.conversationId
    }).sort({ createdAt: -1 });

    if (
      latestMessage &&
      latestMessage._id.toString() === message._id.toString()
    ) {
      await Conversation.findByIdAndUpdate(
        message.conversationId,
        { lastMessage: "This message was deleted" }
      );
    }

    if (req.io) {
      req.io
        .to(message.conversationId.toString())
        .emit("messageDeleted", messageId);
    }

    res.status(200).json({
      message: "Message deleted"
    });

  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};