import express from "express";
import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";
const authoriseuser = require("../middleware/authoriseuser");

const router = express.Router();

/**
 * Send a message between two users
 * Automatically creates a conversation if it doesn't exist
 */
router.post("/send-message", authoriseuser, async (req, res) => {
  try {
    const { receiverId, senderId, text, mediaUrl, messageType } = req.body;

    if (!receiverId || !senderId || (!text && !mediaUrl)) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // Find or create a conversation between sender and receiver
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, receiverId],
      });
      await conversation.save();
    }

    // Save message
    const message = new Message({
      conversationId: conversation._id,
      sender: senderId,
      text,
      mediaUrl,
      messageType: messageType || "text",
    });
    await message.save();

    // Update last message
    conversation.lastMessage = text || "Media";
    await conversation.save();

    // Emit message via Socket.IO
    if (req.io) {
      req.io.to(conversation._id.toString()).emit("receiveMessage", message);
    }

    res.status(200).json({
      message: "Message sent successfully",
      data: message,
      conversationId: conversation._id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

/**
 * Get all messages between logged-in user and another user
 */
router.get("/get-messages/:receiverId", authoriseuser, async (req, res) => {
  try {
    const userId = req.user.id;
    const { receiverId } = req.params;

    // Find conversation between these two users
    const conversation = await Conversation.findOne({
      participants: { $all: [userId, receiverId] },
    });

    if (!conversation) {
      return res.status(200).json({ messages: [], message: "No conversation found" });
    }

    // Fetch messages in that conversation
    const messages = await Message.find({ conversationId: conversation._id })
      .populate("sender", "name _id")
      .sort({ createdAt: 1 });

    res.status(200).json({
      conversationId: conversation._id,
      messages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/chat-list", authoriseuser, async (req, res) => {
  try {
    const userId = req.user.id;

    // Step 1: Find all conversations that include this user
    const conversations = await Conversation.find({
      participants: userId,
    }).sort({ updatedAt: -1 }); // most recent first

    if (!conversations.length) {
      return res.status(200).json({ chats: [] });
    }

    // Step 2: For each conversation, fetch the other user and last message
    const chatList = await Promise.all(
      conversations.map(async (conv) => {
        // Identify the other participant
        const otherUserId = conv.participants.find(
          (id) => id.toString() !== userId
        );

        const otherUser = await User.findById(otherUserId).select("name _id");

        // Fetch the latest message
        const lastMessage = await Message.findOne({
          conversationId: conv._id,
        })
          .sort({ createdAt: -1 })
          .select("text messageType createdAt sender");

        return {
          conversationId: conv._id,
          user: otherUser,
          lastMessage: lastMessage
            ? {
                text: lastMessage.text || "Media",
                messageType: lastMessage.messageType,
                createdAt: lastMessage.createdAt,
                sender: lastMessage.sender,
              }
            : null,
        };
      })
    );

    res.status(200).json({ chats: chatList });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
