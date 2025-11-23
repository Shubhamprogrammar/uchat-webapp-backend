const express = require("express");
const Message = require("../models/Message.js");
const Conversation = require("../models/Conversation.js");
const User = require("../models/User.js");
const authoriseuser = require("../middleware/authoriseuser");

const router = express.Router();

router.post("/send-message", authoriseuser, async (req, res) => {
    try {
        const { receiverId, senderId, text, mediaUrl, messageType } = req.body;

        if (!receiverId || !senderId || (!text && !mediaUrl)) {
            return res.status(400).json({ message: "Required fields missing" });
        }

        if (!receiverId || !mongoose.Types.ObjectId.isValid(receiverId)) {
            return res.status(400).json({ message: "Invalid or missing receiverId" });
        }

        if (!senderId || !mongoose.Types.ObjectId.isValid(senderId)) {
            return res.status(400).json({ message: "Invalid or missing senderId" });
        }

        // Validate message content
        if ((!text || text.trim() === "") && (!mediaUrl || mediaUrl.trim() === "")) {
            return res.status(400).json({ message: "Message must contain text or media" });
        }

        // Validate message type
        const allowedTypes = ["text", "image", "file"];
        if (messageType && !allowedTypes.includes(messageType)) {
            return res.status(400).json({ message: "Invalid message type" });
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
        const messages = await Message.find({ conversationId: conversation._id, is_deleted: false })
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
                    (id) => id.toString() !== userId.toString()
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

router.put("/edit-message/:messageId", authoriseuser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;
        const { newText } = req.body;

        if (!newText || newText.trim() === "") {
            return res.status(400).json({ message: "Message text cannot be empty" });
        }

        // Find the message
        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Ensure only the sender can edit
        if (message.sender.toString() !== userId.toString()) {
            return res.status(403).json({ message: "You can only edit your own messages" });
        }

        // Update message text
        message.text = newText;
        await message.save();

        // Update lastMessage in conversation if it's the most recent one
        const latestMessage = await Message.findOne({
            conversationId: message.conversationId,
        }).sort({ createdAt: -1 });

        if (latestMessage && latestMessage._id.toString() === message._id.toString()) {
            await Conversation.findByIdAndUpdate(message.conversationId, {
                lastMessage: newText,
            });
        }

        // Emit event for real-time updates
        if (req.io) {
            req.io.to(message.conversationId.toString()).emit("messageEdited", message);
        }

        res.status(200).json({
            message: "Message updated successfully",
            data: message,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// DELETE MESSAGE
router.delete("/delete-message/:messageId", authoriseuser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Only sender can delete their message
        if (message.sender.toString() !== userId.toString()) {
            return res.status(403).json({ message: "You can only delete your own messages" });
        }

        // Soft delete
        message.is_deleted = true;
        await message.save();

        // Update lastMessage in conversation if it was the latest one
        const latestMessage = await Message.findOne({
            conversationId: message.conversationId,
        }).sort({ createdAt: -1 });

        if (latestMessage && latestMessage._id.toString() === message._id.toString()) {
            await Conversation.findByIdAndUpdate(message.conversationId, {
                lastMessage: "This message was deleted",
            });
        }

        // Emit delete event for live chat updates
        if (req.io) {
            req.io.to(message.conversationId.toString()).emit("messageDeleted", messageId);
        }

        res.status(200).json({ message: "Message deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
